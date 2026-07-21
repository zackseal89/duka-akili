"use client";

import { KNOWLEDGE_DOCS, STARTER_PROMPTS, DOC_KIND_LABEL } from "@/lib/documents";
import { BookIcon, DocIcon, ScaleIcon, SearchIcon, SparkIcon } from "./icons";

const HOW_IT_WORKS = [
  {
    icon: SearchIcon,
    title: "Grounded in your papers",
    body: "Answers come only from your own documents. No document, no answer.",
  },
  {
    icon: DocIcon,
    title: "Always cited",
    body: "Every reply shows the document and section it used, so you can check it.",
  },
  {
    icon: ScaleIcon,
    title: "Flags contradictions",
    body: "When two of your documents disagree, it says so instead of guessing.",
  },
];

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="animate-fade mx-auto w-full max-w-3xl py-6 sm:py-10">
      <div className="mb-8 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft/70 px-3 py-1 text-xs font-medium text-brand-strong">
          <SparkIcon className="h-3.5 w-3.5" />
          Grounded business assistant for your duka
        </span>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          Ask about your shop&rsquo;s own rules,
          <br className="hidden sm:block" /> in English or Kiswahili.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Duka Akili reads your supplier contracts, staff handbook, pricing policy and KRA
          guide, then answers with the exact section it used, na kwa lugha unayopenda.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-line bg-surface/70 p-4 shadow-card"
          >
            <span className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Icon className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
          <SparkIcon className="h-3.5 w-3.5 text-accent" />
          Try one of these
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt.text}
              type="button"
              onClick={() => onPick(prompt.text)}
              className={[
                "group flex items-start gap-3 rounded-xl border bg-surface/70 p-3.5 text-left shadow-card transition",
                prompt.highlight
                  ? "border-warn-line/70 hover:border-warn hover:bg-warn-soft/60"
                  : "border-line hover:border-brand-line hover:bg-brand-soft/40",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
                  prompt.highlight
                    ? "bg-warn/15 text-warn"
                    : "bg-brand/12 text-brand",
                ].join(" ")}
              >
                {prompt.highlight ? <ScaleIcon className="h-3.5 w-3.5" /> : "?"}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink group-hover:text-ink">
                  {prompt.text}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  {prompt.lang === "sw" ? (
                    <span className="rounded bg-accent-soft px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-accent">
                      Kiswahili
                    </span>
                  ) : null}
                  <span className="text-[11px] text-faint">{prompt.hint}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-5">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
          <BookIcon className="h-3.5 w-3.5 text-brand" />
          What it knows about ({KNOWLEDGE_DOCS.length} documents)
        </p>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {KNOWLEDGE_DOCS.map((doc) => (
            <li key={doc.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-brand shadow-card">
                <DocIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-ink">{doc.label}</span>
                  <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-brand">
                    {DOC_KIND_LABEL[doc.kind]}
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                  {doc.blurb}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
