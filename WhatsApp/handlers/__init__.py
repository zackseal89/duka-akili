import qrcode
import authsession
from neonize.events import ConnectedEv
from handlers.chat import register_chat_handlers


def register_handlers(client):
    @client.qr
    def on_qr(client, qr_data):
        qr_text = qr_data.decode("utf-8") if isinstance(qr_data, bytes) else str(qr_data)
        authsession.latest_qr_img = qrcode.make(qr_text)
        print("\nQR Code generated! Open: http://localhost:5000")

    @client.event(ConnectedEv)
    def on_connected(client, event):
        authsession.is_connected = True
        print("\nWhatsApp Connection Established!")

    register_chat_handlers(client)
