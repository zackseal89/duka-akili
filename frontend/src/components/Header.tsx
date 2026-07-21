"use client";

import type { ConnectionState } from "@/lib/useDukaChat";
import { DukaMark, MoonIcon, PlusIcon, SunIcon } from "./icons";
import { useTheme } from "./useTheme";

function StatusPill({ state }: { state: ConnectionState }) {
  const config: Record<ConnectionState, { label: string; dot: string; text: string }> = {
    unknown: { label: "Connecting", dot: "bg-faint", text: "text-muted" },
    connecting: { label: "Connecting", dot: "bg-accent animate-pulse", text: "text-accent" },
    ready: { label: "Connected", dot: "bg-brand", text: "text-brand" },
    error: { label: "Offline", dot: "bg-danger", text: "text-danger" },
  };
  const { label, dot, text } = config[state];
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] font-medium shadow-card"
      title={`Agent ${label.toLowerCase()}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className={text}>{label}</span>
    </span>
  );
}

export function Header({
  connection,
  onReset,
  canReset,
}: {
  connection: ConnectionState;
  onReset: () => void;
  canReset: boolean;
}) {
  const { theme, toggle, ready } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-card">
            <DukaMark className="h-full w-full" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[17px] font-semibold tracking-tight text-ink">
              Duka Akili
            </p>
            <p className="truncate text-[11px] text-muted">Grounded answers from your documents</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden sm:block">
            <StatusPill state={connection} />
          </span>

          {canReset ? (
            <button
              type="button"
              onClick={onReset}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft shadow-card transition hover:border-brand-line hover:bg-brand-soft/50"
              title="Start a new conversation"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft shadow-card transition hover:border-brand-line hover:text-brand"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {ready && theme === "dark" ? (
              <SunIcon className="h-4.5 w-4.5" />
            ) : (
              <MoonIcon className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto block max-w-3xl px-3 pb-2 sm:hidden">
        <StatusPill state={connection} />
      </div>
    </header>
  );
}
