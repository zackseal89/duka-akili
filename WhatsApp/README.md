# MCBANKSAI - RESPONDER

AI-powered WhatsApp assistant that listens to private messages, understands them, and replies with intelligent responses powered by a multimodal LLM.

## Features

- WhatsApp connection via QR code (neonize)
- Web-based QR scanner at `http://localhost:5000`
- Private message automation
- Multimodal LLM support (text + image inputs)
- Conversation memory per chat
- Clean modular architecture

## Project Structure

```
authsession/           WhatsApp client initialization and shared state
handlers/              Event handlers
  chat.py              Routes private messages to the LLM pipeline
  messages/
    incoming.py        Chat type detection (private/group/status)
interpretation/       Message content extraction
  interpreter.py       Text, image, video, audio, document parsers
llm/                   LLM integration layer
  client.py            OpenAI-compatible HTTP client
  media.py             Message-to-LLM payload converter
outgoing/              Reply dispatch
  sender.py            Sends responses back to WhatsApp
models/                Configuration
  config.py            Reads WEB_HOST, WEB_PORT from .env
webserver/             Flask QR code web server
  server.py            Serves / and /qr.png
```

## Requirements

- Python 3.10+
- Windows/macOS/Linux
- WhatsApp account
- OpenRouter API key (or any OpenAI-compatible API)

## Installation

```powershell
git clone <your-repo-url>
cd WhatsApp
pip install -r requirements.txt
```

## Configuration

Create a `.env` file in the project root:

```env
LLM_API_KEY=your_openrouter_api_key
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemma-3-4b-it:free
LLM_SYSTEM_PROMPT=You are a helpful WhatsApp assistant. Keep replies short, natural, and friendly.
WEB_HOST=127.0.0.1
WEB_PORT=5000
```

Get a free API key from [OpenRouter](https://openrouter.ai/keys).

## Usage

```powershell
python main.py
```

1. Open `http://localhost:5000` in your browser
2. Scan the QR code with WhatsApp (Linked Devices → Link a Device)
3. Send a private message to the bot
4. The LLM will process it and reply automatically

## Architecture

```
Incoming WhatsApp Message
        │
        ▼
handlers/chat.py (private only)
        │
        ├──► interpretation/interpreter.py (extract content)
        │
        ├──► llm/media.py (convert to LLM payload)
        │         ├── Text → plain text
        │         ├── Image → base64 + caption
        │         ├── Video/PTV → caption/description
        │         ├── Audio → [Audio message received]
        │         ├── Document → filename/description
        │         └── Sticker/Contact/Location → description
        │
        ├──► llm/client.py (call LLM API with history)
        │
        └──► outgoing/sender.py (reply to user)
```

## Supported Message Types

| Type | Sent to LLM As |
|------|---------------|
| Text | Plain text |
| Image | Base64 image + caption |
| Video / PTV | Caption or description |
| Audio | `[Audio message received]` |
| Document | Filename or description |
| Sticker | `[Sticker received]` |
| Contact | Name or vcard |
| Location | `[Location shared]` |
| View Once | Unwrapped inner content |
| Ephemeral | Unwrapped inner content |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | *(required)* | OpenRouter or compatible API key |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | LLM API base URL |
| `LLM_MODEL` | `google/gemma-3-4b-it:free` | Model identifier |
| `LLM_SYSTEM_PROMPT` | `You are a helpful WhatsApp assistant...` | System prompt for LLM |
| `WEB_HOST` | `127.0.0.1` | Flask server host |
| `WEB_PORT` | `5000` | Flask server port |

## Notes

- Only **private** messages trigger the LLM. Group and status broadcasts are ignored.
- Conversation history is stored **in memory** and is lost when the process restarts.
- Image messages are downloaded and sent as base64 to the LLM (multimodal).
- All other media types are converted to text descriptions.

## License

MIT
