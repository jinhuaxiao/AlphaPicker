"use client";

// AlphaPilot — the context-aware product-selection advisor panel. Talks to
// /api/agent (Qwen via Bailian, pi-agent-core) and renders the reply as it
// streams: live tool steps in a thinking block, then the assistant's markdown.

import { useEffect, useRef, useState } from "react";

export type AgentView = "recommend" | "decision" | "dashboard" | "other";

export interface AgentPanelProps {
  view: AgentView;
  asin?: string | null;
  label?: string;
}

interface ToolStep {
  id: string;
  tool: string;
  label: string;
  status: "running" | "done" | "error";
}

interface ChatMsg {
  id: string;
  role: "user" | "agent";
  text: string;
  steps: ToolStep[];
  streaming: boolean;
  error?: string;
}

let _seq = 0;
const uid = () => `m${Date.now().toString(36)}${++_seq}`;

const SUGGESTIONS: Record<AgentView, string[]> = {
  recommend: [
    "帮我从画像类目找 3 个低竞争、利润 30%+ 的品",
    "我的画像更适合做哪个价位带？",
  ],
  decision: ["这个品为什么是这个分数？", "把采购成本压到更低会翻盘吗？", "给我一份微测进入方案"],
  dashboard: ["我的评估库里哪个最值得做？", "对比一下我评估过的品"],
  other: ["先看看我的卖家画像", "帮我找几个值得做的品"],
};

function greeting(view: AgentView, label?: string): string {
  switch (view) {
    case "decision":
      return `我正跟着这份**决策报告**${label ? `（${label}）` : ""}工作。可以让我拆解评分构成、跑盈亏 what-if、解释 VOC 痛点，或给微测/放量策略。`;
    case "recommend":
      return "我是你的**资深选品顾问**，跟着**智能推荐**页工作。基于你的画像，想从哪儿开始？";
    case "dashboard":
      return "我跟着你的**评估库**工作。要我对比已评估的品、找出最值得推进的那个吗？";
    default:
      return "我是 **AlphaPilot**，你的资深选品顾问。问我当前页面，或让我动手筛品、跑模拟。";
  }
}

/* tiny markdown: **bold**, `code`, line breaks */
function renderMd(text: string, keyBase: string) {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[2] != null) parts.push(<b key={`${keyBase}-${li}-${k++}`}>{m[2]}</b>);
      else
        parts.push(
          <code key={`${keyBase}-${li}-${k++}`} className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[12px] text-blue-strong">
            {m[3]}
          </code>,
        );
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <span key={`${keyBase}-${li}`}>
        {parts}
        {li < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

function ThinkingBlock({ steps, streaming }: { steps: ToolStep[]; streaming: boolean }) {
  const [open, setOpen] = useState(true);
  const allDone = !streaming && steps.every((s) => s.status !== "running");
  useEffect(() => {
    if (allDone) setOpen(false);
  }, [allDone]);
  if (!steps.length) return null;
  return (
    <div className="mb-2 rounded-lg border border-line bg-panel-2/40">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-muted"
        onClick={() => setOpen((o) => !o)}
      >
        {allDone ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /></svg>
        ) : (
          <span className="ap-spin" />
        )}
        <span className="font-medium">
          {allDone ? `已分析 · ${steps.length} 步` : "正在分析…"}
        </span>
        <span className="ml-auto text-subtle">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <div className="space-y-1.5 px-3 pb-2.5">
          {steps.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
              {s.status === "running" ? (
                <span className="ap-spin ap-spin-sm" />
              ) : s.status === "error" ? (
                <span className="text-red">✕</span>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[11px] font-medium text-blue">{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AgentPanel({ view, asin, label }: AgentPanelProps) {
  const [open, setOpen] = useState(true);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollDown = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => {
    const t = setTimeout(scrollDown, 30);
    return () => clearTimeout(t);
  }, [msgs]);

  // Greeting resets when the page context changes.
  useEffect(() => {
    setMsgs([{ id: uid(), role: "agent", text: greeting(view, label), steps: [], streaming: false }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, asin]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    const history = msgs
      .filter((m) => !m.streaming && m.text)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), text: m.text }));

    const agentId = uid();
    setMsgs((x) => [
      ...x,
      { id: uid(), role: "user", text: q, steps: [], streaming: false },
      { id: agentId, role: "agent", text: "", steps: [], streaming: true },
    ]);

    const patch = (fn: (m: ChatMsg) => ChatMsg) =>
      setMsgs((x) => x.map((m) => (m.id === agentId ? fn(m) : m)));

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history, context: { view, asin, label } }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`请求失败 (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          handleEvent(ev, patch);
        }
      }
      patch((m) => ({ ...m, streaming: false }));
    } catch (err) {
      if (!ac.signal.aborted) {
        patch((m) => ({ ...m, streaming: false, error: (err as Error).message }));
      } else {
        patch((m) => ({ ...m, streaming: false }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function handleEvent(ev: Record<string, unknown>, patch: (fn: (m: ChatMsg) => ChatMsg) => void) {
    switch (ev.type) {
      case "text_delta":
        patch((m) => ({ ...m, text: m.text + String(ev.delta ?? "") }));
        break;
      case "tool_start":
        patch((m) => ({
          ...m,
          steps: [
            ...m.steps,
            { id: String(ev.id), tool: String(ev.tool), label: String(ev.label), status: "running" },
          ],
        }));
        break;
      case "tool_end":
        patch((m) => ({
          ...m,
          steps: m.steps.map((s) =>
            s.id === String(ev.id) ? { ...s, status: ev.isError ? "error" : "done" } : s,
          ),
        }));
        break;
      case "done":
        patch((m) => ({ ...m, text: typeof ev.text === "string" && ev.text ? (ev.text as string) : m.text, streaming: false }));
        break;
      case "error":
        patch((m) => ({ ...m, streaming: false, error: String(ev.message ?? "出错了") }));
        break;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const suggestions = SUGGESTIONS[view] ?? SUGGESTIONS.other;
  const ctxLabel =
    view === "decision" ? `决策报告${label ? ` · ${label}` : ""}` : view === "recommend" ? "智能推荐" : view === "dashboard" ? "我的选品" : "工作台";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue px-4 py-3 text-[13px] font-medium text-white shadow-pop transition hover:bg-blue-strong"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /></svg>
        AlphaPilot 顾问
      </button>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[360px] shrink-0 flex-col border-l border-line bg-panel xl:flex">
      {/* header */}
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" className="h-5 w-5 object-contain" />
            <i className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green ring-2 ring-panel" />
          </span>
          <div>
            <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              选品顾问 <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[10px] font-medium text-blue">AlphaPilot</span>
            </div>
            <div className="text-[11.5px] text-muted">资深 · 敢下结论</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted transition hover:bg-panel-2" title="收起">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </header>

      <div className="flex items-center gap-1.5 border-b border-line bg-panel-2/40 px-4 py-2 text-[11.5px] text-muted">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2z" /></svg>
        <span>正在看 · {ctxLabel}</span>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue px-3.5 py-2 text-[13.5px] leading-relaxed text-white">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.png" alt="" className="h-4 w-4 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <ThinkingBlock steps={m.steps} streaming={m.streaming} />
                {m.text ? (
                  <div className="text-[13.5px] leading-relaxed text-ink">
                    {renderMd(m.text, m.id)}
                    {m.streaming ? <span className="ap-caret" /> : null}
                  </div>
                ) : m.streaming && !m.steps.length ? (
                  <div className="flex items-center gap-1.5 text-[13px] text-muted"><span className="ap-spin ap-spin-sm" />思考中…</div>
                ) : null}
                {m.error ? (
                  <div className="mt-1 rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-[12.5px] text-red">⚠ {m.error}</div>
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>

      {/* footer */}
      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => send(s)}
              className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11.5px] text-ink/80 transition hover:border-blue/40 hover:bg-blue-soft hover:text-blue disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-line bg-panel-2/40 px-3 py-2 focus-within:border-blue/50">
          <textarea
            value={input}
            disabled={busy}
            rows={1}
            placeholder={busy ? "顾问正在分析…" : "问问当前页面 · 或让我动手做点什么"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-28 flex-1 resize-none bg-transparent text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-subtle"
          />
          {busy ? (
            <button onClick={stop} className="shrink-0 rounded-lg bg-panel-2 p-1.5 text-muted transition hover:bg-line" title="停止">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-blue p-1.5 text-white transition hover:bg-blue-strong disabled:opacity-40"
              title="发送"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
            </button>
          )}
        </div>
        <div className="mt-2 text-[10.5px] leading-relaxed text-subtle">
          AlphaPilot 调用实时数据并按你的画像给结论 · 仅供决策参考
        </div>
      </div>
    </aside>
  );
}
