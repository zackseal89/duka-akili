"""Precompute document embeddings into a cache checked into the repo.

Run this whenever the documents in app/docs/ change:

    python scripts/build_index.py

Doing this at build time rather than at startup keeps the deployed container
fast to boot and means a cold start costs no embedding API calls.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.knowledge.retrieval import CACHE_FILE, build_and_cache  # noqa: E402

if __name__ == "__main__":
    count = build_and_cache()
    size_kb = CACHE_FILE.stat().st_size / 1024
    print(f"embedded {count} chunks into {CACHE_FILE.name} ({size_kb:.0f} KB)")
