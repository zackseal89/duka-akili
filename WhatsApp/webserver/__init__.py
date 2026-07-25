import io
import authsession
from flask import Flask, send_file
from models.config import WEB_HOST, WEB_PORT

app = Flask(__name__)


@app.route("/")
def index():
    if authsession.is_connected:
        return """
        <div style="font-family: sans-serif; text-align: center; margin-top: 20%; background: #e5ddd5; padding: 40px;">
            <h1 style="color: #075e54;">WhatsApp Connected Successfully!</h1>
            <p>Your bot is online and connected. You can close this tab.</p>
        </div>
        """
    if authsession.latest_qr_img:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan WhatsApp QR Code</title>
            <meta http-equiv="refresh" content="5">
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #111b21; color: white; margin: 0; }
                .card { background: #202c33; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                img { border-radius: 8px; margin-top: 15px; background: white; padding: 10px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Scan with WhatsApp</h2>
                <p>Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
                <img src="/qr.png" width="280" height="280" />
            </div>
        </body>
        </html>
        """
    return "<h2 style='font-family: sans-serif; text-align: center;'>Generating QR code... <script>setTimeout(() => location.reload(), 2000);</script></h2>"


@app.route("/qr.png")
def qr_image():
    if authsession.latest_qr_img:
        buf = io.BytesIO()
        authsession.latest_qr_img.save(buf, "PNG")
        buf.seek(0)
        return send_file(buf, mimetype="image/png")
    return "No QR available", 404


def run_web_server():
    app.run(host=WEB_HOST, port=WEB_PORT, debug=False, use_reloader=False)
