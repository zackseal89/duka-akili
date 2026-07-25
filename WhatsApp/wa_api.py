from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Iterator

from dotenv import load_dotenv
import httpx

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

AGENT_URL = os.getenv("AGENT_URL", "http://localhost:8000").rstrip("/")
APP_NAME = "app"


class DukaAkiliClient:
    def __init__(self, base_url: str = AGENT_URL):
        self.base_url = base_url
        self._client = httpx.Client(base_url=base_url, timeout=120.0)

    def create_session(self, user_id: str, state: dict | None = None) -> str:
        resp = self._client.post(
            f"/apps/{APP_NAME}/users/{httpx.utils.quote(user_id, safe='')}/sessions",
            json={"state": state} if state else {},
        )
        resp.raise_for_status()
        data = resp.json()
        session_id = data.get("id")
        if not session_id:
            raise RuntimeError("Agent session response missing id")
        return session_id

    def stream_events(self, user_id: str, session_id: str, text: str = "", image_b64: str | None = None, image_mime: str = "image/jpeg") -> Iterator[dict]:
        parts: list[dict] = []
        if image_b64:
            parts.append({
                "inline_data": {
                    "mime_type": image_mime,
                    "data": image_b64,
                },
            })
        if text:
            parts.append({"text": text})

        payload = {
            "app_name": APP_NAME,
            "user_id": user_id,
            "session_id": session_id,
            "new_message": {"role": "user", "parts": parts},
            "streaming": True,
        }
        resp = self._client.post(
            "/run_sse",
            json=payload,
            headers={"Accept": "text/event-stream"},
        )
        resp.raise_for_status()

        buffer = ""
        for chunk in resp.iter_bytes():
            buffer += chunk.decode("utf-8", errors="replace")
            while "\n\n" in buffer:
                block, _, buffer = buffer.partition("\n\n")
                data = _extract_data(block)
                if data is None:
                    continue
                if data == "[DONE]":
                    continue
                try:
                    event = httpx.Response(200, content=data).json()
                except Exception:
                    continue
                yield event

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()


def _extract_data(block: str) -> str | None:
    if not block or block.startswith(":"):
        return None
    if block.startswith("data:"):
        return block[5:].strip() or None
    return block.strip() or None
