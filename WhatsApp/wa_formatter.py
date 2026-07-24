from __future__ import annotations

import re


_BOLD = re.compile(r"\*\*(.+?)\*\*")
_ITALIC = re.compile(r"__(.+?)__")
_CODE = re.compile(r"`([^`]+)`")
_HEADING = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_BULLET = re.compile(r"^[\-\*]\s+", re.MULTILINE)


def clean_for_whatsapp(text: str) -> str:
    text = _HEADING.sub("", text)
    text = _BOLD.sub(r"*\1*", text)
    text = _ITALIC.sub(r"_\1_", text)
    text = _CODE.sub(r"`\1`", text)
    text = _LINK.sub(r"\1", text)
    text = _BULLET.sub("• ", text)
    return text.strip()


def format_reply(text: str, citations: list[dict]) -> str:
    text = clean_for_whatsapp(text)
    if not text:
        return ""

    lines = [text]

    seen: set[str] = set()
    footnotes: list[str] = []
    for c in citations:
        doc = (c.get("doc") or c.get("document") or "").strip()
        section = (c.get("section") or c.get("heading") or "").strip()
        snippet = (c.get("text") or c.get("snippet") or "").strip()

        if not doc:
            continue
        key = f"{doc}::{section}"
        if key in seen:
            continue
        seen.add(key)

        parts = [doc]
        if section:
            parts.append(f"§ {section}")
        if snippet:
            snippet = clean_for_whatsapp(snippet)
            parts.append(f"\"{snippet[:120].replace(chr(10), ' ')}\"")
        footnotes.append(" — ".join(parts))

    if footnotes:
        lines.append("")
        lines.append("Sources:")
        for i, fn in enumerate(footnotes, 1):
            lines.append(f"{i}. {fn}")

    return "\n".join(lines).strip()


def extract_citations(event: dict) -> list[dict]:
    citations: list[dict] = []
    for part in (event.get("content") or {}).get("parts") or []:
        fr = part.get("functionResponse") or part.get("function_response")
        if not fr:
            continue
        response = fr.get("response")
        if isinstance(response, dict):
            passages = response.get("passages") or []
            for p in passages:
                if isinstance(p, dict):
                    citations.append(p)
            sources = response.get("sources") or {}
            for doc, src in sources.items():
                if isinstance(src, dict):
                    c = {"doc": doc}
                    c.update(src)
                    citations.append(c)
    return citations
