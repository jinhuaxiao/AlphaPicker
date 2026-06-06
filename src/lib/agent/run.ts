// Drives a pi Agent (Qwen via Bailian) for one user turn and yields a curated
// stream of UI events: text deltas, tool steps (with structured details), and
// completion. The API route turns these into SSE frames.

import { Agent } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { qwenModel, getApiKey } from "./model";
import { agentTools } from "./tools";
import { buildSystemPrompt, type AgentPageContext } from "./prompt";

const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  agentTools.map((t) => [t.name, t.label]),
);

/** A prior conversation turn replayed as plain text context. */
export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

/** Curated events the client renders. */
export type AgentStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_start"; id: string; tool: string; label: string; args: unknown }
  | { type: "tool_end"; id: string; tool: string; label: string; details: unknown; isError: boolean }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export interface RunAgentOptions {
  message: string;
  history?: HistoryTurn[];
  context: AgentPageContext;
  signal?: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
}

function historyToMessages(history: HistoryTurn[]): Message[] {
  return history.map((h) =>
    h.role === "user"
      ? ({ role: "user", content: h.text } as Message)
      : ({ role: "assistant", content: [{ type: "text", text: h.text }] } as Message),
  );
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { message, history = [], context, signal, onEvent } = opts;

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(context),
      model: qwenModel,
      tools: agentTools,
      messages: historyToMessages(history),
    },
    getApiKey,
  });

  let finalText = "";

  const unsubscribe = agent.subscribe((event) => {
    switch (event.type) {
      case "message_update": {
        const e = event.assistantMessageEvent;
        if (e?.type === "text_delta" && e.delta) {
          finalText += e.delta;
          onEvent({ type: "text_delta", delta: e.delta });
        }
        break;
      }
      case "tool_execution_start":
        onEvent({
          type: "tool_start",
          id: event.toolCallId,
          tool: event.toolName,
          label: TOOL_LABELS[event.toolName] ?? event.toolName,
          args: event.args,
        });
        break;
      case "tool_execution_end":
        onEvent({
          type: "tool_end",
          id: event.toolCallId,
          tool: event.toolName,
          label: TOOL_LABELS[event.toolName] ?? event.toolName,
          details: event.result?.details ?? null,
          isError: event.isError,
        });
        break;
      default:
        break;
    }
  });

  const onAbort = () => agent.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    await agent.prompt(message);
    if (!signal?.aborted) onEvent({ type: "done", text: finalText });
  } catch (err) {
    if (signal?.aborted) return;
    onEvent({ type: "error", message: (err as Error).message || "Agent 运行失败" });
  } finally {
    signal?.removeEventListener("abort", onAbort);
    unsubscribe();
  }
}
