import threading
import webbrowser
from neonize.client import NewClient

latest_qr_img = None
is_connected = False

client = NewClient(name="bot_session")


def start_bot():
    from handlers import register_handlers
    from webserver.server import run_web_server

    register_handlers(client)

    threading.Thread(target=run_web_server, daemon=True).start()
    print("Starting WhatsApp client... Opening http://localhost:5000 in browser.")
    webbrowser.open("http://localhost:5000")
    client.connect()
