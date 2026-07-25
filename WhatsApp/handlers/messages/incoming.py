from neonize.proto.Neonize_pb2 import Message as MessageProto


def is_group_message(message: MessageProto) -> bool:
    return message.Info.MessageSource.IsGroup


def is_private_message(message: MessageProto) -> bool:
    return not message.Info.MessageSource.IsGroup


def get_chat_type(message: MessageProto) -> str:
    source = message.Info.MessageSource
    if source.Chat.Server == "broadcast" or source.Chat.User == "status":
        return "status"
    if source.IsGroup:
        return "group"
    return "private"


def get_message_type(message: MessageProto) -> str:
    msg = message.Message
    if not message.HasField("Message"):
        return "unknown"
    try:
        field = msg.WhichOneof("message")
        if field:
            return _map_field(field)
    except ValueError:
        pass
    for name, msg_type in _FIELD_MAP.items():
        try:
            if msg.HasField(name):
                return msg_type
        except ValueError:
            continue
    return "unknown"


_FIELD_MAP = {
    "conversation": "text",
    "extendedTextMessage": "text",
    "imageMessage": "image",
    "videoMessage": "video",
    "ptvMessage": "video",
    "audioMessage": "audio",
    "documentMessage": "document",
    "stickerMessage": "sticker",
    "lottieStickerMessage": "sticker",
    "contactMessage": "contact",
    "locationMessage": "location",
    "liveLocationMessage": "live_location",
    "call": "call",
    "groupInviteMessage": "group_invite",
    "reactionMessage": "reaction",
    "pollCreationMessage": "poll",
    "buttonsMessage": "buttons",
    "listMessage": "list",
    "templateMessage": "template",
    "productMessage": "product",
    "orderMessage": "order",
    "invoiceMessage": "invoice",
    "viewOnceMessage": "view_once",
    "viewOnceMessageV2": "view_once",
    "ephemeralMessage": "ephemeral",
    "eventMessage": "event",
    "deviceSentMessage": "device_sent",
    "messageHistoryBundle": "history_bundle",
    "albumMessage": "album",
    "groupStatusMessage": "group_status",
    "statusAddYours": "status",
    "statusMentionMessage": "status",
    "statusNotificationMessage": "status",
}


def _map_field(field: str) -> str:
    return _FIELD_MAP.get(field, field)
