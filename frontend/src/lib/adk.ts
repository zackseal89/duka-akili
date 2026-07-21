/**
 * Thin client for the two ADK FastAPI endpoints this app is allowed to use:
 *
 *   POST {BASE}/apps/{app}/users/{userId}/sessions   -> create a session
 *   POST {BASE}/run_sse                              -> stream one turn
 *
 * The stream is consumed with fetch + response.body.getReader() rather than
 * EventSource, because EventSource can only issue GET requests and run_sse
 * needs a POST body.
 */

import type {
  AdkEvent,
  AdkFunctionCall,
  AdkFunctionResponse,
  AdkPart,
  AdkSession,
} from "./adk-types";

export const DEFAULT_AGENT_URL = "http://localhost:8000";

/** ADK app name, set by `App(name="app")` on the backend. */
export const APP_NAME = "app";

export type AgentErrorKind =
  | "unreachable"
  | "session"
  | "stream"
  | "protocol"
  | "aborted";

export class AgentError extends Error {
  readonly kind: AgentErrorKind;
  readonly status?: number;
  readonly detail?: string;

  constructor(
    kind: AgentErrorKind,
    message: string,
    options?: { status?: number; detail?: string; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AgentError";
    this.kind = kind;
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

export function normalizeBaseUrl(raw: string | undefined | null): string {
  const value = (raw ?? "").trim() || DEFAULT_AGENT_URL;
  return value.replace(/\/+$/, "");
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (error instanceof Error && error.name === "AbortError");
}

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.slice(0, 400) || undefined;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateSessionOptions {
  baseUrl: string;
  userId: string;
  state?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * Creates a session and returns its id. The endpoint returns a full Session
 * object; only `id` matters to the client.
 */
export async function createSession({
  baseUrl,
  userId,
  state,
  signal,
}: CreateSessionOptions): Promise<string> {
  const url = `${normalizeBaseUrl(baseUrl)}/apps/${APP_NAME}/users/${encodeURIComponent(userId)}/sessions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state ? { state } : {}),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) {
      throw new AgentError("aborted", "Session request cancelled.", { cause: error });
    }
    throw new AgentError(
      "unreachable",
      `Cannot reach the agent at ${normalizeBaseUrl(baseUrl)}.`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new AgentError(
      "session",
      `The agent refused to create a session (HTTP ${response.status}).`,
      { status: response.status, detail: await readErrorBody(response) },
    );
  }

  let session: AdkSession;
  try {
    session = (await response.json()) as AdkSession;
  } catch (error) {
    throw new AgentError("protocol", "The session response was not valid JSON.", {
      cause: error,
    });
  }

  const id = typeof session?.id === "string" ? session.id : undefined;
  if (!id) {
    throw new AgentError(
      "protocol",
      "The session response did not include an id field.",
    );
  }
  return id;
}

/* -------------------------------------------------------------------------- */
/* Server sent events                                                         */
/* -------------------------------------------------------------------------- */

/** Collects the `data:` field of one SSE block, per the SSE line format. */
function extractData(block: string): string | null {
  const chunks: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line === "data") {
      chunks.push("");
      continue;
    }
    if (line.startsWith("data:")) {
      chunks.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (chunks.length === 0) return null;
  const joined = chunks.join("\n").trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Reads an SSE response body and yields the payload of each event block.
 * Handles \n, \r\n and \r terminators, and payloads split across TCP chunks.
 */
export async function* readSseBlocks(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const body = response.body;
  if (!body) {
    throw new AgentError("protocol", "The agent response had no readable body.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingCarriageReturn = false;

  // SSE treats \n, \r\n and \r as line terminators. Everything downstream is
  // simpler if the buffer only ever contains \n.
  const normalize = (input: string): string => {
    let text = input;
    if (pendingCarriageReturn) {
      // The previous chunk ended with \r, already emitted as \n. If this chunk
      // starts with \n the pair was a single \r\n terminator, so drop it.
      if (text.startsWith("\n")) text = text.slice(1);
      pendingCarriageReturn = false;
    }
    if (text.endsWith("\r")) {
      text = `${text.slice(0, -1)}\n`;
      pendingCarriageReturn = true;
    }
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  };

  const drain = function* (flush: boolean): Generator<string, void, void> {
    let index: number;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const data = extractData(block);
      if (data !== null) yield data;
    }
    if (flush && buffer.trim().length > 0) {
      const data = extractData(buffer);
      buffer = "";
      if (data !== null) yield data;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += normalize(decoder.decode(value, { stream: true }));
      yield* drain(false);
    }
    buffer += normalize(decoder.decode());
    yield* drain(true);
  } catch (error) {
    if (isAbort(error) || signal?.aborted) {
      throw new AgentError("aborted", "Stream cancelled.", { cause: error });
    }
    throw new AgentError(
      "stream",
      "The connection to the agent dropped while it was answering.",
      { cause: error },
    );
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Releasing a lock on an already closed stream is not an error worth surfacing.
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Turns                                                                      */
/* -------------------------------------------------------------------------- */

export interface StreamTurnOptions {
  baseUrl: string;
  userId: string;
  sessionId: string;
  text: string;
  signal?: AbortSignal;
}

/** POSTs one user message to /run_sse and yields every ADK event it emits. */
export async function* streamTurn({
  baseUrl,
  userId,
  sessionId,
  text,
  signal,
}: StreamTurnOptions): AsyncGenerator<AdkEvent, void, void> {
  const url = `${normalizeBaseUrl(baseUrl)}/run_sse`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        app_name: APP_NAME,
        user_id: userId,
        session_id: sessionId,
        new_message: { role: "user", parts: [{ text }] },
        streaming: true,
      }),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) {
      throw new AgentError("aborted", "Request cancelled.", { cause: error });
    }
    throw new AgentError(
      "unreachable",
      `Cannot reach the agent at ${normalizeBaseUrl(baseUrl)}.`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new AgentError(
      "stream",
      `The agent returned HTTP ${response.status} for this question.`,
      { status: response.status, detail: await readErrorBody(response) },
    );
  }

  for await (const data of readSseBlocks(response, signal)) {
    if (data === "[DONE]") return;
    let event: AdkEvent;
    try {
      event = JSON.parse(data) as AdkEvent;
    } catch {
      // A malformed frame should never kill a demo. Skip it and keep reading.
      continue;
    }
    if (event && typeof event === "object") yield event;
  }
}

/* -------------------------------------------------------------------------- */
/* Field accessors                                                            */
/* -------------------------------------------------------------------------- */

export function eventParts(event: AdkEvent): AdkPart[] {
  const parts = event?.content?.parts;
  return Array.isArray(parts) ? parts.filter((part) => part && typeof part === "object") : [];
}

export function partFunctionCall(part: AdkPart): AdkFunctionCall | null {
  const call = part?.functionCall ?? part?.function_call;
  return call && typeof call === "object" ? call : null;
}

export function partFunctionResponse(part: AdkPart): AdkFunctionResponse | null {
  const value = part?.functionResponse ?? part?.function_response;
  return value && typeof value === "object" ? value : null;
}

export function eventErrorMessage(event: AdkEvent): string | null {
  const message = event?.errorMessage ?? event?.error_message;
  if (typeof message === "string" && message.trim()) return message.trim();
  const code = event?.errorCode ?? event?.error_code;
  if (typeof code === "string" && code.trim()) return code.trim();
  return null;
}

export function eventTotalTokens(event: AdkEvent): number | null {
  const usage = event?.usageMetadata ?? event?.usage_metadata;
  if (!usage || typeof usage !== "object") return null;
  const total = usage.totalTokenCount ?? usage.total_token_count;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export function eventIsPartial(event: AdkEvent): boolean {
  return event?.partial === true;
}
