"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { registerLiveDocuments } from "@/lib/documents";
import {
  ACCEPTED_EXTENSIONS,
  deleteDocument,
  fetchDocuments,
  uploadDocument,
  validateFile,
  type IndexedDoc,
  type IngestResult,
} from "@/lib/documents-api";
import { BookIcon, DocIcon, SparkIcon } from "./icons";

/**
 * The library shows what the agent can actually retrieve, read live from the
 * service rather than from a static catalog, and lets a new document be added.
 *
 * The upload deliberately narrates its own pipeline. Splitting and embedding
 * decide retrieval quality and are normally invisible, so the stages are shown
 * as they happen and the resulting chunks are listed afterwards.
 */

type Stage = "reading" | "splitting" | "embedding" | "indexing" | "done";

const STAGE_LABELS: Record<Stage, string> = {
  reading: "Reading the file",
  splitting: "Splitting into sections",
  // Names the embedding step generically. The exact model is reported by the
  // service in the result below, so hardcoding a name here would risk stating
  // something the backend contradicts.
  embedding: "Embedding each section",
  indexing: "Adding to the search index",
  done: "Indexed",
};

const STAGE_ORDER: Stage[] = ["reading", "splitting", "embedding", "indexing"];

export function DocumentLibrary({
  agentUrl,
  onClose,
  onAsk,
}: {
  agentUrl: string;
  onClose: () => void;
  onAsk: (prompt: string) => void;
}) {
  const [docs, setDocs] = useState<IndexedDoc[] | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDocuments(agentUrl);
      setDocs(data.documents);
      setTotalChunks(data.total_chunks);
      // Keep the citation resolver in step, so a question asked immediately
      // after an upload resolves its citations without a page reload.
      registerLiveDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the agent.");
    }
  }, [agentUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ingest = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);

      const problem = validateFile(file);
      if (problem) {
        setError(problem);
        return;
      }

      // The stages before the request are genuinely instant. They are stepped
      // through so the pipeline is legible, then the embedding stage sits for
      // however long the API actually takes.
      setStage("reading");
      await new Promise((r) => setTimeout(r, 220));
      setStage("splitting");
      await new Promise((r) => setTimeout(r, 260));
      setStage("embedding");

      try {
        const ingested = await uploadDocument(agentUrl, file);
        setStage("indexing");
        await new Promise((r) => setTimeout(r, 200));
        setResult(ingested);
        setStage("done");
        await refresh();
      } catch (err) {
        setStage(null);
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    },
    [agentUrl, refresh],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void ingest(file);
  };

  const remove = async (name: string) => {
    setError(null);
    try {
      await deleteDocument(agentUrl, name);
      if (result?.document === name) {
        setResult(null);
        setStage(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove it.");
    }
  };

  const busy = stage !== null && stage !== "done";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close document library"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
      />

      <aside className="animate-slide relative flex h-full w-full max-w-xl flex-col border-l border-line bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <BookIcon className="h-4 w-4 text-brand" />
              Company documents
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {docs
                ? `${docs.length} indexed, ${totalChunks} searchable sections`
                : "Loading what the agent knows..."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand-line hover:text-ink"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ---------------------------------------------------- upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={[
              "rounded-xl border-2 border-dashed p-5 text-center transition",
              dragging
                ? "border-brand bg-brand-soft/60"
                : "border-line bg-surface-2/50 hover:border-brand-line",
            ].join(" ")}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void ingest(file);
                e.target.value = "";
              }}
            />
            <p className="text-sm font-medium text-ink">
              Add a document the shop actually uses
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
              Drop a markdown file here, or{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand underline underline-offset-2 disabled:opacity-50"
              >
                choose a file
              </button>
              . It is split by section, embedded, and searchable straight away.
            </p>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-warn-line bg-warn-soft/60 px-3 py-2 text-[13px] text-warn">
              {error}
            </p>
          ) : null}

          {/* -------------------------------------------------- pipeline */}
          {stage ? (
            <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
                Indexing pipeline
              </p>
              <ol className="space-y-2">
                {STAGE_ORDER.map((s) => {
                  const index = STAGE_ORDER.indexOf(s);
                  const current =
                    stage === "done" ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage);
                  const state =
                    index < current ? "done" : index === current ? "active" : "todo";
                  return (
                    <li key={s} className="flex items-center gap-2.5 text-[13px]">
                      <span
                        className={[
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          state === "done"
                            ? "bg-brand text-white"
                            : state === "active"
                              ? "animate-pulse bg-brand/20 text-brand"
                              : "bg-line/60 text-faint",
                        ].join(" ")}
                      >
                        {state === "done" ? "✓" : index + 1}
                      </span>
                      <span
                        className={
                          state === "todo" ? "text-faint" : "font-medium text-ink"
                        }
                      >
                        {STAGE_LABELS[s]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {/* ---------------------------------------------------- result */}
          {result ? (
            <div className="animate-fade mt-4 rounded-xl border border-brand-line bg-brand-soft/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <SparkIcon className="h-4 w-4 text-brand" />
                {result.title}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-4">
                {[
                  ["Sections", String(result.chunks_created)],
                  ["Dimensions", String(result.embedding_dimensions)],
                  ["Took", `${result.seconds}s`],
                  ["Index total", `${result.total_chunks_indexed} chunks`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-faint">{label}</dt>
                    <dd className="font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] text-muted">
                Embedded with{" "}
                <code className="rounded bg-surface px-1 py-px">
                  {result.embedding_model}
                </code>
              </p>

              <ul className="mt-3 space-y-1.5">
                {result.sections.map((section) => (
                  <li
                    key={section.section}
                    className="rounded-lg border border-line/70 bg-surface/80 px-3 py-2"
                  >
                    <p className="flex items-baseline justify-between gap-2 text-[12px] font-medium text-ink">
                      <span className="truncate">{section.section}</span>
                      <span className="shrink-0 text-[11px] font-normal text-faint">
                        {section.characters} chars
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">
                      {section.preview}
                    </p>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => {
                  onAsk(`What does ${result.title} say?`);
                  onClose();
                }}
                className="mt-3 w-full rounded-lg bg-brand px-3 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
              >
                Ask a question about it
              </button>
            </div>
          ) : null}

          {/* ------------------------------------------------- documents */}
          <div className="mt-6">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-faint">
              Currently indexed
            </p>
            {docs === null ? (
              <p className="text-[13px] text-muted">Loading...</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.document}
                    className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-brand shadow-card">
                      <DocIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-medium text-ink">
                          {doc.title}
                        </span>
                        {doc.uploaded ? (
                          <span className="rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-accent">
                            Uploaded
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-faint">
                        {doc.document} · {doc.chunks} sections
                      </span>
                    </span>
                    {doc.uploaded ? (
                      <button
                        type="button"
                        onClick={() => void remove(doc.document)}
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-warn-soft hover:text-warn"
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Uploaded documents live in the running service and are cleared when it
              restarts, so every demo starts from the same six documents.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
