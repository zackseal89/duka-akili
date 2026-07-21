"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgentError, createSession, streamTurn } from "./adk";
import type { AssistantMessage, ChatMessage } from "./chat-types";
import { applyEvent, emptyTurn, settleTurn, type TurnState } from "./turn-reducer";

const USER_ID_KEY = "duka-user-id";

export type ConnectionState = "unknown" | "connecting" | "ready" | "error";

export interface ConnectionProblem {
  kind: "unreachable" | "session" | "protocol" | "stream";
  message: string;
  detail?: string;
}

function randomId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/** Stable per browser user id, so ADK sessions group sensibly across reloads. */
function loadUserId(): string {
  if (typeof window === "undefined") return "duka-shopkeeper";
  try {
    const existing = window.localStorage.getItem(USER_ID_KEY);
    if (existing) return existing;
    const created = randomId("duka");
    window.localStorage.setItem(USER_ID_KEY, created);
    return created;
  } catch {
    return randomId("duka");
  }
}

function toProblem(error: unknown): ConnectionProblem {
  if (error instanceof AgentError) {
    const kind =
      error.kind === "aborted" ? "stream" : (error.kind as ConnectionProblem["kind"]);
    return { kind, message: error.message, detail: error.detail };
  }
  if (error instanceof Error) {
    return { kind: "stream", message: error.message };
  }
  return { kind: "stream", message: "Something went wrong talking to the agent." };
}

export interface UseDukaChat {
  messages: ChatMessage[];
  connection: ConnectionState;
  problem: ConnectionProblem | null;
  isStreaming: boolean;
  sessionId: string | null;
  userId: string;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  reset: () => void;
  dismissProblem: () => void;
}

export function useDukaChat(agentUrl: string): UseDukaChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("unknown");
  const [problem, setProblem] = useState<ConnectionProblem | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Stable per browser id. Lazy initializer runs once, so localStorage is read
  // a single time and the value is safe to reference during render.
  const [userId] = useState<string>(() => loadUserId());

  const sessionRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  // The agent URL a live session was opened against, so a URL change (rare,
  // but possible via env) transparently forces a fresh session.
  const sessionAgentUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionAgentUrlRef.current !== agentUrl) {
      // The cached session belongs to a different agent URL. Drop it.
      sessionRef.current = null;
      sessionPromiseRef.current = null;
    }
    if (sessionRef.current) return sessionRef.current;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    sessionAgentUrlRef.current = agentUrl;
    setConnection("connecting");
    const pending = createSession({ baseUrl: agentUrl, userId })
      .then((id) => {
        sessionRef.current = id;
        if (mountedRef.current) {
          setSessionId(id);
          setConnection("ready");
          setProblem(null);
        }
        return id;
      })
      .catch((error: unknown) => {
        sessionPromiseRef.current = null;
        if (mountedRef.current) {
          setConnection("error");
          setProblem(toProblem(error));
        }
        throw error;
      });

    sessionPromiseRef.current = pending;
    return pending;
  }, [agentUrl, userId]);

  // Warm the session on mount so the connection pill is honest before the
  // shopkeeper types anything, and so the first answer is not slowed by it.
  useEffect(() => {
    let cancelled = false;
    void ensureSession().catch(() => {
      // Already surfaced through `problem`.
    });
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [ensureSession]);

  const updateAssistant = useCallback(
    (id: string, update: (message: AssistantMessage) => AssistantMessage) => {
      setMessages((current) =>
        current.map((message) =>
          message.role === "assistant" && message.id === id ? update(message) : message,
        ),
      );
    },
    [],
  );

  const runTurn = useCallback(
    async (question: string, assistantId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();

      let turn: TurnState = emptyTurn();
      // Events arrive faster than React should re-render, so batch flushes.
      let dirty = false;
      let frame: number | null = null;

      const flush = () => {
        frame = null;
        if (!dirty) return;
        dirty = false;
        const snapshot = turn;
        updateAssistant(assistantId, (message) => ({
          ...message,
          blocks: snapshot.blocks,
          authors: snapshot.authors,
          totalTokens: snapshot.totalTokens ?? message.totalTokens,
        }));
      };

      const schedule = () => {
        dirty = true;
        if (frame !== null) return;
        frame =
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame(flush)
            : (setTimeout(flush, 32) as unknown as number);
      };

      try {
        const session = await ensureSession();

        for await (const event of streamTurn({
          baseUrl: agentUrl,
          userId,
          sessionId: session,
          text: question,
          signal: controller.signal,
        })) {
          const next = applyEvent(turn, event);
          if (next !== turn) {
            turn = next;
            schedule();
          }
        }

        if (frame !== null) {
          if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
          frame = null;
        }

        const settled = settleTurn(turn, "done");
        const empty =
          settled.blocks.length === 0 ||
          settled.blocks.every((block) => block.kind === "text" && !block.text.trim());

        updateAssistant(assistantId, (message) => ({
          ...message,
          blocks: settled.blocks,
          authors: settled.authors,
          totalTokens: settled.totalTokens ?? message.totalTokens,
          elapsedMs: Date.now() - startedAt,
          status: settled.error || empty ? "error" : "done",
          error:
            settled.error ??
            (empty ? "The agent finished without sending an answer." : undefined),
        }));
        if (mountedRef.current) setConnection("ready");
      } catch (error) {
        if (frame !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(frame);
        }
        const aborted =
          controller.signal.aborted ||
          (error instanceof AgentError && error.kind === "aborted");

        const settled = settleTurn(turn, aborted ? "stopped" : "error");
        const problemInfo = aborted ? null : toProblem(error);

        updateAssistant(assistantId, (message) => ({
          ...message,
          blocks: settled.blocks,
          authors: settled.authors,
          elapsedMs: Date.now() - startedAt,
          status: aborted ? "stopped" : "error",
          error: aborted ? "You stopped this answer." : problemInfo?.message,
          errorDetail: aborted ? undefined : problemInfo?.detail,
        }));

        if (!aborted && mountedRef.current) {
          setProblem(problemInfo);
          if (problemInfo?.kind === "unreachable" || problemInfo?.kind === "session") {
            setConnection("error");
            // A dead session must not be reused on the next question.
            sessionRef.current = null;
            sessionPromiseRef.current = null;
          }
        }
      } finally {
        abortRef.current = null;
        if (mountedRef.current) setIsStreaming(false);
      }
    },
    [agentUrl, ensureSession, updateAssistant, userId],
  );

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || isStreaming) return;

      lastQuestionRef.current = question;
      setProblem(null);

      const assistantId = randomId("a");
      const now = Date.now();

      setMessages((current) => [
        ...current,
        { role: "user", id: randomId("u"), text: question, at: now },
        {
          role: "assistant",
          id: assistantId,
          at: now,
          status: "streaming",
          blocks: [],
          authors: [],
          question,
        },
      ]);
      setIsStreaming(true);
      void runTurn(question, assistantId);
    },
    [isStreaming, runTurn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (isStreaming) return;
    const question = lastQuestionRef.current;
    if (!question) return;

    // Drop the failed turn and its question, then ask again.
    setMessages((current) => {
      const next = current.slice();
      while (next.length > 0) {
        const last = next[next.length - 1];
        next.pop();
        if (last.role === "user") break;
      }
      return next;
    });
    setProblem(null);
    // Let the removal commit before appending the retried pair.
    setTimeout(() => send(question), 0);
  }, [isStreaming, send]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setProblem(null);
    lastQuestionRef.current = "";
    sessionRef.current = null;
    sessionPromiseRef.current = null;
    setSessionId(null);
    setConnection("unknown");
    void ensureSession().catch(() => {
      // Surfaced through `problem`.
    });
  }, [ensureSession]);

  const dismissProblem = useCallback(() => setProblem(null), []);

  return useMemo(
    () => ({
      messages,
      connection,
      problem,
      isStreaming,
      sessionId,
      userId,
      send,
      stop,
      retry,
      reset,
      dismissProblem,
    }),
    [
      messages,
      connection,
      problem,
      isStreaming,
      sessionId,
      userId,
      send,
      stop,
      retry,
      reset,
      dismissProblem,
    ],
  );
}
