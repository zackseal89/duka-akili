/**
 * Shapes returned by the Google ADK FastAPI server.
 *
 * Everything here is optional on purpose. ADK serialises google-genai types,
 * and the exact key casing and which keys are present vary between versions
 * and between streaming and non streaming turns. Nothing in the UI is allowed
 * to crash because a field is missing, so every field is nullable and readers
 * go through the accessor helpers in `adk.ts`.
 */

export interface AdkFunctionCall {
  id?: string | null;
  name?: string | null;
  args?: Record<string, unknown> | null;
}

export interface AdkFunctionResponse {
  id?: string | null;
  name?: string | null;
  response?: unknown;
}

export interface AdkPart {
  text?: string | null;
  /** Gemini thinking parts set this. They are not part of the visible answer. */
  thought?: boolean | null;
  functionCall?: AdkFunctionCall | null;
  function_call?: AdkFunctionCall | null;
  functionResponse?: AdkFunctionResponse | null;
  function_response?: AdkFunctionResponse | null;
  [key: string]: unknown;
}

export interface AdkContent {
  role?: string | null;
  parts?: AdkPart[] | null;
}

export interface AdkUsageMetadata {
  totalTokenCount?: number | null;
  total_token_count?: number | null;
  promptTokenCount?: number | null;
  prompt_token_count?: number | null;
  candidatesTokenCount?: number | null;
  candidates_token_count?: number | null;
  [key: string]: unknown;
}

export interface AdkEvent {
  id?: string | null;
  author?: string | null;
  invocationId?: string | null;
  invocation_id?: string | null;
  content?: AdkContent | null;
  /** True while the model is still emitting chunks for this response. */
  partial?: boolean | null;
  turnComplete?: boolean | null;
  turn_complete?: boolean | null;
  errorCode?: string | null;
  error_code?: string | null;
  errorMessage?: string | null;
  error_message?: string | null;
  usageMetadata?: AdkUsageMetadata | null;
  usage_metadata?: AdkUsageMetadata | null;
  [key: string]: unknown;
}

/** The session object returned by POST /apps/{app}/users/{user}/sessions. */
export interface AdkSession {
  id?: string | null;
  appName?: string | null;
  app_name?: string | null;
  userId?: string | null;
  user_id?: string | null;
  state?: Record<string, unknown> | null;
  [key: string]: unknown;
}
