from __future__ import annotations

import threading
from typing import Optional

import authsession
from neonize.proto.Neonize_pb2 import Message as MessageProto


def send_reply(client, message: MessageProto, text: str) -> None:
    chat = message.Info.MessageSource.Chat
    if not text:
        return
    try:
        client.reply_message(message=text, quoted=message, to=chat)
    except Exception:
        try:
            client.send_message(to=chat, message=text)
        except Exception:
            pass


def send_message(client, jid, text: str) -> None:
    if not text:
        return
    try:
        client.send_message(to=jid, message=text)
    except Exception:
        pass
