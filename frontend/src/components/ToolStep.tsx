"use client";

import { useState } from "react";

import type { ToolBlock } from "@/lib/chat-types";
import { CheckIcon, ChevronIcon, SearchIcon, AlertIcon } from "./icons";

/** Turns a tool name like "search_documents" into "Searching documents". */
function humanizeTool(name: string, status: ToolBlock["status"]): string {
  const cleaned = name.replace(/[_-]+/g, " ").trim().toLowerCase();
  const looksLikeSearch = /search|retriev|lookup|find|query|document|knowledge|grep/.test(
    cleaned,
  );
  if (looksLikeSearch) {
    return status === "running" ? "Searching the documents" : "Searched the documents";
  }
  const verbFirst = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return status === "running" ? verbFirst : `${verbFirst} · done`;
}

function queryFromArgs(args?: Record<string, unknown>): string | null {
  if (!args) return null;
  for (const key of ["query", "question", "q", "text", "input", "search"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const first = Object.values(args).find((value) => typeof value === "string");
  return typeof first === "string" && first.trim() ? first.trim() : null;
}

function elapsed(block: ToolBlock): string | null {
  if (!block.endedAt) return null;
  const ms = block.endedAt - block.startedAt;
  if (ms < 950) return `${Math.max(1, Math.round(ms / 100) * 100)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function ToolStep({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(false);
  const running = block.status === "running";
  const errored = block.status === "error";
  const query = queryFromArgs(block.args);
  const time = elapsed(block);
  const foundCount = block.sources.length;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-xl border text-sm transition-colors",
        running
          ? "sweep border-brand-line bg-brand-soft/70"
          : errored
            ? "border-danger-line bg-danger-soft/60"
            : "border-line bg-surface-2/80",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span
          className={[
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
            running
              ? "bg-brand text-brand-on"
              : errored
                ? "bg-danger text-white"
                : "bg-brand/12 text-brand",
          ].join(" ")}
        >
          {running ? (
            <SearchIcon className="h-3.5 w-3.5 animate-pulse" />
          ) : errored ? (
            <AlertIcon className="h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={[
                "font-medium",
                running ? "text-brand-strong" : errored ? "text-danger" : "text-ink-soft",
              ].join(" ")}
            >
              {humanizeTool(block.name, block.status)}
              {running ? (
                <span className="inline-flex w-4 justify-start">
                  <span className="dot-1">.</span>
                  <span className="dot-2">.</span>
                  <span className="dot-3">.</span>
                </span>
              ) : null}
            </span>
            {query ? (
              <span className="truncate font-mono text-[11px] text-muted">
                &ldquo;{query}&rdquo;
              </span>
            ) : null}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2 text-[11px] text-faint">
          {!running && foundCount > 0 ? (
            <span className="rounded-full bg-brand/10 px-1.5 py-0.5 font-medium text-brand">
              {foundCount} source{foundCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {time ? <span className="tabular-nums">{time}</span> : null}
          <ChevronIcon
            className={[
              "h-3.5 w-3.5 transition-transform",
              open ? "rotate-90" : "",
            ].join(" ")}
          />
        </span>
      </button>

      {open ? (
        <div className="animate-fade border-t border-line/70 px-3 pb-3 pt-2.5 text-[13px]">
          {query ? (
            <p className="mb-2 text-muted">
              <span className="font-medium text-ink-soft">Query:</span> {query}
            </p>
          ) : null}
          {foundCount > 0 ? (
            <ul className="space-y-1.5">
              {block.sources.map((source, index) => (
                <li
                  key={`${source.doc}-${index}`}
                  className="flex items-start gap-2 rounded-lg bg-surface px-2.5 py-1.5"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11px] text-ink-soft">
                      {source.doc}
                      {source.section ? ` § ${source.section}` : ""}
                    </span>
                    {typeof source.score === "number" ? (
                      <span className="text-[10px] text-faint">
                        similarity {source.score.toFixed(2)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : errored ? (
            <p className="text-danger">This step did not complete.</p>
          ) : (
            <p className="text-muted">
              {running ? "Running…" : "No structured sources were returned for this step."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
