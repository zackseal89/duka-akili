"use client";

import { useEffect, useRef, useState } from "react";

import { STARTER_PROMPTS } from "@/lib/documents";
import { SendIcon, StopIcon } from "./icons";

const MAX_HEIGHT = 168;

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  showQuickChips,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  showQuickChips: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  useEffect(resize, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="border-t border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
        {showQuickChips ? (
          <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 scroll-paper">
            {STARTER_PROMPTS.slice(0, 4).map((prompt) => (
              <button
                key={prompt.text}
                type="button"
                disabled={isStreaming}
                onClick={() => onSend(prompt.text)}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft shadow-card transition hover:border-brand-line hover:bg-brand-soft/50 disabled:opacity-50"
              >
                {prompt.text}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-1.5 shadow-float transition focus-within:border-brand focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={disabled && !isStreaming}
            placeholder="Uliza swali… ask about your documents"
            aria-label="Ask a question about your documents"
            className="max-h-[168px] min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none disabled:opacity-60"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-sm font-medium text-paper transition hover:opacity-90"
              aria-label="Stop generating"
            >
              <StopIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on shadow-card transition enabled:hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <p className="mt-1.5 px-1 text-center text-[11px] text-faint">
          Duka Akili answers only from your documents and cites its source. Verify before acting on
          money or tax.
        </p>
      </div>
    </div>
  );
}
