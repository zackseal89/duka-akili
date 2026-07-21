/**
 * Folds the ADK event stream into the ordered blocks the UI renders.
 *
 * The stream has two properties that make naive accumulation wrong, both
 * verified against the live agent:
 *
 *  1. Some text parts carry `thought: true`. That text is Gemma's internal
 *     planning, not the answer. It must never land in the answer bubble. It is
 *     kept as a separate reasoning trace instead.
 *
 *  2. The turn streams as `partial: true` deltas, then emits a final
 *     `partial: false` event that REPLAYS every part of the turn again
 *     (thoughts, function calls, and the full answer text). Re-applying that
 *     replay would duplicate tool chips and the answer. So:
 *       - function calls are deduped by id (a replayed call is ignored),
 *       - function responses are deduped by id,
 *       - streaming text extends the open block; a non partial text part is
 *         treated as the authoritative full text and only replaces or closes
 *         the block it belongs to, and a non partial part whose text is already
 *         covered by an accumulated block is dropped as a replay.
 *
 * This also stays correct for a simpler backend that sends an answer as a
 * single non partial event with no deltas: nothing is accumulated yet, so the
 * text is rendered rather than dropped.
 */

import {
  eventErrorMessage,
  eventIsPartial,
  eventParts,
  eventTotalTokens,
  partFunctionCall,
  partFunctionResponse,
} from "./adk";
import type { AdkEvent } from "./adk-types";
import type { ReasoningBlock, TextBlock, ToolBlock, TurnBlock } from "./chat-types";
import { citationsFromToolResponse } from "./citations";

export interface TurnState {
  blocks: TurnBlock[];
  authors: string[];
  totalTokens?: number;
  error?: string;
  /** ids of function calls already turned into a tool chip. */
  seenCalls: string[];
  /** ids of function responses already applied. */
  seenResponses: string[];
}

export function emptyTurn(): TurnState {
  return { blocks: [], authors: [], seenCalls: [], seenResponses: [] };
}

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

type StreamKind = "text" | "reasoning";

function openBlockOfKind(blocks: TurnBlock[], kind: StreamKind): TextBlock | ReasoningBlock | null {
  const last = blocks[blocks.length - 1];
  if (last && last.kind === kind && !last.closed) return last;
  return null;
}

/** Most recent already closed block of a kind, used to spot replayed text. */
function lastClosedOfKind(blocks: TurnBlock[], kind: StreamKind): TextBlock | ReasoningBlock | null {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.kind === kind) return block.closed ? block : null;
  }
  return null;
}

/** Applies one ADK event, returning a new state. Never throws. */
export function applyEvent(state: TurnState, event: AdkEvent): TurnState {
  try {
    return reduce(state, event);
  } catch {
    return state;
  }
}

function reduce(state: TurnState, event: AdkEvent): TurnState {
  const author = typeof event.author === "string" ? event.author : undefined;

  // The server echoes the user's own message back as an event. Skip it.
  if (author === "user" || event?.content?.role === "user") return state;

  let blocks = state.blocks;
  let seenCalls = state.seenCalls;
  let seenResponses = state.seenResponses;
  let changed = false;

  const mutateBlocks = () => {
    if (!changed) {
      blocks = blocks.slice();
      changed = true;
    }
  };

  const replaceLast = (block: TurnBlock): void => {
    mutateBlocks();
    blocks[blocks.length - 1] = block;
  };

  const push = (block: TurnBlock): void => {
    mutateBlocks();
    blocks.push(block);
  };

  const closeOpenStream = (): void => {
    const last = blocks[blocks.length - 1];
    if (last && (last.kind === "text" || last.kind === "reasoning") && !last.closed) {
      replaceLast({ ...last, closed: true });
    }
  };

  const partial = eventIsPartial(event);

  for (const part of eventParts(event)) {
    /* ----- function call ------------------------------------------------- */
    const call = partFunctionCall(part);
    if (call) {
      const id = (typeof call.id === "string" && call.id) || "";
      const name = (typeof call.name === "string" && call.name) || "tool";
      // A replayed call arrives with the same id. Ignore it.
      const dedupeKey = id || `${name}:${JSON.stringify(call.args ?? {})}`;
      if (seenCalls.includes(dedupeKey)) continue;
      seenCalls = seenCalls === state.seenCalls ? seenCalls.slice() : seenCalls;
      seenCalls.push(dedupeKey);

      closeOpenStream();
      push({
        kind: "tool",
        id: id || nextId("tool"),
        name,
        args:
          call.args && typeof call.args === "object"
            ? (call.args as Record<string, unknown>)
            : undefined,
        status: "running",
        sources: [],
        author,
        startedAt: Date.now(),
      });
      continue;
    }

    /* ----- function response --------------------------------------------- */
    const toolResponse = partFunctionResponse(part);
    if (toolResponse) {
      const name = typeof toolResponse.name === "string" ? toolResponse.name : undefined;
      const id = typeof toolResponse.id === "string" ? toolResponse.id : undefined;
      const dedupeKey = id || `resp:${name ?? "tool"}`;
      if (seenResponses.includes(dedupeKey)) continue;

      const index = findToolIndex(blocks, { id, name });
      const sources = citationsFromToolResponse(toolResponse.response);
      const errored = isErrorResponse(toolResponse.response);

      seenResponses = seenResponses === state.seenResponses ? seenResponses.slice() : seenResponses;
      seenResponses.push(dedupeKey);

      if (index >= 0) {
        const existing = blocks[index] as ToolBlock;
        mutateBlocks();
        blocks[index] = {
          ...existing,
          status: errored ? "error" : "done",
          response: toolResponse.response,
          sources,
          endedAt: Date.now(),
        };
      } else {
        // A response with no matching call. Show it rather than dropping it.
        closeOpenStream();
        push({
          kind: "tool",
          id: id || nextId("tool"),
          name: name || "tool",
          status: errored ? "error" : "done",
          response: toolResponse.response,
          sources,
          author,
          startedAt: Date.now(),
          endedAt: Date.now(),
        });
      }
      continue;
    }

    /* ----- text (answer or reasoning) ------------------------------------ */
    const text = typeof part?.text === "string" ? part.text : "";
    if (!text) continue;

    const kind: StreamKind = part?.thought === true ? "reasoning" : "text";
    const open = openBlockOfKind(blocks, kind);

    if (partial) {
      if (open) {
        replaceLast({ ...open, text: appendChunk(open.text, text), author: open.author ?? author });
      } else {
        // The stream switched kind (reasoning <-> answer) or nothing is open
        // yet. Close whatever WAS open first, or it is orphaned: no longer
        // last (so openBlockOfKind can never find it again) but still
        // unclosed (so lastClosedOfKind refuses to match it either). An
        // orphaned block is invisible to the replay dedup below, and its
        // content gets pushed a second time when the final partial:false
        // event replays it. This was a real bug, caught against a live
        // multi-tool-call turn, not assumed.
        closeOpenStream();
        push({ kind, id: nextId(kind), text, closed: false, author });
      }
      continue;
    }

    // Non partial text: authoritative for its block, but usually a replay.
    if (open) {
      replaceLast({ ...open, text: pickFullText(open.text, text), closed: true, author });
      continue;
    }

    closeOpenStream();
    const closed = lastClosedOfKind(blocks, kind);
    if (closed && covers(closed.text, text)) {
      // Replayed text for a block we already finished. Nothing new.
      continue;
    }

    push({ kind, id: nextId(kind), text, closed: true, author });
  }

  const tokens = eventTotalTokens(event);
  const errorMessage = eventErrorMessage(event);

  const authors =
    author && !state.authors.includes(author) ? [...state.authors, author] : state.authors;

  if (
    !changed &&
    seenCalls === state.seenCalls &&
    seenResponses === state.seenResponses &&
    authors === state.authors &&
    tokens == null &&
    errorMessage == null
  ) {
    return state;
  }

  return {
    blocks,
    authors,
    totalTokens: tokens ?? state.totalTokens,
    error: errorMessage ?? state.error,
    seenCalls,
    seenResponses,
  };
}

function findToolIndex(blocks: TurnBlock[], match: { id?: string; name?: string }): number {
  // Prefer an exact id match on a still running tool.
  if (match.id) {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      if (block.kind === "tool" && block.id === match.id) return index;
    }
  }
  // Otherwise the most recent running tool with a matching name.
  if (match.name) {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      if (block.kind === "tool" && block.status === "running" && block.name === match.name) {
        return index;
      }
    }
  }
  // Last resort: the most recent running tool, so a mismatched id still closes
  // a chip instead of leaving it spinning.
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.kind === "tool" && block.status === "running") return index;
  }
  return -1;
}

/**
 * Streams differ: some send each chunk as a delta, some resend the whole text
 * so far. Detect which by checking whether the chunk contains what we have.
 */
function appendChunk(current: string, chunk: string): string {
  if (!current) return chunk;
  if (chunk === current) return current;
  if (chunk.length >= current.length && chunk.startsWith(current)) return chunk;
  return current + chunk;
}

/**
 * The final non partial event should carry the full text. If it somehow
 * carries less than what streamed, keep the longer version.
 */
function pickFullText(streamed: string, full: string): string {
  if (!streamed) return full;
  if (full.startsWith(streamed) || full.length >= streamed.length) return full;
  if (streamed.startsWith(full)) return streamed;
  return full;
}

/** True when `accumulated` already represents `incoming` (a replay). */
function covers(accumulated: string, incoming: string): boolean {
  if (!incoming) return true;
  if (!accumulated) return false;
  const a = accumulated.trim();
  const b = incoming.trim();
  return a === b || a.includes(b) || b.includes(a);
}

function isErrorResponse(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const record = response as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() !== "error") continue;
    if (record[key]) return true;
  }
  return false;
}

/** Marks anything still running as finished, for when a stream ends abruptly. */
export function settleTurn(state: TurnState, status: "done" | "error" | "stopped"): TurnState {
  let changed = false;
  const blocks = state.blocks.map((block) => {
    if ((block.kind === "text" || block.kind === "reasoning") && !block.closed) {
      changed = true;
      return { ...block, closed: true };
    }
    if (block.kind === "tool" && block.status === "running") {
      changed = true;
      return {
        ...block,
        status: status === "done" ? ("done" as const) : ("error" as const),
        endedAt: Date.now(),
      };
    }
    return block;
  });
  return changed ? { ...state, blocks } : state;
}
