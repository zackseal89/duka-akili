from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

from dotenv import load_dotenv
import httpx

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass
class LLMConfig:
    api_key: str = os.getenv("LLM_API_KEY", "")
    base_url: str = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
    model: str = os.getenv("LLM_MODEL", "google/gemma-4-31b-it:free")
    system_prompt: str = os.getenv(
        "LLM_SYSTEM_PROMPT",
        "You are a helpful WhatsApp assistant. Keep replies short, natural, and friendly.",
    )


class LLMClient:
    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig()
        self._client = httpx.Client(
            base_url=self.config.base_url,
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
            timeout=120.0,
        )

    def chat(
        self,
        user_message: Union[str, list[dict]],
        history: Optional[list[dict]] = None,
    ) -> str:
        if not self.config.api_key:
            raise RuntimeError("LLM_API_KEY is not set")
        messages = [{"role": "system", "content": self.config.system_prompt}]
        if history:
            messages.extend(history)
        if isinstance(user_message, list):
            messages.append({"role": "user", "content": user_message})
        else:
            messages.append({"role": "user", "content": user_message})
        try:
            response = self._client.post(
                "/chat/completions",
                json={
                    "model": self.config.model,
                    "messages": messages,
                    "max_tokens": 1024,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                return "I'm currently rate-limited. Please try again in a minute."
            return f"LLM error: {e.response.status_code}"
        except Exception as e:
            return f"LLM error: {e}"
