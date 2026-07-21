# Duka Akili

### The shop's own records, answered across the counter — grounded, cited, and willing to say when they contradict each other

**Track: Small Business & FinTech**

---

## The problem

A duka owner in Kawangware keeps a supplier contract from Unga Millers, another from Coastal Beverages, a staff handbook, a roles and access policy, a written pricing and discount policy, and the KRA turnover tax guide. Six documents. Maybe a WhatsApp thread.

A customer brings back a torn bale of flour. The attendant behind the counter needs one answer: *do we take this back?* The answer exists — it is in section 2 of the Unga Millers contract, and it is also in section 4.2 of the staff handbook, and those two documents do not say the same thing. The contract gives **48 hours** to report damaged stock, with photographic evidence. The handbook gives **seven days**. They were written seven months apart and nobody reconciled them. The Coastal Beverages contract is stricter still: breakages must be raised with the driver before he leaves.

So the attendant guesses, calls the owner, or refuses the customer. Each costs money. Multiply that by discount tiers nobody remembers, a tax deadline nobody tracks, and staff turnover that resets institutional memory every few months.

This is not a knowledge problem — the knowledge is written down. It is a **retrieval and authority** problem: the right passage is unreachable at the moment of decision, and when two passages conflict, nothing resolves them.

## What Duka Akili does

Duka Akili answers from the shop's own documents and nothing else. Five behaviours:

**It grounds every answer.** Before answering anything about policy, supplier terms, staff procedure, pricing, or tax, it retrieves from the shop's documents rather than from general knowledge about how Kenyan retail usually works.

**It cites.** Every claim names the document and section — *"supplier_contract_unga_millers.md, section 2. Returns and Damaged Stock"* — so the owner can read the source and disagree with it.

**It refuses.** When retrieval returns nothing relevant, it says the documents do not cover the question and suggests who to ask, rather than filling the gap with a plausible guess. **For a business tool, an invented policy is worse than no answer** — a confident wrong refund rule costs shillings; "ask the owner" costs a phone call.

**It takes new documents, visibly.** Any markdown document can be added in the browser, and the interface shows the pipeline as it runs — split into sections, embedded, indexed — then lists the resulting chunks with their sizes and previews. Retrieval quality is decided by how a document is split and embedded, and that step is normally invisible, so we show it rather than ask to be believed. The agent answers from the new document immediately, with citations.

**It surfaces conflicts instead of resolving them silently.** This is the part we care most about. When a question touches something more than one document governs, `compare_sources_on_topic` pulls the relevant passage from *each* document separately. If they disagree, the agent does not quietly pick one: it states that the shop's own records contradict each other, quotes both, compares their effective dates, recommends the later one, and tells the owner to fix the stale document. The most valuable output is often not an answer — it is *"your records disagree, and here is where."*

## Architecture

Three layers, deliberately kept separate:

**Retrieval — pre-embedded, matched by a dot product.** Documents are chunked by markdown section, since the sources are already structured that way and section-level chunks stay large enough to be citable. Embeddings are computed once, offline, into a small JSON cache (`scripts/build_index.py`), so the container boots fast with no vector database to operate. Each question is embedded at request time and matched by cosine similarity — a dot product over a small matrix, no managed search product involved.

**Reasoning — Gemma 4.** `gemma-4-26b-a4b-it`, a Mixture-of-Experts model, chosen over the dense `gemma-4-31b-it` because an assistant used across a counter is latency-bound, not reasoning-bound: MoE gives the speed of a much smaller model at the quality of a large one. Native function calling drives the tool loop.

**Arithmetic — Python, never the model.** Every shilling figure comes from `calculate_customer_discount`. The rule is: *the model retrieves and reasons, code computes.* A wrong number is then traceable to a function we can test, not to a hallucination we can only apologise for. That function also enforces policy the model cannot override — discounts do not stack, totals round down in the customer's favour, and **a manager override above 5% is rejected in code regardless of what the model or the user asks for.** That last constraint is small, but it is the seed of where this project is going.

## Why Gemma specifically — and the direction

An honest answer: both layers currently call Google's hosted API — Gemma 4 for reasoning, a Gemini embedding model for retrieval. Swap the model string today and the app still runs.

That gap is exactly what we are closing, and it is why we chose Gemma over a closed model. **Gemma's open weights are not a licensing detail to us — they are the product.** What follows is not a wish list bolted onto a demo; it is what becomes possible *because* the weights are ours to run.

**Offline-forward, fully local.** A duka in Kawangware has intermittent connectivity and metered data, and an assistant that dies with the network is not one a shop can depend on at 6pm on a Friday. The direction is a quantised Gemma 4 running locally for reasoning, paired with a local embedding model for retrieval, so the whole pipeline keeps answering with the network down and the shop's supplier terms, margins, and staff records never leave the premises. For a business whose competitive information *is* its supplier terms, that is not a privacy nicety; it is the difference between adopting this and not.

**Mobile-forward.** The real interface is a phone held behind the counter, answering in Kiswahili or Sheng because that is how the question was asked. Small open models are the only category that fits there, which is where the MoE choice pays off twice — in latency, and in what can be quantised onto consumer hardware.

**Cost.** Per-query pricing suits thin margins and unpredictable volume poorly. Local inference on hardware the shop already owns turns a recurring variable cost into roughly zero — the difference between a tool that pays for itself and one cancelled in month three.

**Role-based permissions.** A shop is not one user. Owner, manager, and attendant should not have the same authority, yet today they get the same answers. The shop's roles policy already writes this down; the code does not yet enforce it. The direction is per-role access enforced *in code, not in the prompt*: an attendant reads the returns procedure but authorises no discount; a manager authorises up to the policy's 5%; only the owner sees margins and tax exposure. The 5% cap in `calculate_customer_discount` is the first such boundary, enforced by a function rather than an instruction, because **a permission a model can be talked out of is not a permission.** Extending that into scoped retrieval, scoped tools, and an audit trail is the main work ahead.

**Open source.** Apache 2.0. A tool holding a shop's contracts must be inspectable by the people relying on it, and every duka's documents differ enough that the useful version is the one local developers can fork. We would rather be the pattern than the product.

## What the sprint taught us

The hardest problem was not retrieval quality. It was **making refusal reliable**. Instructing a model to say "I don't know" is easy; getting it to prefer that over a fluent guess when the retrieved passage is *almost* relevant is not. The fix lived in the retrieval threshold, not the prompt: measured against this document set, clearly off-topic queries — the weather, football, baking a cake — score 0.56 to 0.61, while genuine matches score 0.70 and above. The cutoff sits at 0.65, so a weak passage is dropped before the model sees it and can never be cited.

That margin is real but narrower than we would like, and it moved when the corpus grew: adding two documents lifted one off-topic query to 0.65, right at the line. A fixed cosine threshold is the honest weak point here — tuned to a document set rather than derived, and needing re-calibration as a shop's library grows. What saved us is that the model still refused correctly when a weak passage slipped through, because refusal is enforced at two levels, not one.

The principle held where it mattered, and it is the same one behind the arithmetic rule and the override cap: **where correctness matters, constrain in code, not in language.**

## Links

- **Live demo:** https://duka-akili-web-354092327858.us-central1.run.app
- **Code:** https://github.com/zackseal89/duka-akili

Try either prompt marked *Contract vs handbook* to see a conflict surfaced, or open **Documents** and upload `samples/mpesa_float_policy.md` to watch a document indexed and immediately answerable.

*Licensed under Apache 2.0.*
