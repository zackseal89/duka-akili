import os
import threading
from pathlib import Path
from dotenv import load_dotenv
from neonize.events import event
from neonize.proto.Neonize_pb2 import Message as MessageProto
from handlers.messages import get_chat_type
import httpx
from wa_api import DukaAkiliClient
from wa_formatter import format_reply, extract_citations
from outgoing import send_reply


load_dotenv(Path(__file__).resolve().parents[1] / ".env")
OWNER_NUMBER = os.getenv("OWNER_NUMBER", "").strip()


_wa_sessions: dict[str, str] = {}
_session_lock = threading.Lock()
_wa_client = DukaAkiliClient()


def _ensure_session(chat_id: str) -> str:
    with _session_lock:
        if chat_id not in _wa_sessions:
            _wa_sessions[chat_id] = _wa_client.create_session(user_id=chat_id)
        return _wa_sessions[chat_id]


def is_owner(source) -> bool:
    if not OWNER_NUMBER:
        return True
    sender = source.Sender.User
    chat = source.Chat.User
    return sender == OWNER_NUMBER or chat == OWNER_NUMBER


def _ensure_session_valid(chat_id: str) -> str:
    with _session_lock:
        if chat_id not in _wa_sessions:
            _wa_sessions[chat_id] = _wa_client.create_session(user_id=chat_id)
            return _wa_sessions[chat_id]
    # Try the existing session; if it fails we recreate it on the next turn.
    return _wa_sessions[chat_id]


def _extract_text_and_image(message: MessageProto, client) -> tuple[str, str | None, str]:
    if not message.HasField("Message"):
        return "", None, ""
    inner = message.Message
    text = ""
    image_b64 = None
    mime = "image/jpeg"

    if inner.HasField("conversation"):
        text = (inner.conversation or "").strip()
        return text, None, ""

    if inner.HasField("extendedTextMessage"):
        text = (inner.extendedTextMessage.text or "").strip()
        return text, None, ""

    if inner.HasField("imageMessage"):
        text = (inner.imageMessage.caption or "").strip()
        mime = inner.imageMessage.mimetype or "image/jpeg"
        try:
            from authsession import client as wa_client
            data = wa_client.download_any(message)
            if data:
                import base64
                image_b64 = base64.b64encode(data).decode("utf-8")
        except Exception:
            pass
        return text, image_b64, mime

    if inner.HasField("videoMessage"):
        text = (inner.videoMessage.caption or "").strip()
        return text or "[Video received]", None, ""

    if inner.HasField("ptvMessage"):
        text = (inner.ptvMessage.caption or "").strip()
        return text or "[Video note received]", None, ""

    if inner.HasField("audioMessage"):
        return "[Audio message received]", None, ""

    if inner.HasField("documentMessage"):
        text = (inner.documentMessage.fileName or "").strip()
        return text or "[Document received]", None, ""

    if inner.HasField("stickerMessage"):
        return "[Sticker received]", None, ""

    if inner.HasField("contactMessage"):
        text = (inner.contactMessage.displayName or inner.contactMessage.vcard or "").strip()
        return text or "[Contact received]", None, ""

    if inner.HasField("locationMessage"):
        return "[Location shared]", None, ""

    if inner.HasField("viewOnceMessage"):
        return _extract_text_and_image(inner.viewOnceMessage, client)

    if inner.HasField("viewOnceMessageV2"):
        return _extract_text_and_image(inner.viewOnceMessageV2, client)

    if inner.HasField("ephemeralMessage"):
        return _extract_text_and_image(inner.ephemeralMessage, client)

    return "", None, ""


def handle_event_chat(client, message: MessageProto):
    pass


def handle_private_chat(client, message: MessageProto):
    source = message.Info.MessageSource
    if not is_owner(source):
        return
    chat_id = f"{source.Chat.User}@{source.Chat.Server}"
    text, image_b64, mime = _extract_text_and_image(message, client)
    if not text and not image_b64:
        return

    session_id = _ensure_session_valid(chat_id)

    try:
        best_text, citations = _stream_events(session_id, chat_id, text, image_b64, mime)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (404, 410):
            with _session_lock:
                _wa_sessions.pop(chat_id, None)
            session_id = _ensure_session(chat_id)
            best_text, citations = _stream_events(session_id, chat_id, text, image_b64, mime)
        else:
            send_reply(client, message, f"Agent error (HTTP {exc.response.status_code}): {exc.response.text[:200]}")
            return
    except Exception as exc:
        send_reply(client, message, f"Agent error: {exc}")
        return

    reply = format_reply(best_text, citations) or "I couldn't find anything to say about that."
    send_reply(client, message, reply)


def _stream_events(session_id: str, user_id: str, text: str, image_b64: str | None, mime: str) -> tuple[str, list[dict]]:
    best_text = ""
    citations: list[dict] = []
    for event in _wa_client.stream_events(user_id=user_id, session_id=session_id, text=text, image_b64=image_b64, image_mime=mime):
        citations.extend(extract_citations(event))
        partial = bool(event.get("partial"))
        content = event.get("content") or {}
        for part in content.get("parts") or []:
            t = part.get("text")
            if not isinstance(t, str) or part.get("thought"):
                continue
            if partial:
                if not best_text:
                    best_text = t
                elif best_text not in t and t not in best_text:
                    best_text += t
            else:
                if t and (not best_text or len(t) >= len(best_text)):
                    best_text = t
    return best_text, citations


def handle_group_chat(client, message: MessageProto):
    pass


def register_chat_handlers(client):
    @client.event(MessageProto)
    def on_message(client, message: MessageProto):
        chat_type = get_chat_type(message)
        source = message.Info.MessageSource

        if chat_type == "status":
            return

        if chat_type == "private" and is_owner(source):
            handle_private_chat(client, message)
        else:
            handle_event_chat(client, message)
