"use client";

import { useEffect, useRef, useState } from "react";

import { useDukaChat } from "@/lib/useDukaChat";
import { Composer } from "./Composer";
import { ConnectionBanner } from "./ConnectionBanner";
import { EmptyState } from "./EmptyState";
import { Header } from "./Header";
import { MessageList } from "./MessageList";
import { ChevronIcon } from "./icons";

export function ChatWorkspace({ agentUrl }: { agentUrl: string }) {
  const chat = useDukaChat(agentUrl);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const hasMessages = chat.messages.length > 0;

  // Stick to the bottom while streaming, unless the reader has scrolled up.
  useEffect(() => {
    if (!pinned) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distanceFromBottom < 120);
  };

  const jumpToBottom = () => {
    setPinned(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Header
        connection={chat.connection}
        onReset={chat.reset}
        canReset={hasMessages || chat.isStreaming}
      />

      {chat.problem ? (
        <ConnectionBanner
          problem={chat.problem}
          agentUrl={agentUrl}
          onRetry={chat.reset}
          onDismiss={chat.dismissProblem}
        />
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="scroll-paper h-full overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
            {hasMessages ? (
              <MessageList messages={chat.messages} onRetry={chat.retry} />
            ) : (
              <EmptyState onPick={chat.send} />
            )}
            <div ref={bottomRef} className="h-1" />
          </div>
        </div>

        {hasMessages && !pinned ? (
          <button
            type="button"
            onClick={jumpToBottom}
            className="animate-fade absolute bottom-4 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink-soft shadow-pop transition hover:border-brand-line hover:text-brand"
          >
            <ChevronIcon className="h-4 w-4 rotate-90" />
            Latest
          </button>
        ) : null}
      </div>

      <Composer
        onSend={chat.send}
        onStop={chat.stop}
        isStreaming={chat.isStreaming}
        disabled={chat.connection === "error"}
        showQuickChips={hasMessages}
      />
    </div>
  );
}
