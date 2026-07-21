"use client";

import { AnswerText } from "./AnswerText";
import { findDoc } from "@/lib/documents";
import { AlertIcon, ScaleIcon } from "./icons";

/**
 * The standout surface: when the agent reports that two of the shop's own
 * documents disagree, the answer is wrapped in this amber card so it is
 * impossible to mistake for a normal reply.
 */
export function ConflictCard({
  text,
  streaming,
  documents,
}: {
  text: string;
  streaming: boolean;
  documents: string[];
}) {
  const named = documents.map((id) => findDoc(id)?.label ?? id);

  return (
    <div className="animate-rise overflow-hidden rounded-2xl border-2 border-warn-line bg-warn-soft shadow-float">
      <div className="flex items-center gap-2.5 border-b border-warn-line/70 bg-warn/10 px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warn text-white shadow-sm">
          <AlertIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warn-ink">Your documents disagree</p>
          <p className="text-[11px] text-warn-ink/75">
            Two sources give different rules. Read both before deciding.
          </p>
        </div>
        <ScaleIcon className="ml-auto hidden h-5 w-5 text-warn/70 sm:block" />
      </div>

      <div className="px-4 py-3.5">
        <div className="[&_.answer]:text-warn-ink [&_.answer_strong]:text-warn-ink [&_.answer_h3]:text-warn-ink">
          <AnswerText text={text} streaming={streaming} />
        </div>

        {named.length >= 2 ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-warn-line/60 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-warn-ink/70">
              In conflict
            </span>
            {named.map((label, index) => (
              <span key={`${label}-${index}`} className="flex items-center gap-2">
                {index > 0 ? (
                  <span className="text-warn-ink/50" aria-hidden="true">
                    vs
                  </span>
                ) : null}
                <span className="rounded-lg border border-warn-line bg-warn/5 px-2 py-1 text-xs font-medium text-warn-ink">
                  {label}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
