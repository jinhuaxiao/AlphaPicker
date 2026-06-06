// Bailian (阿里云百炼 / DashScope) Qwen model wired into pi-ai as a custom
// OpenAI-compatible model. The agent runtime (pi-agent-core) drives this for
// reasoning + tool calling. Docs: help.aliyun.com/zh/model-studio
//
// We default to `qwen3-max` — Bailian's current flagship 千问 model — and let
// it be overridden via DASHSCOPE_AGENT_MODEL without touching code.

import type { Model } from "@earendil-works/pi-ai";

const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ??
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

/** The DashScope model id used by the AlphaPilot agent. */
export const AGENT_MODEL_ID = process.env.DASHSCOPE_AGENT_MODEL ?? "qwen3-max";

export const DASHSCOPE_PROVIDER = "dashscope";

/**
 * Qwen flagship as an OpenAI-compatible pi-ai model. `qwen3-max` is an
 * instruct (non-thinking) model, so `reasoning: false` keeps the request shape
 * simple and avoids the `developer` role / `reasoning_effort` fields some
 * OpenAI-compatible servers reject. Costs are indicative (¥→$ rough) and only
 * feed pi-ai's token accounting.
 */
export const qwenModel: Model<"openai-completions"> = {
  id: AGENT_MODEL_ID,
  name: `Qwen (${AGENT_MODEL_ID}) · 百炼`,
  api: "openai-completions",
  provider: DASHSCOPE_PROVIDER,
  baseUrl: DASHSCOPE_BASE_URL,
  reasoning: false,
  input: ["text"],
  cost: { input: 1.2, output: 6, cacheRead: 0.24, cacheWrite: 0 },
  contextWindow: 256_000,
  maxTokens: 8_192,
  compat: {
    // DashScope's compatible-mode speaks standard OpenAI chat, but isn't in
    // pi-ai's URL auto-detect list, so be explicit about the safe subset.
    supportsStore: false,
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  },
};

/** Resolve the DashScope API key for the given pi provider. */
export function getApiKey(provider: string): string | undefined {
  if (provider === DASHSCOPE_PROVIDER) return process.env.DASHSCOPE_API_KEY;
  return undefined;
}
