"use client";

import type { ConnectionProblem } from "@/lib/useDukaChat";
import { AlertIcon, CloseIcon, RefreshIcon } from "./icons";

const TITLES: Record<ConnectionProblem["kind"], string> = {
  unreachable: "Cannot reach the agent",
  session: "The agent refused a session",
  protocol: "Unexpected response from the agent",
  stream: "The connection dropped",
};

export function ConnectionBanner({
  problem,
  agentUrl,
  onRetry,
  onDismiss,
}: {
  problem: ConnectionProblem;
  agentUrl: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const showHint = problem.kind === "unreachable" || problem.kind === "session";

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-3 pt-3 sm:px-4">
      <div className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 shadow-card">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-danger text-white">
            <AlertIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-danger">{TITLES[problem.kind]}</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">{problem.message}</p>
            {showHint ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Make sure the ADK agent server is running and reachable at{" "}
                <code className="rounded bg-surface px-1.5 py-px font-mono text-[11px] text-ink-soft">
                  {agentUrl}
                </code>
                . Set{" "}
                <code className="rounded bg-surface px-1.5 py-px font-mono text-[11px] text-ink-soft">
                  NEXT_PUBLIC_AGENT_URL
                </code>{" "}
                if it lives elsewhere.
              </p>
            ) : null}
            {problem.detail ? (
              <p className="mt-1.5 max-h-16 overflow-y-auto font-mono text-[11px] text-danger/80 scroll-paper">
                {problem.detail}
              </p>
            ) : null}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-2.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Retry connection
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-muted transition hover:bg-surface hover:text-ink"
            aria-label="Dismiss"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
