"""End-to-end smoke test against a running `adk api_server`.

Usage (server must already be running on port 8123):
    python scripts/smoke_agent.py "your question here"
"""

import json
import sys
import uuid

import httpx

BASE = "http://localhost:8123"
APP = "app"
USER = "smoke-test"


def ask(question):
    session_id = str(uuid.uuid4())
    resp = httpx.post(
        f"{BASE}/apps/{APP}/users/{USER}/sessions/{session_id}",
        json={},
        timeout=30,
    )
    resp.raise_for_status()

    body = {
        "app_name": APP,
        "user_id": USER,
        "session_id": session_id,
        "new_message": {"role": "user", "parts": [{"text": question}]},
        "streaming": True,
    }

    text_out = []
    thinking_out = []
    tool_calls = []

    with httpx.stream("POST", f"{BASE}/run_sse", json=body, timeout=120) as resp:
        for line in resp.iter_lines():
            if not line.startswith("data: "):
                continue
            event = json.loads(line[len("data: "):])

            # ADK replays the whole assembled turn once more as a final
            # partial=false event. That replay is not new content, only an
            # end-of-turn marker, so it must be ignored here or every tool
            # call and the final answer get duplicated.
            if event.get("partial") is False:
                continue

            for part in (event.get("content") or {}).get("parts", []):
                if part.get("text"):
                    # thought=true means this is the model's internal planning
                    # narration, not the answer. Route it separately.
                    (thinking_out if part.get("thought") else text_out).append(part["text"])
                if part.get("functionCall"):
                    fc = part["functionCall"]
                    tool_calls.append(f"{fc.get('name')}({fc.get('args')})")
                if part.get("functionResponse"):
                    fr = part["functionResponse"]
                    resp_data = fr.get("response", {})
                    summary = json.dumps(resp_data)[:150]
                    tool_calls.append(f"  -> {fr.get('name')} returned: {summary}")

    return "".join(text_out), tool_calls, "".join(thinking_out)


if __name__ == "__main__":
    question = sys.argv[1] if len(sys.argv) > 1 else "How long do I have to report damaged stock?"
    print(f"Q: {question}\n")
    answer, calls, thinking = ask(question)
    print("TOOL CALLS:")
    for c in calls:
        print(f"  {c}")
    print(f"\nTHINKING (not shown to the user):\n{thinking[:400]}...")
    print(f"\nANSWER:\n{answer}")
