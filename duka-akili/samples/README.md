# Sample upload

`mpesa_float_policy.md` is not part of the shipped document set. It exists to
demonstrate the upload path: drop it into the Documents panel and the agent can
immediately answer questions it could not answer before, such as "What is our
M-Pesa float and when do I escalate?"

Uploads live in the running service's memory, so restarting the container
returns the index to the six documents in `app/docs/`.
