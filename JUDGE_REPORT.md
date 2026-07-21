# Judge Report — Duka Akili

**Competition:** Build with Gemma: GDG on Campus UoN
**Deadline:** 24 July 2026, 12:10 UTC (~3 days)
**Reviewed:** 21 July 2026

## Verdict: 50/100 — A genuinely good idea with above-average engineering taste, currently sitting on a submission that would be disqualified before it is scored.

## ⚠️ DISQUALIFIER CHECK: **FAILING — 3 of 3 required attachments missing**

| Requirement | Status |
|---|---|
| Kaggle Writeup (≤1,500 words, track selected, **submitted** not draft) | ❌ Does not exist |
| Public code repository | ❌ `git log` shows **zero commits**. Nothing is pushed anywhere. |
| Live demo (public, no login, no paywall) | ❌ Not deployed, and would not run if it were — see below |

Nothing else in this report matters until these three exist. A judge never reaches the rubric.

## Scores

| Criterion | Score | Why |
|---|---|---|
| Gemma Integration | 22/30 | Two Gemma-family models doing real work — `gemma-4-26b-a4b-it` for reasoning and EmbeddingGemma-300m for local retrieval — with a stated reason for the MoE choice. That is well above the median "chat wrapper". It loses points because the code contradicts its own pitch: `agent.py` sets `GOOGLE_GENAI_USE_VERTEXAI=False` and calls the hosted Gemini API, while `retrieval.py` claims "the knowledge never leaves the deployment". Every query leaves the deployment. A judge who reads both files sees the gap. |
| Innovation & Impact | 19/30 | The refusal discipline is the best thing here — "an invented policy is worse than no answer" is a real product insight, and `compare_sources_on_topic` flagging contradictions between a supplier contract and a staff handbook is a problem nobody else will be solving. Kiswahili/Sheng matching is genuine local fit. But: it is still RAG-over-documents, the single most common hackathon shape, and the five documents in `app/docs/` are synthetic. No named duka owner, no evidence anyone has this filing problem, no number on what it costs them today. |
| Functionality | 7/20 | **The prototype does not run.** `sentence-transformers` appears nowhere in `pyproject.toml` or `uv.lock` (verified: 0 matches). `uv sync --frozen` in the Dockerfile installs an image that raises `ImportError` on the first `search_business_documents` call — i.e. on the judge's first question. `tests/unit/` contains only `test_dummy.py`. `frontend/` is an untouched `create-next-app` scaffold still rendering "To get started, edit the page.tsx file." |
| Presentation & Writeup | 2/20 | Nothing exists. The 2 points are for the docstrings, which are unusually clear and would make writing the real thing fast. |

**Track:** none selected. Recommend **Small Business & FinTech** — fit 8/10. Civic/Accessibility is tempting via the KRA tax guide and the Kiswahili handling, but the discount calculator and supplier contracts anchor it firmly in merchant operations; a judge would read a Civic entry as a stretch. Reconsider only if you learn that track is crowded.

## The killer question

**If Gemma 4 were swapped for another model, what breaks?**

Honest answer: **nothing.** It is an API call behind `MODEL_ID`. Change the string to `gemini-2.5-flash` and the app is identical. That caps Gemma Integration around 22 no matter how clean the code is.

The fix is available and cheap, because the *idea already contains it*. The pitch that makes Gemma irreplaceable is: **a duka's supplier contracts and staff records are private, and open weights mean they never have to leave the shop.** Right now the code says that in a comment and does the opposite. Make it true — run the model locally via Ollama or llama.cpp, even if only for the demo — and this criterion goes to 28+, because "open weights, runs on the shop's own hardware, no data leaves the premises, no per-query cost" is a story only Gemma can tell. That single change is worth more than any feature you could add.

## What loses this the prize

1. **Nothing is submitted.** Three days out, with no repo and no writeup, the failure mode is not "scores badly" — it is "does not get judged".
2. **The demo breaks on the judge's first question.** A missing dependency is not a rough edge in a prototype; it is the difference between 7/20 and 18/20.
3. **The strongest argument for the project is asserted, not demonstrated.** Local, private, open-weight inference is the whole reason to use Gemma over a hosted model, and the code currently doesn't do it.

## Fixes, ranked by points per hour

1. **Add `sentence-transformers` and `numpy` to `pyproject.toml`, re-lock, rebuild.** +8 pts, ~15 min. Everything downstream depends on the app running.
2. **Push to a public GitHub repo with an Apache 2.0 `LICENSE`.** +DQ→eligible, ~20 min. There is no license file, and winners are required to license under an OSI-approved license. Also fix `authors = "Your Name / your@email.com"` in `pyproject.toml` — judges notice.
3. **Deploy a demo a judge can click with no API key.** +10 pts, ~2 hrs. Cloud Run with the key in the environment, or a public Kaggle Notebook. Whatever you pick, open it in a private browser window and confirm it answers a question in under 60 seconds. If you cannot host it, a fully-runnable public Kaggle Notebook satisfies the rules and is far safer than a video.
4. **Write the 1,500-word writeup.** +16 pts, ~3 hrs. This is the largest single block of points on the board and it is currently at 2/20.
5. **Make the local-inference claim true.** +6 pts, ~2–3 hrs. Swap to a local Gemma 4 runtime, or — if that is too much for the time left — keep the API and *change the claim*, then write the local path as an explicit roadmap item. Do not ship the contradiction.
6. **Seed one real conflict in the documents and demo it.** +4 pts, ~45 min. Make `staff_handbook_supplier_returns.md` and `supplier_contract_unga_millers.md` disagree on the damaged-stock reporting window, with different effective dates. Then the first thing a judge types produces your most distinctive output. Right now `compare_sources_on_topic` is your best feature and nothing showcases it.
7. **Delete or replace `frontend/`.** +2 pts, ~10 min. A default Next.js scaffold in a public repo reads as abandoned work. Either point it at the agent or remove it from the submission.

Ignore: more tests, more tools, more documents. None of it scores.

## Opening paragraph for the writeup — use or adapt

> A duka owner in Kawangware has a supplier contract from Unga Millers, a staff handbook, a pricing policy, and a KRA turnover tax guide. When a customer brings back damaged flour, the answer to "do we refund this?" is in one of those documents — and sometimes it is in two of them, saying two different things. Duka Akili is a Gemma 4 assistant that reads the shop's own records, answers across the counter in Kiswahili or English, cites the document and section behind every claim, and refuses to answer when the records do not cover it. When two records disagree, it says so instead of quietly picking one.

That paragraph does the work: named user, specific bottleneck, the differentiator (refusal and conflict detection) in the first 100 words. Follow it with architecture, then *why Gemma specifically*, then what broke during the sprint.

## The one thing

**Get a working, publicly-clickable demo and a submitted writeup on the board by tomorrow night.** A 50/100 that is submitted beats a 90/100 that is a draft at 12:10 UTC on the 24th. Fix the dependency, push the repo, deploy, write. Polish only with whatever hours remain after that.
