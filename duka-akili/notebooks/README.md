# Gemma 4 from Kaggle Hub

[`gemma4_from_kagglehub.ipynb`](gemma4_from_kagglehub.ipynb) has three parts:

- **Part A — Official starter template**, copied verbatim from the
  [GDG on Campus UoN starter template](https://www.kaggle.com/code/gdguon/build-with-gemma-4-hackathon-starter-template-1):
  GPU setup, dependency install, loading Gemma 4 from Kaggle Hub in 4-bit
  (`AutoModelForCausalLM`, nf4, float16), and the template's own structured-JSON
  extraction demo, unmodified.
- **Part B — Duka Akili's backend**, running on that exact loaded `model` /
  `processor`: the app's real system instruction and three cases proving the
  project's behaviours — a grounded citation, a refusal, and the shipped
  three-way damaged-stock conflict.
- **Optional — serving it live**, further below: standing up the same weights
  behind a vLLM tool-calling endpoint for the ADK app. Notebook-only
  demonstration, run in a separate session.

## Why a Kaggle notebook

The 26B-A4B model the app names is 51.6 GB and needs a GPU; even a Q4 GGUF is
15.6 GB. A Kaggle notebook gives a free **T4 x2** and mounts the weights directly —
no download to your disk, no cost. (The dev laptop has no GPU and ~12 GB free, so
local hosting is not an option.)

## Run it

1. Open the notebook on Kaggle → **Copy & Edit**.
2. **Settings → Accelerator → GPU T4 x2** (it crashes on CPU).
3. **Add Input → Models** → `google/gemma-4` → `Transformers / gemma-4-12b-it`.
4. **Run all.** Part A downloads via `kagglehub`, loads in 4-bit, and runs the
   template's own JSON-extraction demo. Part B reuses that model to run Duka
   Akili's grounded citation, refusal, and conflict-flagging cases.

## Model variation

Part A uses `gemma-4-12b-it`, matching the official template exactly. To match
the deployed app instead, swap `MODEL_PATH = kagglehub.model_download(...)` in
Part A's loading cell to `"google/gemma-4/transformers/gemma-4-26b-a4b-it"`
(~13 GB in 4-bit, needs the full T4 x2).

## Tool calling / serving the app

Gemma 4 has **native function calling**. The notebook's optional last section serves
the same weights with vLLM's `gemma4` tool-call parser and opens a public URL, so
the ADK agent can use it. The app is already wired: [`app/agent.py`](../app/agent.py)
reads `MODEL_BACKEND` —

```bash
export MODEL_BACKEND=vllm
export VLLM_API_BASE=https://<your-endpoint>/v1   # from the notebook's tunnel cell
```

`MODEL_BACKEND=gemini` (default) leaves the current hosted path untouched. Run the
vLLM section in a **fresh** notebook — vLLM pins its own transformers and conflicts
with the git build the demo cells install.

## Downloading outside Kaggle

```python
import kagglehub
path = kagglehub.model_download("google/gemma-4/transformers/gemma-4-12b-it")
```

Off Kaggle this needs Kaggle credentials (`KAGGLE_USERNAME` + `KAGGLE_KEY`) and disk
for the full weights — not advisable on the dev laptop.
