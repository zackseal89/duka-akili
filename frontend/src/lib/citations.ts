/**
 * Turning grounded answers into citation chips.
 *
 * Two independent sources feed the chips:
 *
 *  1. The tool responses. When the retrieval tool returns structured chunks we
 *     read the doc / section / text fields straight off the JSON. This is the
 *     most reliable signal and it also gives us the retrieved snippet.
 *  2. The answer text itself. The agent is instructed to name its sources, so
 *     we scan for filenames and for the documents' human titles.
 *
 * Everything is defensive. Unknown tool response shapes yield no citations
 * rather than throwing.
 */

import type { Citation } from "./chat-types";
import { KNOWLEDGE_DOCS, findDoc } from "./documents";

/* -------------------------------------------------------------------------- */
/* Section resolution                                                         */
/* -------------------------------------------------------------------------- */

const SECTION_NUMBER = /^\s*(?:§|#)?\s*(?:section|sehemu)?\s*([0-9]+(?:\.[0-9]+)*)/i;

/**
 * Maps a loosely written section reference onto the real heading from the
 * document catalog, so "§ 2" becomes "2. Returns and Damaged Stock".
 */
export function resolveSection(
  docId: string,
  raw: string | null | undefined,
): string | undefined {
  const doc = findDoc(docId);
  const cleaned = (raw ?? "").replace(/^[\s§#,:.-]+|[\s,;.]+$/g, "").trim();
  if (!doc) return cleaned || undefined;
  if (!cleaned) return undefined;

  const lower = cleaned.toLowerCase();

  // Exact or contained match against a known heading.
  const byText = doc.sections.find(
    (section) =>
      section.toLowerCase() === lower ||
      section.toLowerCase().includes(lower) ||
      lower.includes(section.toLowerCase()),
  );
  if (byText) return byText;

  // Numeric match: "§ 2", "Section 4.2".
  const numberMatch = SECTION_NUMBER.exec(cleaned);
  if (numberMatch) {
    const number = numberMatch[1];
    const byNumber = doc.sections.find(
      (section) => section.startsWith(`${number}.`) || section.startsWith(`${number} `),
    );
    if (byNumber) return byNumber;
  }

  return cleaned;
}

/* -------------------------------------------------------------------------- */
/* Citations from the answer text                                             */
/* -------------------------------------------------------------------------- */

// filename.md optionally followed by a section reference such as
// "§ 2. Returns", ", Section 4.2", " - 4.2 Damaged or torn stock".
const FILE_CITATION =
  /([A-Za-z0-9_\-]+\.md)\s*(?:[(,:–-]?\s*(?:§|#|section|sec\.|sehemu)\s*([^)\]\n,;"]{1,80}))?/gi;

function pushCitation(
  into: Map<string, Citation>,
  citation: Citation,
): void {
  const key = `${citation.doc.toLowerCase()}::${(citation.section ?? "").toLowerCase()}`;
  const existing = into.get(key);
  if (!existing) {
    into.set(key, citation);
    return;
  }
  // Keep the richest version of a repeated citation.
  into.set(key, {
    ...existing,
    section: existing.section ?? citation.section,
    snippet: existing.snippet ?? citation.snippet,
    score: existing.score ?? citation.score,
  });
}

/** Finds citations written into the answer prose. */
export function citationsFromText(text: string): Citation[] {
  const found = new Map<string, Citation>();
  if (!text) return [];

  FILE_CITATION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_CITATION.exec(text)) !== null) {
    const doc = findDoc(match[1]);
    if (!doc) continue;
    pushCitation(found, {
      doc: doc.id,
      section: resolveSection(doc.id, match[2]),
      origin: "answer",
    });
  }

  // Also catch prose references such as "the Staff Handbook says ...".
  const lower = text.toLowerCase();
  for (const doc of KNOWLEDGE_DOCS) {
    const alreadyCited = [...found.values()].some((citation) => citation.doc === doc.id);
    if (alreadyCited) continue;
    const names = [doc.title.toLowerCase(), ...doc.aliases];
    if (!names.some((name) => name.length > 3 && lower.includes(name))) continue;

    // Try to attach a section the answer mentions for this document.
    const section = doc.sections.find((heading) => {
      const bare = heading.replace(/^[0-9.]+\s*/, "").toLowerCase();
      return bare.length > 4 && lower.includes(bare);
    });
    pushCitation(found, { doc: doc.id, section, origin: "answer" });
  }

  return [...found.values()];
}

/* -------------------------------------------------------------------------- */
/* Citations from tool responses                                              */
/* -------------------------------------------------------------------------- */

const DOC_KEYS = ["doc", "document", "doc_name", "docname", "source", "file", "filename", "path"];
const SECTION_KEYS = ["section", "heading", "section_title", "sectiontitle", "anchor"];
const SNIPPET_KEYS = ["text", "snippet", "content", "body", "chunk", "excerpt", "passage"];
const SCORE_KEYS = ["score", "similarity", "relevance", "distance"];

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of Object.keys(record)) {
    if (!keys.includes(key.toLowerCase())) continue;
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of Object.keys(record)) {
    if (!keys.includes(key.toLowerCase())) continue;
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

const BARE_FILENAME = /^[A-Za-z0-9_\-./\\]+\.md$/;

/**
 * Walks an arbitrary tool response looking for anything that identifies a
 * source document. Handles objects, nested objects, arrays and bare filename
 * strings, and stops at a sane depth so a pathological payload cannot hang.
 */
export function citationsFromToolResponse(response: unknown): Citation[] {
  const found = new Map<string, Citation>();

  const visit = (node: unknown, depth: number): void => {
    if (node == null || depth > 6) return;

    if (typeof node === "string") {
      if (!BARE_FILENAME.test(node.trim())) return;
      const doc = findDoc(node);
      if (doc) pushCitation(found, { doc: doc.id, origin: "retrieval" });
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node.slice(0, 40)) visit(item, depth + 1);
      return;
    }

    if (typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const rawDoc = readString(record, DOC_KEYS);
    const doc = findDoc(rawDoc);
    if (doc) {
      const snippet = readString(record, SNIPPET_KEYS);
      pushCitation(found, {
        doc: doc.id,
        section: resolveSection(doc.id, readString(record, SECTION_KEYS)),
        snippet: snippet ? snippet.slice(0, 600) : undefined,
        score: readNumber(record, SCORE_KEYS),
        origin: "retrieval",
      });
    }

    for (const value of Object.values(record)) visit(value, depth + 1);
  };

  try {
    visit(response, 0);
  } catch {
    return [];
  }
  return [...found.values()];
}

/* -------------------------------------------------------------------------- */
/* Merging                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Citations to show under an answer. Answer citations lead, because they are
 * what the agent actually used. Retrieval citations enrich them with snippets
 * and fill in when the answer names no source at all.
 */
export function mergeCitations(
  fromAnswer: Citation[],
  fromRetrieval: Citation[],
): Citation[] {
  if (fromAnswer.length === 0) return dedupeByDoc(fromRetrieval);

  const retrievalByDoc = new Map<string, Citation[]>();
  for (const citation of fromRetrieval) {
    const list = retrievalByDoc.get(citation.doc) ?? [];
    list.push(citation);
    retrievalByDoc.set(citation.doc, list);
  }

  return fromAnswer.map((citation) => {
    const candidates = retrievalByDoc.get(citation.doc) ?? [];
    const match =
      candidates.find(
        (candidate) =>
          citation.section &&
          candidate.section &&
          candidate.section.toLowerCase() === citation.section.toLowerCase(),
      ) ?? candidates[0];
    if (!match) return citation;
    return {
      ...citation,
      section: citation.section ?? match.section,
      snippet: citation.snippet ?? match.snippet,
      score: citation.score ?? match.score,
    };
  });
}

/** Collapses several sections of the same document down to one chip each. */
function dedupeByDoc(citations: Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const citation of citations) {
    const existing = seen.get(citation.doc);
    if (!existing) {
      seen.set(citation.doc, citation);
      continue;
    }
    if (!existing.section && citation.section) seen.set(citation.doc, citation);
  }
  return [...seen.values()];
}

export function citationLabel(citation: Citation): string {
  return citation.section ? `${citation.doc} § ${citation.section}` : citation.doc;
}
