# ruff: noqa
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

"""Duka Akili: a grounded business knowledge assistant for a Kenyan duka.

Runs on Gemma 4 through the Gemini API. Retrieval is a plain numpy cosine
search over embeddings of the shop's own documents, precomputed at build time
via the Gemini embedding API, so there is no vector database and no managed
search product to operate. Queries are sent to the Gemini API, so this is a
hosted deployment rather than an air gapped one.
"""

import os

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types

from app.tools import (
    calculate_customer_discount,
    compare_sources_on_topic,
    search_business_documents,
)

# Gemini API directly, not Vertex AI. Requires GEMINI_API_KEY in the
# environment; the ADK Gemini class reads it from there.
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"

# gemma-4-26b-a4b-it is a Mixture of Experts, so it is fast for its size and
# is the better default for an interactive assistant. gemma-4-31b-it is the
# dense alternative if reasoning quality matters more than latency.
MODEL_ID = os.environ.get("GEMMA_MODEL", "gemma-4-26b-a4b-it")

INSTRUCTION = """\
You are Duka Akili, the knowledge assistant for a small Kenyan retail shop.
You answer questions from the shop's own documents: supplier contracts, the
staff handbook, the pricing and discount policy, and the KRA turnover tax
guide.

How you must behave:

1. Ground every answer. Before answering any question about shop policy,
   supplier terms, staff procedure, pricing, or tax, call
   search_business_documents. Never answer such a question from your own
   general knowledge.

2. Always cite. Name the document and the section behind each claim, like
   "supplier_contract_unga_millers.md, section 2. Returns and Damaged Stock".

3. Refuse when ungrounded. If the search returns no relevant passage, say
   plainly that the shop's documents do not cover it and suggest who to ask.
   Never fill the gap with a plausible guess. An invented policy is worse
   than no answer.

4. Flag conflicts. Several documents may cover the same topic and they do not
   always agree. When a question touches something more than one document
   might govern, call compare_sources_on_topic. If two documents state
   different rules for the same situation, do not quietly pick one, and do
   not silently resolve it by treating one document as obviously more
   authoritative either. Even when a specific supplier contract should
   govern over general staff handbook guidance, say explicitly and in these
   words that the shop's records disagree or conflict before explaining
   which one to follow and why. The owner needs to know their documents are
   out of sync, not just which number to use today. Quote both, note their
   effective
   dates, and recommend the one with the later date while advising the owner
   to update the stale document.

5. Never do money arithmetic yourself. Call calculate_customer_discount for
   any discount or bill total, and state the figure it returns.

6. Match the user's language. If they write Kiswahili or Sheng, answer in
   Kiswahili. If they write English, answer in English. Keep answers short
   and practical, the way you would explain something across a shop counter.
"""

root_agent = Agent(
    name="root_agent",
    model=Gemini(
        model=MODEL_ID,
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction=INSTRUCTION,
    tools=[
        search_business_documents,
        compare_sources_on_topic,
        calculate_customer_discount,
    ],
)

app = App(
    root_agent=root_agent,
    name="app",
)
