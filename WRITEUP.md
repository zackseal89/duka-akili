# Duka Akili

### The shop's own records, answered across the counter — grounded, cited, and built to run with the internet off

**Track: Small Business & FinTech**

---

## The problem

A duka owner in Kawangware keeps a supplier contract from Unga Millers, another from Coastal Beverages, a staff handbook, a written pricing and discount policy, and the KRA turnover tax guide. Five documents. Maybe a WhatsApp thread.

A customer brings back a torn bale of flour. The attendant behind the counter needs one answer: *do we take this back?* The answer exists — it is in section 2 of the Unga Millers contract, and it is also in the staff handbook, and those two documents do not say the same thing. One gives seven days to report damaged stock. The other gives fourteen. They were written eight months apart and nobody reconciled them.

So the attendant guesses, or calls the owner, or refuses the customer. Every one of those outcomes costs money. Multiply it by discount tiers nobody remembers, a turnover tax deadline nobody tracks, and staff turnover that resets the institutional memory every few months.

This is not a knowledge problem. The knowledge is written down. It is a **retrieval and authority** problem: the right passage is unreachable at the moment of decision, and when two passages conflict, nothing in the shop resolves them.

## What Duka Akili does

Duka Akili is an assistant that answers from the shop's own documents and nothing else. It has four behaviours that matter:

**It grounds every answer.** Before answering any question about policy, supplier terms, staff procedure, pricing, or tax, it retrieves from the shop's documents. It does not answer from general knowledge about how Kenyan retail usually works.

**It cites.** Every claim names the document and the section — *"supplier_contract_unga_millers.md, section 2. Returns and Damaged Stock"* — so the owner can go read the source and disagree with it.

**It refuses.** When retrieval returns nothing relevant, it says the shop's documents do not cover the question and suggests who to ask. It does not fill the gap with a plausible guess. **For a business tool, an invented policy is worse than no answer** — a confident wrong refund policy costs real shillings, while "I don't know, ask the owner" costs a phone call.

**It surfaces conflicts instead of resolving them silently.** This is the part we care most about. When a question touches something more than one document governs, `compare_sources_on_topic` pulls the relevant passage from *each* document separately. If they disagree, the agent does not quietly pick one. It states that the shop's own records contradict each other, quotes both, compares their effective dates, recommends the later one, and tells the owner to go fix the stale document. The assistant's most valuable output is often not an answer — it is *"your records disagree, and here is where."*

## Architecture

Three layers, deliberately kept separate:

**Retrieval — pre-embedded, matched by a dot product.** Documents are chunked by markdown section, since the source files are already structured that way and section-level chunks preserve enough context to be citable. Chunk embeddings are computed once, offline, and checked into the repo as a small JSON cache (`scripts/build_index.py`), so the deployed container boots light and fast with no vector database to operate. Each incoming question is embedded the same way at request time and matched against that cache by cosine similarity — a plain dot product over a small matrix, no managed search product involved.

**Reasoning — Gemma 4.** `gemma-4-26b-a4b-it`, a Mixture-of-Experts model, chosen over the dense `gemma-4-31b-it` because an assistant used across a counter is latency-bound, not reasoning-bound. MoE gives us the speed of a much smaller model at the quality of a large one. Native function calling drives the tool loop.

**Arithmetic — Python, never the model.** Every shilling figure comes from `calculate_customer_discount`, not from the model's head. The design rule is: *the model retrieves and reasons, code computes.* A wrong number is then traceable to a function we can test, not to a hallucination we can only apologise for. That function also enforces policy the model cannot override — discounts do not stack, totals round down in the customer's favour, and **a manager override above 5% is rejected in code regardless of what the model or the user asks for.**

That last constraint is small, but it is the seed of where this project is going.

## Why Gemma specifically — and the direction

An honest answer about this prototype: both layers currently call Google's hosted API — Gemma 4 for reasoning, a Gemini embedding model for retrieval. If you swapped the model string today, the app would still run.

That is exactly the gap we are closing, and it is the whole reason we chose Gemma rather than a closed model. **Gemma's open weights are not a licensing detail to us — they are the product.** The roadmap below is not a wish list bolted onto a demo; it is a set of things that are only possible *because* the weights are ours to run.

**Offline-forward, fully local.** A duka in Kawangware has intermittent connectivity and metered data. An assistant that stops working when the network drops is not a tool a shop can depend on at 6pm on a Friday. Today neither reasoning nor retrieval runs on the shop's own hardware — both call Google's hosted API, which means no internet is silently the same as no assistant. The direction is a quantised Gemma 4 running locally for reasoning, paired with a local embedding model for retrieval, so the whole pipeline — not just half of it — keeps answering with the network down, and the shop's supplier contracts, margins, and staff records never leave the premises at all. For a business whose competitive information *is* its supplier terms, that is not a privacy nicety; it is the difference between adopting this and not.

**Mobile-forward.** The real interface is not a web dashboard on a laptop in a back office. It is a phone, held behind the counter, answering in Kiswahili or Sheng because that is how the question was asked. Small open models are the only category that fits on that device. This is where the MoE choice pays off twice — once in latency, once in what can realistically be quantised onto consumer hardware.

**Cost.** Per-query API pricing is a poor fit for a business with thin margins and unpredictable volume. Local inference on hardware the shop already owns converts a recurring variable cost into a fixed one of roughly zero. For a duka, that is the difference between a tool that pays for itself and one that gets cancelled in month three.

**Guardrails and role-based permissions.** A shop is not one user. An owner, a manager, and a shop attendant should not have the same authority, and today they all get the same answers. The direction is per-role access enforced *in code, not in the prompt*: an attendant can read the returns procedure but cannot authorise any discount; a manager can authorise up to the 5% the policy allows; only the owner sees supplier margins and tax exposure. The 5% override cap already in `calculate_customer_discount` is the first of these boundaries, and it is deliberately enforced by a Python function rather than an instruction, because **a permission a model can be talked out of is not a permission.** Extending that pattern into a proper role layer — scoped retrieval, scoped tools, an audit trail of who asked what — is the main engineering work ahead.

**Open source.** The project is Apache 2.0. A tool that holds a shop's contracts and computes its discounts has to be inspectable by the people relying on it, and every duka's document set is different enough that the useful version is the one shopkeepers and local developers can fork and adapt. We would rather be the pattern than the product.

## What the sprint taught us

The hardest problem was not retrieval quality. It was **making refusal reliable**. Instructing a model to say "I don't know" is easy; getting it to prefer that over a fluent guess, consistently, when the retrieved passage is *almost* relevant, is not. The fix lived in the retrieval threshold, not the prompt: calibrated against this document set, clearly off-topic queries — wifi password, the weather, football — scored 0.55 to 0.60, while genuine matches scored 0.73 and above. We set the cutoff at 0.65, in the gap with margin on both sides, so a weak passage is dropped before the model ever sees it and can never be tempted to cite it. That is the same principle as the arithmetic rule and the override cap: **where correctness matters, constrain in code, not in language.**

## Links

- **Code:** [public repository]
- **Live demo:** [demo link]

*Licensed under Apache 2.0.*
