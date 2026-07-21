"""Quick check that retrieval finds the right passages and refuses when it should.

    python scripts/smoke_retrieval.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.tools import (  # noqa: E402
    compare_sources_on_topic,
    search_business_documents,
)

QUERIES = [
    "how long do I have to report damaged stock",
    "when is turnover tax due",
    "what discount does a wholesale customer get",
    "can I pay the delivery driver in cash",
]

for query in QUERIES:
    result = search_business_documents(query)
    print(f"Q: {query}")
    for passage in result["passages"][:2]:
        print(f"   [{passage['relevance']}] {passage['document']} :: {passage['section']}")
    if not result["passages"]:
        print("   (nothing matched)")
    print()

print("=" * 70)
print("UNGROUNDED QUESTION, must return no passages")
print("=" * 70)
result = search_business_documents("what is the wifi password for the shop")
print(f"passages: {len(result['passages'])}")
print(f"note: {result['note']}")

print()
print("=" * 70)
print("CONFLICT DETECTION, damaged stock reporting window")
print("=" * 70)
result = compare_sources_on_topic("reporting damaged stock deadline")
for doc, info in result["sources"].items():
    print(f"  {doc}")
    print(f"    section: {info['section']}  (relevance {info['relevance']})")
print(f"  documents with something to say: {result['documents_with_something_to_say']}")

print()
print("=" * 70)
print("RAW SCORES for calibration (several clearly off-topic queries)")
print("=" * 70)
from app.knowledge.retrieval import get_index  # noqa: E402
idx = get_index()
for q in ["wifi password", "what is the weather today", "best football team",
          "how do I bake a cake", "reporting damaged stock deadline"]:
    results = idx.search(q, k=3)
    scores = ", ".join(f"{s:.3f}" for _, s in results)
    print(f"  {q:<32} top3: {scores}")
