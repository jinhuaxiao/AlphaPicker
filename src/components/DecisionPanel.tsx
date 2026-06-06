"use client";

import { useMemo, useState } from "react";
import { runAlpha, type Solvable, type DecisionLevel } from "@/lib/alpha";
import type { Evaluation, Keyword, Seller } from "@/lib/types";
import { cny, pct, signedPt } from "@/lib/format";

const LEVEL_TONE: Record<DecisionLevel, { text: string; bg: string; ring: string }> = {
  enter_and_scale: { text: "text-green", bg: "bg-green-soft", ring: "border-green/40" },
  enter: { text: "text-blue", bg: "bg-blue-soft", ring: "border-blue/40" },
  observe_or_micro_test: { text: "text-orange", bg: "bg-orange-soft", ring: "border-orange/40" },
  avoid: { text: "text-red", bg: "bg-red-soft", ring: "border-red/40" },
};

function indexColor(i: number) {
  return i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function KV({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[14px]">
      <span className="text-muted">{k}</span>
      <span className={`font-mono ${tone ?? ""}`}>{v}</span>
    </div>
  );
}

export function DecisionPanel({
  evaluation,
  seller,
  keywords,
}: {
  evaluation: Evaluation;
  seller: Seller;
  keywords: Keyword[];
}) {
  const [conf, setConf] = useState<Record<string, Solvable>>({});
  const r = useMemo(
    () => runAlpha(evaluation, seller, keywords, conf),
    [evaluation, seller, keywords, conf],
  );

  const tone = LEVEL_TONE[r.decision.level];
  const m = r.multipliers;

  const setVoc = (id: string, v: Solvable) =>
    setConf((c) => ({ ...c, [id]: c[id] === v ? null : v }));

  return (
    <div className="space-y-5">
      {/* headline */}
      <div className={`grid gap-5 rounded-xl border ${tone.ring} ${tone.bg} p-6 md:grid-cols-[auto_1fr]`}>
        <div className="text-center">
          <div className="text-[13px] font-medium text-muted">机会指数 · Opportunity Index</div>
          <div className={`font-mono text-6xl font-bold ${indexColor(r.opportunityIndex)}`}>
            {r.opportunityIndex}
          </div>
          <div className="font-mono text-[12px] text-muted">/ 100</div>
        </div>
        <div>
          <div className={`inline-flex items-center rounded-full border ${tone.ring} bg-panel px-3 py-1 text-[14px] font-medium ${tone.text}`}>
            {r.decision.levelLabel}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed">{r.decision.recommendation}</p>
          <ul className="mt-2 space-y-1 text-[13px] text-muted">
            {r.decision.reasoning.map((x, i) => (
              <li key={i}>· {x}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* hard gates */}
      <div className="flex flex-wrap gap-2">
        {r.hardGates.map((g) => (
          <div
            key={g.key}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
              g.pass ? "border-green/40 bg-green-soft text-green" : "border-red/40 bg-red-soft text-red"
            }`}
          >
            <span>{g.pass ? "✓" : "✕"}</span>
            <span className="font-medium">{g.label}</span>
            <span className="text-muted">· {g.detail}</span>
          </div>
        ))}
      </div>

      {/* index formula */}
      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="text-[14px] font-semibold">机会指数构成</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[14px]">
          <Pill label="市场基分" value={`${r.baseScore}`} />
          <span className="text-muted">×</span>
          <Pill label="利润乘数" value={m.profitMultiplier.toFixed(2)} />
          <span className="text-muted">×</span>
          <Pill label="风险乘数" value={m.riskMultiplier.toFixed(2)} />
          <span className="text-muted">×</span>
          <Pill label="卖家适配" value={m.sellerFitMultiplier.toFixed(2)} />
          <span className="text-muted">×</span>
          <Pill label="VOC 系数" value={m.vocFactor.toFixed(2)} />
          <span className="text-muted">=</span>
          <span className={`text-lg font-bold ${indexColor(r.opportunityIndex)}`}>{r.opportunityIndex}</span>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* TACOS finance */}
        <Card title="TACOS 财务底座">
          <KV k="售前毛利率" v={pct(r.finance.grossMarginPct)} />
          <KV k="广告订单占比" v={pct(r.finance.paidSalesSharePct)} />
          <KV k="预估 TACOS" v={pct(r.finance.estTacosPct)} />
          <KV k="可承受 TACOS" v={pct(r.finance.maxAcceptableTacosPct)} />
          <KV k="TACOS 安全边际" v={signedPt(r.finance.tacosSafetyPt)} tone={r.finance.tacosSafetyPt >= 0 ? "text-green" : "text-red"} />
          <KV k="TACOS 后净利率" v={pct(r.finance.netMarginAfterTacosPct)} tone={r.finance.netMarginAfterTacosPct > 0 ? "text-green" : "text-red"} />
          <KV k="月净利 / 资金需求" v={`${cny(r.finance.monthlyNetCny, { compact: true })} / ${cny(r.finance.capitalRequiredCny, { compact: true })}`} />
        </Card>

        {/* market */}
        <Card title="市场机会">
          <KV k="月搜索 / 市场量" v={r.market.monthlySearch.toLocaleString()} />
          <KV k="需求分" v={`${r.market.demandScore}`} />
          <KV k="Top3 集中度" v={pct(r.market.top3Concentration)} tone={r.market.top3Concentration >= 60 ? "text-orange" : ""} />
          <KV k="长尾空间" v={pct(r.market.longTailRoomPct)} />
          <KV k="加权 CPC" v={`$${r.market.weightedCpc.toFixed(2)}`} />
          <KV k="市场机会分" v={`${r.market.marketScore}`} tone="text-blue" />
        </Card>
      </div>

      {/* VOC human-in-loop */}
      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold">VOC 痛点 · 人机确认闭环</span>
          <span className="rounded-full border border-blue/30 bg-blue-soft px-2 py-0.5 text-[11px] text-blue">AI 建议 · 需卖家确认</span>
        </div>
        <p className="mt-1 text-[13px] text-muted">确认供应商能否解决，直接影响机会指数（VOC 系数）。</p>
        <div className="mt-3 space-y-2">
          {r.voc.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[14px]">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${
                    v.severity === "high" ? "bg-red-soft text-red" : v.severity === "mid" ? "bg-orange-soft text-orange" : "bg-panel-2 text-muted"
                  }`}>{v.severity === "high" ? "高" : v.severity === "mid" ? "中" : "低"}</span>
                  <span className="font-medium">{v.point}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{v.evidence}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setVoc(v.id, "solvable")}
                  className={`rounded-md border px-2.5 py-1 text-[12px] ${v.supplierSolvable === "solvable" ? "border-green/50 bg-green-soft text-green" : "border-line text-muted"}`}
                >供应商可解决</button>
                <button
                  onClick={() => setVoc(v.id, "unsolvable")}
                  className={`rounded-md border px-2.5 py-1 text-[12px] ${v.supplierSolvable === "unsolvable" ? "border-red/50 bg-red-soft text-red" : "border-line text-muted"}`}
                >无法解决</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* budget + keyword */}
        <Card title="预算与进入策略">
          <KV k="最大测试预算占比" v={pct(r.decision.budgetPolicy.maxTestBudgetRatio * 100)} />
          <KV k="建议初始预算" v={cny(r.decision.budgetPolicy.suggestedInitialBudget)} />
          <KV k="建议首批" v={r.decision.budgetPolicy.suggestedFirstBatch} />
          <div className="mt-2 border-t border-line pt-2 text-[14px]">
            <span className="text-muted">关键词策略：</span>
            {r.decision.keywordStrategy}
          </div>
        </Card>

        {/* stop loss */}
        <Card title="止损规则">
          <ul className="space-y-1.5 text-[14px]">
            {r.decision.stopLossRules.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red">■</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* dynamic warnings */}
      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="text-[14px] font-semibold">竞品动态预案</div>
        <div className="mt-3 space-y-2">
          {r.dynamicWarnings.map((w, i) => (
            <div key={i} className="rounded-lg border border-dashed border-orange/40 bg-orange-soft/30 p-3 text-[13px]">
              <div className="font-medium text-orange">⚠ {w.trigger}</div>
              <div className="mt-1 text-ink/90">影响：{w.impact}</div>
              <div className="text-muted">应对：{w.responsePlan}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-1">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
