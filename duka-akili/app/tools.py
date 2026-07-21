# ruff: noqa
"""Tools for the Duka Akili agent.

Design principle: the model retrieves and reasons, Python computes. Any
shilling figure the agent states comes from a function here, not from the
model's arithmetic, so a wrong number is traceable to code rather than to a
hallucination.
"""

import math
from typing import Any

from app.knowledge.retrieval import get_index

# gemini-embedding-001 has a compressed cosine similarity range: calibrated
# against this document set, clearly off-topic queries (wifi password, the
# weather, football) scored 0.55 to 0.60, while genuine matches scored 0.73
# and above. 0.65 sits in the gap with margin on both sides. This is what
# makes the refusal behaviour ("nothing in the documents covers this") work;
# too low a threshold and the tool always returns something, which the model
# will then dutifully cite even when it is not actually relevant.
RELEVANCE_THRESHOLD = 0.65


def search_business_documents(query: str) -> dict[str, Any]:
    """Search the business's own documents and return the passages that answer a question.

    Use this for any question about shop policy, supplier terms, staff
    procedure, pricing rules, or tax obligations. Always call this before
    answering such a question. Never answer from your own general knowledge.

    Args:
        query: What to look for, phrased as the user asked it. For example
            "how long to report damaged stock" or "turnover tax deadline".

    Returns:
        A dict with a `passages` list. Each passage carries the document
        filename, the section heading, the text, and a relevance score. If
        `passages` is empty, nothing in the business's documents covers the
        question and you must say so rather than guessing.
    """
    results = get_index().search(query, k=5)
    passages = [
        {
            "document": chunk.doc,
            "document_title": chunk.title,
            "section": chunk.section,
            "text": chunk.text,
            "relevance": round(score, 3),
        }
        for chunk, score in results
        if score > RELEVANCE_THRESHOLD
    ]
    return {
        "passages": passages,
        "documents_searched": 5,
        "note": (
            "No passage in the business documents matches this question."
            if not passages
            else "Cite the document and section for every claim you make."
        ),
    }


def compare_sources_on_topic(topic: str) -> dict[str, Any]:
    """Pull what every document says about one topic, so they can be compared for conflicts.

    Use this when the user asks what the rule is on something that more than
    one document might cover, or when they ask whether their records disagree.
    Returns the relevant passage from each distinct document separately so you
    can check whether they actually agree.

    Args:
        topic: The subject to compare across documents, for example
            "reporting damaged stock" or "paying delivery drivers in cash".

    Returns:
        A dict mapping each document to its most relevant passage, plus the
        effective dates where the documents state them. If two documents give
        different rules, say so explicitly and prefer the one with the later
        effective date, while telling the user both.
    """
    results = get_index().search(topic, k=10)
    by_doc: dict[str, dict[str, Any]] = {}
    for chunk, score in results:
        if score <= RELEVANCE_THRESHOLD:
            continue
        if chunk.doc not in by_doc:
            by_doc[chunk.doc] = {
                "document_title": chunk.title,
                "section": chunk.section,
                "text": chunk.text,
                "relevance": round(score, 3),
            }
    return {
        "sources": by_doc,
        "documents_with_something_to_say": len(by_doc),
        "note": (
            "Compare these passages carefully. If they state different rules "
            "for the same situation, that is a conflict in the business's own "
            "records and you must flag it clearly rather than picking one "
            "silently."
        ),
    }


def calculate_customer_discount(
    subtotal_kes: float,
    tier: str,
    manager_override_percent: float = 0.0,
) -> dict[str, Any]:
    """Apply the shop's written discount policy to a bill and show the working.

    Do not do this arithmetic yourself. Call this so the figure is computed by
    code. Look up the correct tier with search_business_documents first if the
    user has not stated it.

    Args:
        subtotal_kes: The bill total before any discount, in Kenyan shillings.
        tier: One of "walk-in", "regular", "wholesale", or "partner".
        manager_override_percent: Extra discount a manager authorised, 0 to 5.
            Only valid with a manager signature. Defaults to 0.

    Returns:
        A dict with the tier rate applied, the discount amount, the final
        total, and the policy rules that governed the calculation.
    """
    rates = {"walk-in": 0.0, "regular": 3.0, "wholesale": 7.0, "partner": 10.0}
    key = tier.strip().lower().replace(" ", "-")
    if key not in rates:
        return {
            "error": f"unknown tier '{tier}'",
            "valid_tiers": sorted(rates),
        }

    override = max(0.0, min(float(manager_override_percent), 5.0))
    override_capped = float(manager_override_percent) > 5.0

    tier_rate = rates[key]
    total_rate = tier_rate + override
    discount = subtotal_kes * total_rate / 100.0
    # Policy: round down to the nearest shilling in the customer's favour.
    final = math.floor(subtotal_kes - discount)

    return {
        "subtotal_kes": round(subtotal_kes, 2),
        "tier": key,
        "tier_discount_percent": tier_rate,
        "manager_override_percent": override,
        "manager_override_was_capped_at_5": override_capped,
        "total_discount_percent": total_rate,
        "discount_amount_kes": round(discount, 2),
        "final_total_kes": final,
        "rules_applied": [
            "Discounts do not stack; only the highest single tier applies.",
            "Totals are rounded down to the nearest shilling in the customer's favour.",
            "A manager override above 5 percent is not permitted by policy.",
        ],
    }
