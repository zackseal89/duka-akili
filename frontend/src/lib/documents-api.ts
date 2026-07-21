/**
 * Client for the agent's document endpoints.
 *
 * These talk to the same FastAPI service that serves the agent, so the
 * document list reflects what the agent can actually retrieve right now,
 * rather than a hardcoded catalog that can drift out of sync with it.
 */

export interface IndexedDoc {
  document: string;
  title: string;
  sections: string[];
  chunks: number;
  uploaded: boolean;
}

export interface DocumentsResponse {
  documents: IndexedDoc[];
  total_chunks: number;
}

/** One section of an uploaded document, as it was chunked for embedding. */
export interface IndexedSection {
  section: string;
  characters: number;
  preview: string;
}

/** The full breakdown of what indexing a document actually did. */
export interface IngestResult {
  document: string;
  title: string;
  chunks_created: number;
  embedding_model: string;
  embedding_dimensions: number;
  seconds: number;
  total_chunks_indexed: number;
  total_documents_indexed: number;
  sections: IndexedSection[];
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // fall through to the status text
  }
  return `${response.status} ${response.statusText}`;
}

export async function fetchDocuments(agentUrl: string): Promise<DocumentsResponse> {
  const response = await fetch(`${agentUrl}/api/documents`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function uploadDocument(
  agentUrl: string,
  file: File,
): Promise<IngestResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${agentUrl}/api/documents`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function deleteDocument(
  agentUrl: string,
  name: string,
): Promise<void> {
  const response = await fetch(
    `${agentUrl}/api/documents/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/** Accepted by the backend. Anything else is rejected before upload. */
export const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".txt"];
export const MAX_UPLOAD_BYTES = 512_000;

export function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Upload a markdown or text file (.md, .markdown, .txt).";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That file is larger than 500 KB.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}
