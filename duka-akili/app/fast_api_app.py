# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os

import google.auth
from fastapi import FastAPI, File, HTTPException, UploadFile
from google.adk.cli.fast_api import get_fast_api_app
from google.cloud import logging as google_cloud_logging

from app.app_utils.telemetry import setup_telemetry
from app.app_utils.typing import Feedback

setup_telemetry()

# This agent runs on a Gemini API key, not Vertex AI, so GCP credentials are
# optional. Cloud Logging is used when the container happens to have them
# (as on Cloud Run) and falls back to stdout when it does not, which keeps
# local development working with nothing but GEMINI_API_KEY set.
logger = None
try:
    _, project_id = google.auth.default()
    logging_client = google_cloud_logging.Client()
    logger = logging_client.logger(__name__)
except Exception:  # noqa: BLE001
    project_id = None

allow_origins = (
    os.getenv("ALLOW_ORIGINS", "").split(",") if os.getenv("ALLOW_ORIGINS") else ["*"]
)

# Artifact bucket for ADK (created by Terraform, passed via env var)
logs_bucket_name = os.environ.get("LOGS_BUCKET_NAME")

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# In-memory session configuration - no persistent storage
session_service_uri = None

artifact_service_uri = f"gs://{logs_bucket_name}" if logs_bucket_name else None

app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    artifact_service_uri=artifact_service_uri,
    allow_origins=allow_origins,
    session_service_uri=session_service_uri,
    otel_to_cloud=True,
)
app.title = "duka-akili"
app.description = "API for interacting with the Agent duka-akili"


@app.get("/api/documents")
def list_documents() -> dict[str, object]:
    """What the agent currently knows about, and how it is chunked."""
    from app.knowledge.retrieval import get_index

    index = get_index()
    return {
        "documents": index.documents(),
        "total_chunks": len(index.chunks),
    }


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)) -> dict[str, object]:
    """Index a markdown document, returning the full chunk and embed breakdown.

    The response is deliberately detailed. Retrieval quality depends entirely on
    how a document is split and embedded, and that step is normally invisible,
    so the interface shows it instead of asking for trust.
    """
    from app.knowledge.retrieval import add_document

    name = os.path.basename(file.filename or "untitled.md")
    if not name.lower().endswith((".md", ".markdown", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Upload a markdown or text file (.md, .markdown, .txt).",
        )

    raw = await file.read()
    if len(raw) > 512_000:
        raise HTTPException(status_code=400, detail="File is larger than 500 KB.")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 text.")

    if not text.strip():
        raise HTTPException(status_code=400, detail="That file is empty.")

    try:
        return add_document(name, text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/documents/{name}")
def delete_document(name: str) -> dict[str, object]:
    """Remove an uploaded document, so a demo can be reset to a known state."""
    from app.knowledge.retrieval import get_index

    index = get_index()
    target = next(
        (c for c in index.chunks if c.doc == os.path.basename(name)), None
    )
    if target is None:
        raise HTTPException(status_code=404, detail=f"{name} is not indexed.")
    if not target.uploaded:
        raise HTTPException(
            status_code=400,
            detail="That document ships with the app and cannot be removed.",
        )
    removed = index.remove(os.path.basename(name))
    return {"document": name, "chunks_removed": removed}


@app.post("/feedback")
def collect_feedback(feedback: Feedback) -> dict[str, str]:
    """Collect and log feedback.

    Args:
        feedback: The feedback data to log

    Returns:
        Success message
    """
    if logger is not None:
        logger.log_struct(feedback.model_dump(), severity="INFO")
    else:
        print("feedback:", feedback.model_dump())
    return {"status": "success"}


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
