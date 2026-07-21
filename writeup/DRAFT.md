<!--
DRAFT for the Kaggle Writeup. Nothing here has been submitted anywhere.
Paste into the writeup editor at:
https://www.kaggle.com/competitions/build-with-gemma-gdg-on-campus-uon/writeups
Track to select: Small Business & FinTech.
Word count target: under 1500. Current draft is written to be trimmed, not
padded, so cut before you add.
-->

# Duka Akili

## Subtitle
A shop's own records, made honest and searchable with Gemma 4.

## The problem

A small Kenyan retail shop runs on paper and memory: a supplier contract in a
drawer, a staff handbook nobody has reread since it was printed, a pricing
policy the owner explained once, a KRA tax guide someone photocopied. New
staff learn the rules by asking around, and the documents themselves drift
out of sync with each other as suppliers renegotiate terms and nobody updates
the handbook to match. A member of staff who asks "can I pay the driver in
cash" gets whatever answer whoever is nearby happens to remember, and that
answer might be six months out of date.

This is not a data problem. The shop already has the information, spread
across five documents that disagree with each other in at least two places.
The problem is that nobody can query it, and nobody notices when it
contradicts itself.

## What we built

Duka Akili is a Google ADK agent, running on `gemma-4-26b-a4b-it` through the
Gemini API, that answers staff questions grounded in a shop's own documents:
a supplier contract, a staff handbook, a pricing and discount policy, and a
KRA turnover tax guide. It has three behaviors that matter more than the fact
that it can answer questions at all.

**It cites.** Every claim names the document and section it came from. A
member of staff asking about damaged stock does not get "you have 48 hours",
they get "supplier_contract_unga_millers.md, section 2.1: 48 hours".

**It refuses.** When a question is not covered by any document, the agent
says so instead of guessing. We tested this directly: asked for the shop's
wifi password, it correctly replied that the documents do not contain that
information rather than inventing a plausible-sounding answer. In a business
context, an invented policy costs real money the first time someone acts on
it.

**It catches its own contradictions.** This is the part we are proudest of.
Our test corpus contains a real drift pattern: the Unga Millers supplier
contract requires damaged stock to be reported within 48 hours and forbids
cash payment to delivery drivers, while the older staff handbook says 7 days
and permits cash. Asked about either topic, the agent retrieves both
documents, states plainly that the shop's own records disagree, quotes both
verbatim, and recommends following the newer, stricter contract while
flagging the handbook as due for an update. Nobody told it about this
specific conflict; it found it by comparing what both documents say about
the same topic.

Money math never runs through the model. A `calculate_customer_discount`
tool implements the shop's actual tier rules (walk-in, regular, wholesale,
partner, with a capped manager override) as plain Python, so a discount
figure is traceable to code rather than to token prediction. We tested this
in Kiswahili directly: asked what a wholesale customer buying KES 3,200 of
goods would pay after discount, the agent called the tool and returned
exactly KES 2,976, the correct 7% wholesale rate, in fluent Kiswahili.

## How Gemma 4 is used

Two Gemma-family capabilities are load-bearing, not decorative.

`gemma-4-26b-a4b-it`, a Mixture-of-Experts variant chosen for latency in an
interactive assistant, drives all reasoning and native tool calling through
the Gemini API. It decides which tool to call, reasons about retrieved
passages, and is the component that recognizes a contradiction rather than
silently picking one source.

Retrieval runs on embeddings from `gemini-embedding-001` over markdown
sections of the source documents, compared by cosine similarity in a plain
numpy index with no vector database to operate. We initially set an
unvalidated relevance threshold and found empirically that it let every
query return something to cite, which meant the refusal behavior never
fired. We measured real scores: clearly off-topic queries scored 0.55 to
0.60, genuine matches scored 0.73 and above, and we set the threshold at
0.65, in the gap with margin on both sides. Refusal only works because that
number is now grounded in measurement.

## Engineering the sprint did not go as planned

We deliberately did not build the demo we started with. An earlier version
photographed and transcribed handwritten ledger pages with Gemma 4's vision
capability; it worked, at up to 96 percent field accuracy after several
tuning passes, but the resulting product, "point a camera at a table, get a
table back", was not something we wanted to stand behind, so we cut it with
a day and a half left and rebuilt around agentic RAG and tool calling
instead. We would rather ship a smaller thing we mean than a bigger thing we
do not.

Two bugs the tuning found are worth naming because they would have quietly
broken the demo:

Gemma 4 ships Thinking Mode, and streamed tool-calling events mark internal
planning text with a boolean `thought` field. Naive event handling
concatenates that reasoning narration directly into the visible answer, and
a separate final event replays the entire turn a second time, silently
doubling every tool call shown to the user. Both are now filtered correctly
in the agent's client and in the frontend's stream parser.

The initial retrieval design assumed EmbeddingGemma running locally. Both
Hugging Face and Kaggle gate that repository behind a licence click-through
that a container build cannot complete non-interactively, so we moved
embeddings to the Gemini API instead. The tradeoff is honest: one fewer
distinct Gemma component, in exchange for a deployment that a judge can
actually run without registering for anything.

## Track

Small Business & FinTech. The tools are a discount calculator implementing
the shop's own tiered pricing policy, and supplier-contract retrieval
governing payment and returns workflows. It is not a stretch fit.

## What we would build next

The document set here is five files we wrote to be realistic, not five files
from a real shop. The obvious next step is a real duka's actual paperwork,
photographed and OCR'd into the same pipeline the vision prototype already
proved out, so the contradiction-detection feature meets the contradictions
a real business actually has.
