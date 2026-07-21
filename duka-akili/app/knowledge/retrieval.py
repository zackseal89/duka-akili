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
        q = embed_texts([query], "RETRIEVAL_QUERY")[0]
        scores = self._matrix @ q
        order = np.argsort(-scores)[:k]
        return [(self.chunks[i], float(scores[i])) for i in order]


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
