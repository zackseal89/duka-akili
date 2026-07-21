import { connection } from "next/server";

import { ChatWorkspace } from "@/components/ChatWorkspace";
import { DEFAULT_AGENT_URL, normalizeBaseUrl } from "@/lib/adk";

export default async function Home() {
  // Read the agent URL at request time rather than at build time. NEXT_PUBLIC_
  // values are normally inlined during `next build`, which would bake a
  // localhost URL into the Cloud Run image. Resolving it here means one image
  // can be pointed at any agent by setting the env var on the service.
  await connection();

  const agentUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_AGENT_URL ?? DEFAULT_AGENT_URL,
  );

  return <ChatWorkspace agentUrl={agentUrl} />;
}
