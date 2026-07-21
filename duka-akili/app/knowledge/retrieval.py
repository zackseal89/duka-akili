"""Retrieval over the business's own documents.

Chunks are split by markdown section, embedded with the Gemini embedding API,
and searched by cosine similarity in numpy. The document set is small and
fixed, so embeddings are precomputed into a JSON cache by
`scripts/build_index.py` and simply loaded at runtime. That keeps the Cloud
Run container light and cold starts fast, with no vector database to operate.
"""

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
CACHE_FILE = Path(__file__).resolve().parent / "embeddings.json"

EMBED_MODEL = "gemini-embedding-001"

_INDEX = None


@dataclass
class Chunk:
    doc: str
    title: str
    section: str
    text: str
    # True for documents added at runtime through the upload endpoint. Defaults
    # to False so entries in the prebuilt cache still load unchanged.
    uploaded: bool = False


def _split_sections(text, doc_title):
    """Split a markdown file into (section_heading, section_body) chunks."""
    parts = re.split(r"\n(?=## )", text)
    chunks = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        heading_match = re.match(r"##\s+(.+)", part)
        heading = heading_match.group(1).strip() if heading_match else doc_title
        chunks.append((heading, part))
    return chunks


def load_chunks():
    """Read every markdown file in docs/ and split into section chunks."""
    chunks = []
    for path in sorted(DOCS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        title_match = re.match(r"#\s+(.+)", text)
        title = title_match.group(1).strip() if title_match else path.stem
        for section, body in _split_sections(text, title):
            chunks.append(Chunk(doc=path.name, title=title, section=section, text=body))
    return chunks


_CLIENT = None


def _client():
    # Held at module level. A client created per call can be garbage collected
    # while its request is still in flight, which surfaces as
    # "Cannot send a request, as the client has been closed".
    global _CLIENT
    if _CLIENT is None:
        from google import genai

        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. The agent needs it for both the "
                "Gemma model and document embeddings."
            )
        _CLIENT = genai.Client(api_key=key)
    return _CLIENT


def embed_texts(texts, task_type):
    """Embed a batch of texts. task_type separates queries from documents."""
    from google.genai import types

    response = _client().models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    vectors = np.array([e.values for e in response.embeddings], dtype=np.float32)
    # Normalise so cosine similarity is a plain dot product.
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.clip(norms, 1e-9, None)


class Index:
    def __init__(self, chunks, matrix):
        self.chunks = chunks
        self._matrix = matrix

    def search(self, query, k=5):
        if not self.chunks:
            return []
        q = embed_texts([query], "RETRIEVAL_QUERY")[0]
        scores = self._matrix @ q
        order = np.argsort(-scores)[:k]
        return [(self.chunks[i], float(scores[i])) for i in order]

    def documents(self):
        """Summarise what is currently indexed, one entry per document."""
        summary = {}
        for chunk in self.chunks:
            entry = summary.setdefault(
                chunk.doc,
                {
                    "document": chunk.doc,
                    "title": chunk.title,
                    "sections": [],
                    "chunks": 0,
                    "uploaded": chunk.uploaded,
                },
            )
            entry["sections"].append(chunk.section)
            entry["chunks"] += 1
        return list(summary.values())

    def add(self, chunks, vectors):
        """Append newly embedded chunks to the live index."""
        self.chunks.extend(chunks)
        self._matrix = (
            vectors if self._matrix.size == 0 else np.vstack([self._matrix, vectors])
        )

    def remove(self, doc):
        """Drop a document from the live index. Returns how many chunks went."""
        keep = [i for i, c in enumerate(self.chunks) if c.doc != doc]
        removed = len(self.chunks) - len(keep)
        if removed:
            self.chunks = [self.chunks[i] for i in keep]
            self._matrix = (
                self._matrix[keep] if keep else np.zeros((0, self._matrix.shape[1]),
                                                         dtype=np.float32)
            )
        return removed


def add_document(filename, text):
    """Chunk, embed and index a markdown document at runtime.

    Returns the full breakdown of what happened, so the interface can show the
    pipeline rather than just claiming it ran.

    Note this lives in the process's memory: a container restart drops uploads
    and returns to the prebuilt document set. That is deliberate for a demo,
    since it needs no database and every session starts from a known state.
    """
    import time

    started = time.time()

    title_match = re.match(r"#\s+(.+)", text)
    title = title_match.group(1).strip() if title_match else Path(filename).stem
    sections = _split_sections(text, title)
    if not sections:
        raise ValueError("No readable content found in that file.")

    chunks = [
        Chunk(doc=filename, title=title, section=section, text=body, uploaded=True)
        for section, body in sections
    ]

    index = get_index()
    index.remove(filename)  # replace on re-upload rather than duplicating
    vectors = embed_texts([c.text for c in chunks], "RETRIEVAL_DOCUMENT")
    index.add(chunks, vectors)

    return {
        "document": filename,
        "title": title,
        "chunks_created": len(chunks),
        "embedding_model": EMBED_MODEL,
        "embedding_dimensions": int(vectors.shape[1]),
        "seconds": round(time.time() - started, 2),
        "total_chunks_indexed": len(index.chunks),
        "total_documents_indexed": len(index.documents()),
        "sections": [
            {
                "section": c.section,
                "characters": len(c.text),
                "preview": c.text[:180].replace("\n", " ").strip(),
            }
            for c in chunks
        ],
    }


def build_and_cache():
    """Embed every chunk and write the cache. Run once, offline, at build time."""
    chunks = load_chunks()
    vectors = embed_texts([c.text for c in chunks], "RETRIEVAL_DOCUMENT")
    CACHE_FILE.write_text(
        json.dumps(
            {
                "model": EMBED_MODEL,
                "chunks": [
                    {"doc": c.doc, "title": c.title, "section": c.section, "text": c.text}
                    for c in chunks
                ],
                "vectors": vectors.tolist(),
            }
        ),
        encoding="utf-8",
    )
    return len(chunks)


def get_index():
    """Load the cached index once and reuse it across tool calls."""
    global _INDEX
    if _INDEX is None:
        if not CACHE_FILE.exists():
            raise RuntimeError(
                "Embedding cache is missing. Run: python scripts/build_index.py"
            )
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        chunks = [Chunk(**c) for c in data["chunks"]]
        matrix = np.array(data["vectors"], dtype=np.float32)
        _INDEX = Index(chunks, matrix)
    return _INDEX
