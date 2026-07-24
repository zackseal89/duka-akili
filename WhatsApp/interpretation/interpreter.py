from neonize.proto.Neonize_pb2 import Message as MessageProto


def interpret(message: MessageProto) -> str | None:
    msg_type = _detect_type(message)
    if msg_type is None:
        return None
    return _renderers[msg_type](message)


def _detect_type(message: MessageProto) -> str | None:
    if not message.HasField("Message"):
        return None
    inner = message.Message
    if inner.HasField("conversation"):
        return "text"
    if inner.HasField("extendedTextMessage"):
        return "text"
    if inner.HasField("imageMessage"):
        return "image"
    if inner.HasField("videoMessage"):
        return "video"
    if inner.HasField("ptvMessage"):
        return "video"
    if inner.HasField("audioMessage"):
        return "audio"
    if inner.HasField("documentMessage"):
        return "document"
    if inner.HasField("documentWithCaptionMessage"):
        return "document"
    if inner.HasField("stickerMessage"):
        return "sticker"
    if inner.HasField("contactMessage"):
        return "contact"
    if inner.HasField("locationMessage"):
        return "location"
    if inner.HasField("liveLocationMessage"):
        return "live_location"
    if inner.HasField("groupInviteMessage"):
        return "group_invite"
    if inner.HasField("reactionMessage"):
        return "reaction"
    if inner.HasField("pollCreationMessage"):
        return "poll"
    if inner.HasField("pollCreationMessageV2"):
        return "poll"
    if inner.HasField("pollCreationMessageV3"):
        return "poll"
    if inner.HasField("buttonsMessage"):
        return "buttons"
    if inner.HasField("listMessage"):
        return "list"
    if inner.HasField("templateMessage"):
        return "template"
    if inner.HasField("productMessage"):
        return "product"
    if inner.HasField("viewOnceMessage"):
        return "view_once"
    if inner.HasField("viewOnceMessageV2"):
        return "view_once"
    if inner.HasField("ephemeralMessage"):
        return "ephemeral"
    if inner.HasField("albumMessage"):
        return "album"
    return None


def _render_text(message: MessageProto) -> str | None:
    inner = message.Message
    if inner.HasField("conversation"):
        return inner.conversation or None
    if inner.HasField("extendedTextMessage"):
        return inner.extendedTextMessage.text or None
    return None


def _render_image(message: MessageProto) -> str | None:
    inner = message.Message.imageMessage
    parts = ["[Image]"]
    if inner.caption:
        parts.append(inner.caption)
    if inner.mimetype:
        parts.append(f"({inner.mimetype})")
    return " ".join(parts) if len(parts) > 1 else parts[0]


def _render_video(message: MessageProto) -> str | None:
    inner = message.Message.videoMessage
    parts = ["[Video]"]
    if inner.caption:
        parts.append(inner.caption)
    if inner.mimetype:
        parts.append(f"({inner.mimetype})")
    return " ".join(parts) if len(parts) > 1 else parts[0]


def _render_audio(message: MessageProto) -> str | None:
    inner = message.Message.audioMessage
    parts = ["[Audio]"]
    if inner.mimetype:
        parts.append(f"({inner.mimetype})")
    return " ".join(parts) if len(parts) > 1 else parts[0]


def _render_document(message: MessageProto) -> str | None:
    inner = message.Message
    if inner.HasField("documentWithCaptionMessage"):
        doc = inner.documentWithCaptionMessage.document
        caption = inner.documentWithCaptionMessage.caption.text if inner.documentWithCaptionMessage.HasField("caption") else None
    else:
        doc = inner.documentMessage
        caption = doc.caption if doc.HasField("caption") else None
    parts = ["[Document]"]
    if doc.fileName:
        parts.append(doc.fileName)
    if caption:
        parts.append(caption)
    if doc.mimetype:
        parts.append(f"({doc.mimetype})")
    return " ".join(parts) if len(parts) > 1 else parts[0]


def _render_sticker(message: MessageProto) -> str | None:
    return "[Sticker]"


def _render_contact(message: MessageProto) -> str | None:
    inner = message.Message.contactMessage
    name = inner.displayName or inner.vcard or "Contact"
    return f"[Contact] {name}"


def _render_location(message: MessageProto) -> str | None:
    inner = message.Message.locationMessage
    return f"[Location] lat={inner.degreesLatitude:.4f}, lon={inner.degreesLongitude:.4f}"


def _render_live_location(message: MessageProto) -> str | None:
    inner = message.Message.liveLocationMessage
    return f"[LiveLocation] lat={inner.degreesLatitude:.4f}, lon={inner.degreesLongitude:.4f}"


def _render_group_invite(message: MessageProto) -> str | None:
    inner = message.Message.groupInviteMessage
    return f"[GroupInvite] {inner.groupName or 'Group'}"


def _render_reaction(message: MessageProto) -> str | None:
    inner = message.Message.reactionMessage
    text = inner.text or ""
    key = inner.key.id or ""
    return f"[Reaction] {text} -> {key}"


def _render_poll(message: MessageProto) -> str | None:
    inner = message.Message
    poll = inner.HasField("pollCreationMessageV2") and inner.pollCreationMessageV2 or \
           inner.HasField("pollCreationMessageV3") and inner.pollCreationMessageV3 or \
           inner.pollCreationMessage
    name = poll.name or "Poll"
    return f"[Poll] {name}"


def _render_buttons(message: MessageProto) -> str | None:
    inner = message.Message.buttonsMessage
    text = inner.text or ""
    return f"[Buttons] {text}"


def _render_list(message: MessageProto) -> str | None:
    inner = message.Message.listMessage
    text = inner.title or inner.description or ""
    return f"[List] {text}"


def _render_template(message: MessageProto) -> str | None:
    return "[Template]"


def _render_product(message: MessageProto) -> str | None:
    return "[Product]"


def _render_view_once(message: MessageProto) -> str | None:
    inner = message.Message
    actual = inner.viewOnceMessageV2 if inner.HasField("viewOnceMessageV2") else inner.viewOnceMessage
    if actual.HasField("imageMessage"):
        return _render_image(actual)
    if actual.HasField("videoMessage"):
        return _render_video(actual)
    return "[ViewOnce]"


def _render_ephemeral(message: MessageProto) -> str | None:
    inner = message.Message.ephemeralMessage
    return interpret(inner)


def _render_album(message: MessageProto) -> str | None:
    return "[Album]"


_renderers = {
    "text": _render_text,
    "image": _render_image,
    "video": _render_video,
    "audio": _render_audio,
    "document": _render_document,
    "sticker": _render_sticker,
    "contact": _render_contact,
    "location": _render_location,
    "live_location": _render_live_location,
    "group_invite": _render_group_invite,
    "reaction": _render_reaction,
    "poll": _render_poll,
    "buttons": _render_buttons,
    "list": _render_list,
    "template": _render_template,
    "product": _render_product,
    "view_once": _render_view_once,
    "ephemeral": _render_ephemeral,
    "album": _render_album,
}
