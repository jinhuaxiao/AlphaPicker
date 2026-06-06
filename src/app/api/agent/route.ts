// AlphaPilot agent endpoint. Streams curated agent events as SSE so the panel
// can render thinking/tool steps and the assistant's reply as it's produced.

import { runAgent, type AgentStreamEvent, type HistoryTurn } from "@/lib/agent/run";
import type { AgentPageContext } from "@/lib/agent/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AgentRequest {
  message: string;
  history?: HistoryTurn[];
  context?: Partial<AgentPageContext>;
}

export async function POST(req: Request) {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), { status: 400 });
  }
  if (!body?.message || typeof body.message !== "string") {
    return new Response(JSON.stringify({ error: "missing message" }), { status: 400 });
  }

  const context: AgentPageContext = {
    view: body.context?.view ?? "other",
    asin: body.context?.asin ?? null,
    label: body.context?.label,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      runAgent({
        message: body.message,
        history: Array.isArray(body.history) ? body.history.slice(-20) : [],
        context,
        signal: req.signal,
        onEvent: send,
      })
        .catch((err) => {
          send({ type: "error", message: (err as Error).message || "Agent 运行失败" });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
