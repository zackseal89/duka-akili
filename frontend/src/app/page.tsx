import { connection } from "next/server";

import { ChatWorkspace } from "@/components/ChatWorkspace";
import { DEFAULT_AGENT_URL, normalizeBaseUrl } from "@/lib/adk";

export default async function Home() {
  // Opt out of static rendering so the env vars below are read per request.
  await connection();

  // AGENT_URL is deliberately NOT prefixed with NEXT_PUBLIC_. Next.js performs
  // a literal text substitution of `process.env.NEXT_PUBLIC_*` at build time,
  // even inside server components, so a NEXT_PUBLIC_ value gets frozen into the
  // compiled bundle and can never be overridden by the container's environment.
  // That is not theoretical: the first Cloud Run deploy baked in the
  // Dockerfile's build-time http://localhost:8000 and ignored the env var set
  // on the service. A non-prefixed variable is looked up at runtime, so one
  // image can be pointed at any agent.
  //
  // NEXT_PUBLIC_AGENT_URL is still honoured as a fallback for local `npm run
  // dev`, where build time and run time are the same thing anyway.
  const agentUrl = normalizeBaseUrl(
    process.env.AGENT_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? DEFAULT_AGENT_URL,
  );

  return <ChatWorkspace agentUrl={agentUrl} />;
}
