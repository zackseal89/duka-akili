"use client";

import { useMemo } from "react";

import {
  assistantText,
  isAssistant,
  type AssistantMessage,
  type ChatMessage,
  type ReasoningBlock,
  type TextBlock,
  type ToolBlock,
  type UserMessage,
} from "@/lib/chat-types";
import { citationsFromText, mergeCitations } from "@/lib/citations";
import { detectConflict, detectRefusal } from "@/lib/conflict";
import { AnswerText } from "./AnswerText";
import { CitationChips } from "./CitationChips";
import { ConflictCard } from "./ConflictCard";
import { ReasoningTrace } from "./ReasoningTrace";
import { ToolStep } from "./ToolStep";
import { AlertIcon, DukaMark, RefreshIcon } from "./icons";

function UserBubble({ message }: { message: UserMessage }) {
  return (
    <div className="animate-rise flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-brand-on shadow-card sm:max-w-[75%]">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.text}</p>
      </div>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="mt-0.5 hidden h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-brand-line/70 shadow-card sm:block">
      <DukaMark className="h-full w-full" />
    </div>
  );
}

function TurnMeta({ message }: { message: AssistantMessage }) {
  const parts: string[] = [];
  if (typeof message.totalTokens === "number") {
    parts.push(`${message.totalTokens.toLocaleString()} tokens`);
  }
  if (typeof message.elapsedMs === "number" && message.elapsedMs > 0) {
    parts.push(`${(message.elapsedMs / 1000).toFixed(1)}s`);
  }
  const author = message.authors.find((name) => name && name !== "user");
  if (author) parts.push(author);
  if (parts.length === 0) return null;
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-faint">
      <span className="inline-flex items-center gap-1">
        <span className="h-1 w-1 rounded-full bg-brand/60" />
        Gemma
      </span>
      {parts.map((part) => (
        <span key={part} className="tabular-nums">
          · {part}
        </span>
      ))}
    </p>
  );
}

function AssistantTurn({
  message,
  onRetry,
}: {
  message: AssistantMessage;
  onRetry: () => void;
}) {
  const streaming = message.status === "streaming";

  // Interleave the process stream (reasoning traces and tool steps) with the
  // answer text, in emission order. Consecutive process blocks are grouped so a
  // plan-then-retrieve run reads as one compact stack.
  type ProcessBlock = ToolBlock | ReasoningBlock;
  const { renderItems, answer, citations, conflict, refusal } = useMemo(() => {
    const items: Array<
      { type: "process"; blocks: ProcessBlock[] } | { type: "text"; block: TextBlock }
    > = [];
    for (const block of message.blocks) {
      if (block.kind === "tool" || block.kind === "reasoning") {
        const last = items[items.length - 1];
        if (last && last.type === "process") last.blocks.push(block);
        else items.push({ type: "process", blocks: [block] });
      } else if (block.text.trim() || streaming) {
        items.push({ type: "text", block });
      }
    }

    const fullAnswer = assistantText(message);
    const retrievalCitations = message.blocks
      .filter((block): block is ToolBlock => block.kind === "tool")
      .flatMap((block) => block.sources);
    const answerCitations = citationsFromText(fullAnswer);
    const merged = mergeCitations(answerCitations, retrievalCitations);

    const conflictVerdict = detectConflict(fullAnswer, merged);
    const isRefusal = !conflictVerdict.isConflict && detectRefusal(fullAnswer, merged);

    return {
      renderItems: items,
      answer: fullAnswer,
      citations: merged,
      conflict: conflictVerdict,
      refusal: isRefusal,
    };
  }, [message, streaming]);

  const hasAnswerText = renderItems.some(
    (item) => item.type === "text" && item.block.text.trim(),
  );

  return (
    <div className="animate-rise flex gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 space-y-3">
        {renderItems.map((item, index) => {
          if (item.type === "process") {
            return (
              <div key={`process-${index}`} className="space-y-2">
                {item.blocks.map((block) =>
                  block.kind === "tool" ? (
                    <ToolStep key={block.id} block={block} />
                  ) : (
                    <ReasoningTrace
                      key={block.id}
                      block={block}
                      streaming={streaming && !block.closed}
                    />
                  ),
                )}
              </div>
            );
          }

          const isLastText =
            index === renderItems.length - 1 ||
            !renderItems.slice(index + 1).some((next) => next.type === "text");
          const showAsConflict = conflict.isConflict && isLastText;

          if (!item.block.text.trim()) {
            return null;
          }

          if (showAsConflict) {
            return (
              <ConflictCard
                key={item.block.id}
                text={answer}
                streaming={streaming && isLastText}
                documents={conflict.documents}
              />
            );
          }

          return (
            <div
              key={item.block.id}
              className={[
                "rounded-2xl border bg-surface px-4 py-3.5 shadow-card",
                refusal && isLastText ? "border-line-strong bg-surface-2" : "border-line",
              ].join(" ")}
            >
              {refusal && isLastText ? (
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <span className="h-1 w-1 rounded-full bg-accent" />
                  Not in the documents
                </p>
              ) : null}
              <AnswerText text={item.block.text} streaming={streaming && isLastText} />
              {isLastText && !conflict.isConflict ? (
                <CitationChips citations={citations} />
              ) : null}
            </div>
          );
        })}

        {conflict.isConflict ? <CitationChips citations={citations} /> : null}

        {/* Waiting on the first token, and nothing to show yet. Once a reasoning
            trace or a tool chip exists they carry their own live state, so the
            generic indicator is only for the very first empty moment. */}
        {streaming && !hasAnswerText && message.blocks.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-1 text-sm text-muted">
            <span className="inline-flex gap-1">
              <span className="dot-1 h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="dot-2 h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="dot-3 h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Thinking
          </div>
        ) : null}

        {message.status === "error" ? (
          <div className="rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-sm">
            <p className="flex items-start gap-2 text-danger">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-medium">
                  {message.error ?? "The agent could not answer."}
                </span>
                {message.errorDetail ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-danger/80">
                    {message.errorDetail}
                  </span>
                ) : null}
              </span>
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-danger-line bg-surface px-2.5 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : null}

        {message.status === "stopped" ? (
          <p className="px-1 text-xs italic text-muted">You stopped this answer.</p>
        ) : null}

        {message.status === "done" && hasAnswerText ? <TurnMeta message={message} /> : null}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  onRetry,
}: {
  messages: ChatMessage[];
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      {messages.map((message) =>
        isAssistant(message) ? (
          <AssistantTurn key={message.id} message={message} onRetry={onRetry} />
        ) : (
          <UserBubble key={message.id} message={message} />
        ),
      )}
    </div>
  );
}
