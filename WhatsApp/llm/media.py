from __future__ import annotations

import base64
import os
from typing import Optional

from neonize.proto.Neonize_pb2 import Message as MessageProto
from llm.client import LLMClient


def build_user_payload(message: MessageProto, client) -> list[dict] | str | None:
    content = _extract(message)
    if content is None:
        return None
    if isinstance(content, str):
        return content
    text_parts = [p for p in content if p["type"] == "text"]
    image_parts = [p for p in content if p["type"] == "image_url"]

    if not image_parts:
        return " ".join(p["text"] for p in text_parts) or None

    payload: list[dict] = []
    if text_parts:
        payload.append({"type": "text", "text": " ".join(p["text"] for p in text_parts)})
    payload.extend(image_parts)
    return payload


def _extract(message: MessageProto) -> list[dict] | str | None:
    if not message.HasField("Message"):
        return None
    inner = message.Message
    parts: list[dict] = []

    def _add_text(text: str):
        text = (text or "").strip()
        if text:
            parts.append({"type": "text", "text": text})

    if inner.HasField("conversation"):
        _add_text(inner.conversation)
        return " ".join(p["text"] for p in parts) or None

    if inner.HasField("extendedTextMessage"):
        _add_text(inner.extendedTextMessage.text)
        return " ".join(p["text"] for p in parts) or None

    if inner.HasField("imageMessage"):
        _add_text(inner.imageMessage.caption)
        mime = inner.imageMessage.mimetype or "image/jpeg"
        b64 = _encode_media(message, "imageMessage", mime)
        if b64:
            parts.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
        return parts or None

    if inner.HasField("videoMessage"):
        _add_text(inner.videoMessage.caption)
        return " ".join(p["text"] for p in parts) or "[Video received]"

    if inner.HasField("ptvMessage"):
        _add_text(inner.ptvMessage.caption)
        return " ".join(p["text"] for p in parts) or "[Video note received]"

    if inner.HasField("audioMessage"):
        return "[Audio message received]"

    if inner.HasField("documentMessage"):
        _add_text(inner.documentMessage.fileName)
        return " ".join(p["text"] for p in parts) or "[Document received]"

    if inner.HasField("stickerMessage"):
        return "[Sticker received]"

    if inner.HasField("contactMessage"):
        _add_text(inner.contactMessage.displayName or inner.contactMessage.vcard)
        return " ".join(p["text"] for p in parts) or "[Contact received]"

    if inner.HasField("locationMessage"):
        return "[Location shared]"

    if inner.HasField("viewOnceMessage"):
        return _extract(inner.viewOnceMessage)

    if inner.HasField("viewOnceMessageV2"):
        return _extract(inner.viewOnceMessageV2)

    if inner.HasField("ephemeralMessage"):
        return _extract(inner.ephemeralMessage)

    return None


def _encode_media(message: MessageProto, field: str, mime: str) -> Optional[str]:
    try:
        from authsession import client
        data = client.download_any(message)
        if data:
            return base64.b64encode(data).decode("utf-8")
    except Exception:
        pass
    return None
