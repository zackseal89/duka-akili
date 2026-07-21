"use client";

import { useState } from "react";

import type { ReasoningBlock } from "@/lib/chat-types";
import { ChevronIcon, SparkIcon } from "./icons";

/**
 * Renders Gemma's `thought: true` narration as a collapsible trace. This is
 * kept out of the answer bubble entirely and shown here so the demo can point
 * at the model actually planning before it retrieves and answers.
 */
export function ReasoningTrace({
  block,
  streaming,
}: {
  block: ReasoningBlock;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preview = block.text.replace(/\s+/g, " ").trim();

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2/60 text-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <SparkIcon className={["h-3.5 w-3.5", streaming ? "animate-pulse" : ""].join(" ")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-medium text-ink-soft">
              {streaming ? "Thinking it through" : "Reasoning"}
            </span>
            {streaming ? (
              <span className="inline-flex w-4 justify-start text-accent">
                <span className="dot-1">.</span>
                <span className="dot-2">.</span>
                <span className="dot-3">.</span>
              </span>
            ) : null}
          </span>
          {!open ? (
            <span className="mt-0.5 block truncate text-[12px] italic text-muted">{preview}</span>
          ) : null}
        </span>
        <ChevronIcon
          className={["h-3.5 w-3.5 shrink-0 text-faint transition-transform", open ? "rotate-90" : ""].join(
            " ",
          )}
        />
      </button>

      {open ? (
        <div className="animate-fade border-t border-line/70 px-3 pb-3 pt-2.5">
          <p className="whitespace-pre-wrap text-[13px] italic leading-relaxed text-ink-soft">
            {block.text}
            {streaming ? (
              <span
                className="caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.12em] rounded-full bg-accent"
                aria-hidden="true"
              />
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
