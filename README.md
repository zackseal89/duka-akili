# Duka Akili

**Grounded answers from a small business's own documents, in English or Kiswahili.**

Built for the [Build with Gemma hackathon, GDG on Campus UoN](https://www.kaggle.com/competitions/build-with-gemma-gdg-on-campus-uon) — track: Small Business & FinTech.

**[Live demo](https://duka-akili-web-354092327858.us-central1.run.app)** · no login required

---

A Kenyan duka keeps supplier contracts, a staff handbook, a pricing policy and a
KRA tax guide. The answers staff need are written down, but unreachable at the
counter, and when two documents disagree nothing in the shop resolves them.

Duka Akili retrieves from those documents, cites the exact section behind every
claim, refuses when nothing grounds an answer, and — the part we care most about
— **says so out loud when the shop's own records contradict each other**, rather
than quietly picking one.

## What it does

| | |
|---|---|
| **Grounds** | Retrieves from the business's documents before answering. Never from general knowledge. |
| **Cites** | Names the document and section, so the owner can check it. |
| **Refuses** | Says the documents do not cover it rather than inventing a policy. |
| **Ingests** | Upload a markdown document and watch it split, embed and index, then ask about it immediately. |
| **Flags conflicts** | Quotes both sides, compares effective dates, recommends the later one, tells you to fix the stale document. |

### Try the conflict

The shipped documents contain a real three-way disagreement about reporting
damaged stock:

- **Unga Millers contract** § 2.1 — within **48 hours**, with photo evidence
- **Staff handbook** § 4.2 — within **7 days**
- **Coastal Beverages contract** § 2.1 — **immediately**, before the driver leaves

Ask *"How long do I have to report damaged stock from Unga Millers?"* and the
agent names the conflict instead of picking a number.

## Architecture

```
Next.js frontend  ──SSE──▶  ADK agent (FastAPI)  ──▶  gemma-4-26b-a4b-it
   Cloud Run                    Cloud Run                 Gemini API
                                    │
                                    ├─ search_business_documents
                                    ├─ compare_sources_on_topic
                                    └─ calculate_customer_discount
                                    │
                              numpy cosine search over
                              pre-embedded markdown sections
```

Three layers, deliberately separate:

**Retrieval.** Documents are chunked by markdown section and embedded once,
offline, into a JSON cache ([`scripts/build_index.py`](duka-akili/scripts/build_index.py)).
Queries are embedded at request time and matched by cosine similarity — a dot
product over a small matrix. No vector database to operate.

**Reasoning.** `gemma-4-26b-a4b-it` via the Gemini API. The Mixture-of-Experts
variant is chosen over the dense `gemma-4-31b-it` because an assistant used
across a counter is latency-bound, not reasoning-bound. Native function calling
drives the tool loop.

**Arithmetic.** Every shilling figure comes from
[`calculate_customer_discount`](duka-akili/app/tools.py), never the model. A
wrong number is traceable to a function with a test, not to a hallucination.
That function also enforces policy the model cannot talk its way around: a
manager override above 5% is rejected in code.

## Running it locally

Requires Python 3.11+, Node 20+, and a [Gemini API key](https://aistudio.google.com/apikey)
(free tier is sufficient).

```bash
git clone https://github.com/zackseal89/duka-akili
cd duka-akili
export GEMINI_API_KEY=your-key-here      # Windows: setx GEMINI_API_KEY "..."
```

**Agent:**

```bash
cd duka-akili
uv sync
uv run python scripts/build_index.py     # embeds app/docs/ into a JSON cache
ALLOW_ORIGINS=http://localhost:3000 \
  uv run uvicorn app.fast_api_app:app --port 8123
```

**Frontend:**

```bash
cd frontend
npm install
echo "AGENT_URL=http://localhost:8123" > .env.local
npm run dev                              # http://localhost:3000
```

`AGENT_URL` is deliberately not prefixed with `NEXT_PUBLIC_`. Next.js inlines
`NEXT_PUBLIC_*` at build time, which would freeze the URL into the container
image and make the runtime environment variable useless.

### Useful scripts

```bash
uv run python scripts/smoke_retrieval.py            # retrieval scores + refusal check
uv run python scripts/smoke_agent.py "your question" # one full agent turn
uv run pytest tests/unit tests/integration
```

## Layout

```
duka-akili/           ADK agent
  app/agent.py        agent definition, model, system instruction
  app/tools.py        the three tools the model may call
  app/docs/           the business's documents (6 markdown files)
  app/knowledge/      chunking, embedding, cosine retrieval
  app/fast_api_app.py ADK server plus the /api/documents endpoints
  samples/            a document to try the upload flow with
frontend/             Next.js UI, streams from /run_sse
WRITEUP.md            the hackathon submission
```

## Deploying

Both services run on Cloud Run. The API key is held in Secret Manager, never in
an environment variable on the service.

```bash
# agent
cd duka-akili
gcloud run deploy duka-akili --source=. --region=us-central1 \
  --allow-unauthenticated --memory=4Gi --no-cpu-throttling \
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --update-env-vars="GOOGLE_GENAI_USE_VERTEXAI=False,ALLOW_ORIGINS=*"

# frontend
cd frontend
gcloud run deploy duka-akili-web --source=. --region=us-central1 \
  --allow-unauthenticated --port=8080 \
  --update-env-vars="AGENT_URL=https://<agent-service-url>"
```

## Known limitations

Stated plainly, because a tool that holds a shop's contracts should be honest
about where it is weak:

- **Uploads are in-memory.** A document added through the UI lives in the running
  container and is lost on restart or a scale-out to a second instance. Every
  demo therefore starts from the same six documents. This is not persistence.
- **The retrieval threshold is tuned, not derived.** The 0.65 cosine cutoff was
  calibrated against this document set. It moved when the corpus grew, and it
  will need re-calibrating as a library grows.
- **Roles are documented but not enforced.** `employee_roles_and_access_policy.md`
  describes who may authorise what, and the agent can quote it, but the code does
  not yet scope retrieval or tools by role. Only the 5% override cap is enforced.
- **Hosted, not local.** Both reasoning and embeddings call Google's API today.
  Running Gemma locally is the direction, not the current state.

## Licence

[Apache 2.0](LICENSE).
