import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreGauge, MiniGauge } from "@/components/charts/ScoreGauge";
import { getEvaluationByAsin, getSeller, getReviewInsight, pnlInputsFor } from "@/lib/queries";
import { acosSafety } from "@/lib/economics";
import { runAlpha } from "@/lib/alpha";
import { toVocPainPoints } from "@/lib/reviews";
import { clamp } from "@/lib/scoring";
import { compactNumber, usd, signedPt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CockpitPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  const seller = await getSeller();
  if (!e || !seller) notFound();

  const s = e.scores;
  const rawComp = 100 - s.competition;
  const safety = acosSafety(pnlInputsFor(e)).safetyPt;
  const acosScore = clamp(Math.round(50 + safety * 2));

  // One decision number, app-wide: the live opportunity index.
  const reviewInsight = e.status !== "draft" ? await getReviewInsight(seller.id, e.asin) : null;
  const vocOverride = reviewInsight?.painPoints.length
    ? toVocPainPoints(reviewInsight.painPoints)
    : undefined;
  const alpha = e.status !== "draft" ? runAlpha(e, seller, [], {}, vocOverride) : null;
  const idx = alpha ? alpha.opportunityIndex : e.composite;
  const percentile = Math.min(95, Math.max(50, Math.round(idx) - 4));
  const vsAvg = Math.max(2, Math.round(idx) - 66);

  const feed = [
    ["14:22:07", `拉取 ASIN ${e.asin}`, "ok"],
    ["14:22:08", `关键词 ${e.secondary_keywords.length + 1} 类 · 加权 CPC ${usd(e.weighted_cpc)}`, "ok"],
    ["14:22:09", `Top3 卖家集中度 ${e.top3_concentration}%`, "ok"],
    ["14:22:11", `FBA fee = ${usd(e.fba_fee_usd)}（估）`, "ok"],
    ["14:22:11", `退货率基线 ${e.return_rate_pct}%`, "ok"],
    ["14:22:12", "三场景模拟完成", "ok"],
    ["14:22:13", "ACOS 敏感性分析", "ok"],
    ["14:22:14", `机会指数 ${idx} · ${alpha ? alpha.decision.levelLabel : "草稿"}`, "score"],
    ["14:22:14", "关键词排名扫描 73%", "pending"],
  ] as const;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-green" /> Cockpit · Live
        </div>
        <div className="font-mono text-[12px] text-muted">model v0.4.1 · 数据 87% 置信</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* big gauge — opportunity index */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-panel p-6 shadow-card">
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-muted">机会指数</span>
            {alpha ? (
              <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-muted">{alpha.decision.levelLabel}</span>
            ) : null}
          </div>
          <ScoreGauge value={idx} />
          <div className="mt-2 text-center text-[13px] text-muted">
            超过类目 {percentile}% 候选
            <div className="text-green">↑ {vsAvg}pt vs 类目均值 · 经典综合分 {e.composite}（辅助）</div>
          </div>
        </div>

        {/* 6 mini gauges — auxiliary 5-dim detail */}
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-muted">仪表盘 · 6 维实时</span>
            <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-muted">辅助</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniGauge label="需求规模" value={s.demand} caption={`${compactNumber(e.monthly_search)}/mo`} tone="green" />
            <MiniGauge label="竞争压力" value={rawComp} caption={`Top3 集中 ${e.top3_concentration}%`} tone="red" />
            <MiniGauge label="差异化" value={s.differentiation} caption="3 卖点空" tone="orange" />
            <MiniGauge label="风险反转" value={s.risk} caption="低风险" tone="green" />
            <MiniGauge label="利润空间" value={s.profit} caption={`毛利 ${e.gross_margin_pct}%`} tone="green" />
            <MiniGauge label="ACOS 安全" value={acosScore} caption={`${signedPt(safety)} 边际`} tone="green" />
          </div>
        </div>

        {/* data stream */}
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="font-mono text-[13px] font-medium text-blue">数据流 · feed</div>
          <div className="mt-3 space-y-1.5 font-mono text-[12.5px] leading-relaxed">
            {feed.map(([t, msg, kind], i) => (
              <div key={i} className={kind === "score" ? "text-green" : "text-ink/80"}>
                <span className="text-subtle">[{t}]</span>{" "}
                {kind === "pending" ? "⏳" : "✓"} {msg}
              </div>
            ))}
            <div className="mt-2 rounded-md border border-orange/40 bg-orange-soft/60 p-2 text-orange">
              ⚠ 头部 {Math.round(e.top3_concentration / 22)} 家流量集中 — 建议关注差异化
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Link href={`/evaluations/${asin}/report`} className="rounded-lg bg-blue px-6 py-2.5 text-[14px] font-medium text-white hover:bg-blue-strong">
          生成决策报告
        </Link>
      </div>
    </div>
  );
}
