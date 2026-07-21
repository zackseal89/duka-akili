/** Shapes the chat UI renders. Built from ADK events by `turn-reducer.ts`. */

export interface Citation {
  /** Document filename, e.g. staff_handbook.md */
  doc: string;
  /** Section heading if one was cited or retrieved. */
  section?: string;
  /** Retrieved text, when a tool response carried it. */
  snippet?: string;
  /** Retrieval similarity score, when a tool response carried it. */
  score?: number;
  /** Where this citation came from: the answer text, or a tool result. */
  origin: "answer" | "retrieval";
}

export interface TextBlock {
  kind: "text";
  id: string;
  text: string;
  /** Author of the ADK events that produced this block. */
  author?: string;
  /** True once a non partial event has finalised this block. */
  closed: boolean;
}

/**
 * Gemma's internal planning narration, emitted as text parts carrying
 * `thought: true`. It must never appear in the answer bubble, but it is shown
 * as a collapsible reasoning trace because seeing the model plan is part of the
 * demo's credibility.
 */
export interface ReasoningBlock {
  kind: "reasoning";
  id: string;
  text: string;
  author?: string;
  closed: boolean;
}

export type ToolStatus = "running" | "done" | "error";

export interface ToolBlock {
  kind: "tool";
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: ToolStatus;
  response?: unknown;
  /** Sources pulled out of the tool response, when it looks like retrieval. */
  sources: Citation[];
  author?: string;
  startedAt: number;
  endedAt?: number;
}

export type TurnBlock = TextBlock | ToolBlock | ReasoningBlock;

export interface UserMessage {
  role: "user";
  id: string;
  text: string;
  at: number;
}

export type AssistantStatus = "streaming" | "done" | "error" | "stopped";

export interface AssistantMessage {
  role: "assistant";
  id: string;
  at: number;
  status: AssistantStatus;
  blocks: TurnBlock[];
  /** Distinct ADK authors seen in this turn. */
  authors: string[];
  totalTokens?: number;
  elapsedMs?: number;
  error?: string;
  errorDetail?: string;
  /** The user question that produced this turn, so it can be retried. */
  question: string;
}

export type ChatMessage = UserMessage | AssistantMessage;

export function isAssistant(message: ChatMessage): message is AssistantMessage {
  return message.role === "assistant";
}

/** Concatenated visible answer text of an assistant turn. */
export function assistantText(message: AssistantMessage): string {
  return message.blocks
    .filter((block): block is TextBlock => block.kind === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

export function toolBlocks(message: AssistantMessage): ToolBlock[] {
  return message.blocks.filter((block): block is ToolBlock => block.kind === "tool");
}

export function reasoningText(message: AssistantMessage): string {
  return message.blocks
    .filter((block): block is ReasoningBlock => block.kind === "reasoning")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
