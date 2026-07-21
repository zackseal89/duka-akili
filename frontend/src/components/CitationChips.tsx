"use client";

import { useState } from "react";

import type { Citation } from "@/lib/chat-types";
import { DOC_KIND_LABEL, findDoc } from "@/lib/documents";
import { DocIcon } from "./icons";

function DocKindTag({ docId }: { docId: string }) {
  const doc = findDoc(docId);
  if (!doc) return null;
  return (
    <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-brand">
      {DOC_KIND_LABEL[doc.kind]}
    </span>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  const doc = findDoc(citation.doc);
  const title = doc?.label ?? citation.doc;
  const hasDetail = Boolean(citation.snippet || citation.section);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((value) => !value)}
        className={[
          "group flex max-w-full items-center gap-1.5 rounded-lg border border-brand-line/80 bg-brand-soft/60 px-2.5 py-1.5 text-left transition",
          hasDetail ? "cursor-pointer hover:border-brand hover:bg-brand-soft" : "cursor-default",
        ].join(" ")}
        aria-expanded={hasDetail ? open : undefined}
        title={citation.doc}
      >
        <DocIcon className="h-3.5 w-3.5 shrink-0 text-brand" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-brand-strong">{title}</span>
          </span>
          {citation.section ? (
            <span className="block truncate text-[11px] text-muted">§ {citation.section}</span>
          ) : null}
        </span>
      </button>

      {open && hasDetail ? (
        <div className="animate-rise absolute left-0 top-[calc(100%+0.4rem)] z-20 w-[min(22rem,80vw)] rounded-xl border border-line bg-surface p-3 shadow-pop">
          <div className="mb-1.5 flex items-center gap-2">
            <DocKindTag docId={citation.doc} />
          </div>
          <p className="mb-1 font-mono text-[11px] text-ink-soft">
            {citation.doc}
            {citation.section ? ` § ${citation.section}` : ""}
          </p>
          {citation.snippet ? (
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft scroll-paper">
              {citation.snippet}
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              {doc?.title ?? "Referenced in the answer above."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CitationChips({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-3.5 border-t border-line/70 pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        <span className="h-1 w-1 rounded-full bg-brand" />
        Grounded in
      </p>
      <div className="flex flex-wrap gap-2">
        {citations.map((citation, index) => (
          <CitationChip key={`${citation.doc}-${citation.section ?? ""}-${index}`} citation={citation} />
        ))}
      </div>
    </div>
  );
}
