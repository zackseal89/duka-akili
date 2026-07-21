# Duka Akili, frontend

A grounded business knowledge assistant for a Kenyan small retail shop (a "duka").
A shopkeeper or staff member asks questions in English or Kiswahili about the
business's own documents (supplier contracts, staff handbook, pricing and
discount policy, KRA turnover tax guide). The assistant answers only from those
documents, cites the document and section it used, refuses when nothing grounds
the answer, and flags when two of the business's own documents contradict each
other.

This is the web UI. It talks to a Google ADK FastAPI agent server over HTTP and
streams the reply token by token.

## What the interface shows

- **Streaming answers.** Tokens render as they arrive, parsed from the agent's
  Server Sent Events stream.
- **Tool call visibility.** When the agent calls a retrieval tool, an inline
  chip shows "Searching the documents" while it runs, then collapses into a
  completed step that lists the sources it pulled.
- **Reasoning trace.** Gemma's internal planning (text parts flagged as
  thoughts) is shown as a separate collapsible "Reasoning" trace, never mixed
  into the answer.
- **Citations.** Every grounded answer shows the documents and sections it used
  as clickable chips. Clicking a chip reveals the retrieved snippet.
- **Conflict callout.** When the answer reports that two documents disagree, it
  is wrapped in a distinct amber warning card that names the documents in
  conflict.
- **Refusal styling.** When nothing in the documents grounds the question, the
  answer is marked "Not in the documents" rather than dressed up as a fact.
- Suggested starter prompts, an empty state that lists the five documents the
  assistant knows about, graceful error and offline states, light and dark
  themes, and a mobile responsive layout.

## Requirements

- Node.js 20 or newer (built and tested on Node 22 and 24).
- A running Duka Akili ADK agent server. See the `duka-akili` backend project.

## Configuration

The only setting is the agent base URL, read from `NEXT_PUBLIC_AGENT_URL`.

Create `.env.local` (an example is provided in `.env.example`):

```
NEXT_PUBLIC_AGENT_URL=http://localhost:8000
```

- Local development: point it at the ADK server started by
  `agents-cli playground` or `uvicorn`, usually `http://localhost:8000`.
- Cloud Run: set it to the HTTPS URL of the deployed agent service.

The value is read at request time on the server, so the same production build
(and the same Docker image) can be pointed at any agent by changing the
environment variable. No rebuild is needed.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Make sure the agent server is running and reachable
at whatever `NEXT_PUBLIC_AGENT_URL` points to, otherwise the header shows
"Offline" and a banner explains how to fix it.

Production build and start:

```bash
npm run build
npm run start
```

## How it talks to the backend

The client uses exactly two documented ADK endpoints and invents no others.

1. Create a session:

   ```
   POST {NEXT_PUBLIC_AGENT_URL}/apps/app/users/{userId}/sessions
   Content-Type: application/json
   Body: {}
   ```

   The response is a Session object; its `id` is the session id.

2. Stream a turn:

   ```
   POST {NEXT_PUBLIC_AGENT_URL}/run_sse
   Content-Type: application/json
   Body: {
     "app_name": "app",
     "user_id": "<userId>",
     "session_id": "<session id from step 1>",
     "new_message": { "role": "user", "parts": [ { "text": "<question>" } ] },
     "streaming": true
   }
   ```

   The response is `text/event-stream`. Because it must be a POST with a body,
   the stream is read with `fetch` and `response.body.getReader()` rather than
   `EventSource`.

Each SSE frame carries one ADK Event. The client accumulates `content.parts[]`,
handling `text` (answer or thought), `functionCall`, and `functionResponse`,
and treats every field as optional so a missing field never crashes the UI.

### Streaming details worth knowing

The agent streams a turn as a run of `partial: true` delta events, then emits a
final `partial: false` event that replays the entire turn again. The client
accounts for this so nothing is duplicated:

- Function calls are deduplicated by id, so a replayed call does not create a
  second tool chip.
- Function responses are deduplicated by id.
- Streaming text extends the open block; the final non partial text is treated
  as the authoritative full text and only closes the block, and non partial
  text that merely repeats an already finished block is dropped.
- Text parts flagged with `thought: true` are routed to the reasoning trace and
  kept out of the answer. Opaque fields such as `thoughtSignature` are ignored.

Relevant source:

- `src/lib/adk.ts` — session creation and SSE parsing.
- `src/lib/turn-reducer.ts` — folding events into ordered answer, reasoning and
  tool blocks, including the replay and thought handling.
- `src/lib/citations.ts` — extracting citations from answers and tool results.
- `src/lib/conflict.ts` — classifying an answer as a conflict or a refusal.
- `src/lib/documents.ts` — display metadata for the five documents.

## Deploy to Cloud Run

The project builds a standalone Next.js server (`output: "standalone"` in
`next.config.ts`) and ships a `Dockerfile` that produces a small runtime image.

```bash
# Build and push (replace PROJECT and REGION)
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/duka/frontend

# Deploy, pointing the UI at the deployed agent
gcloud run deploy duka-akili-frontend \
  --image REGION-docker.pkg.dev/PROJECT/duka/frontend \
  --region REGION \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_AGENT_URL=https://your-agent-service-url
```

The container listens on `$PORT` (Cloud Run injects it; defaults to 8080 for a
local `docker run -p 8080:8080`).

To build and run the image locally:

```bash
docker build -t duka-akili-frontend .
docker run -p 8080:8080 -e NEXT_PUBLIC_AGENT_URL=http://host.docker.internal:8000 duka-akili-frontend
```

## Tech

Next.js (App Router) with TypeScript and Tailwind CSS v4. No runtime UI
dependencies beyond React; the markdown answer renderer and SSE client are
written in house to keep the bundle small and the streaming behaviour exact.
