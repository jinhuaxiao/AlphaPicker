import { notFound } from "next/navigation";
import { EbayReference } from "@/components/EbayReference";
import { MarketInsightCard } from "@/components/MarketInsightCard";
import {
  getEvaluationByAsin,
  getSeller,
  getMarketInsight,
  getReviewInsight,
  pnlInputsFor,
} from "@/lib/queries";
import { acosSafety, computePnl, computeScenarios } from "@/lib/economics";
import { runAlpha, type DecisionLevel } from "@/lib/alpha";
import { toVocPainPoints } from "@/lib/reviews";
import { DIMENSION_LABELS, WEIGHTS_BY_EXPERIENCE } from "@/lib/scoring";
import { cny, pct, usd, signedPt } from "@/lib/format";

export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<DecisionLevel, { ring: string; bg: string; badge: string }> = {
  enter_and_scale: { ring: "border-green/30", bg: "bg-green-soft", badge: "border-green/40 bg-green-soft text-green" },
  enter: { ring: "border-blue/30", bg: "bg-blue-soft", badge: "border-blue/40 bg-blue-soft text-blue" },
  observe_or_micro_test: { ring: "border-orange/30", bg: "bg-orange-soft", badge: "border-orange/40 bg-orange-soft text-orange" },
  avoid: { ring: "border-red/30", bg: "bg-red-soft", badge: "border-red/40 bg-red-soft text-red" },
};
const indexColor = (i: number) =>
  i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  const seller = await getSeller();
  if (!e || !seller) notFound();
  const [marketInsight, reviewInsight] = await Promise.all([
    getMarketInsight(seller.id, e.asin),
    getReviewInsight(seller.id, e.asin),
  ]);

  const base = pnlInputsFor(e);
  const pnl = computePnl(base);
  const band = acosSafety(base);
  const { results, weightedRoiPct, weightedNetCny } = computeScenarios(base);
  const w = WEIGHTS_BY_EXPERIENCE[seller.experience];

  // Same opportunity index as the 机会决策 tab — one source of truth, live.
  const vocOverride = reviewInsight?.painPoints.length
    ? toVocPainPoints(reviewInsight.painPoints)
    : undefined;
  const alpha = e.status !== "draft" ? runAlpha(e, seller, [], {}, vocOverride) : null;
  const tone = alpha ? LEVEL_TONE[alpha.decision.level] : LEVEL_TONE.avoid;

  const dims: { key: keyof typeof DIMENSION_LABELS; weight: number }[] = [
    { key: "demand", weight: w.demand },
    { key: "competition", weight: w.competition },
    { key: "profit", weight: w.profit },
    { key: "differentiation", weight: w.differentiation },
    { key: "risk", weight: w.risk },
  ];

  return (
    <div className="space-y-5">
      {/* verdict — opportunity index (live), same as 机会决策 */}
      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        <div className={`flex min-w-[150px] flex-col items-center justify-center rounded-xl border ${tone.ring} ${tone.bg} p-6 text-center`}>
          <div className="text-[13px] font-medium text-muted">机会指数</div>
          <div className={`font-mono text-6xl font-bold ${alpha ? indexColor(alpha.opportunityIndex) : "text-muted"}`}>
            {alpha ? alpha.opportunityIndex : "—"}
          </div>
          <div className="font-mono text-[13px] text-muted">/ 100</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">结论：</span>
            {alpha ? (
              <span className={`rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${tone.badge}`}>
                {alpha.decision.levelLabel}
              </span>
            ) : (
              <span className="text-[14px] text-muted">草稿 · 数据未完成，无法形成结论</span>
            )}
          </div>
          {alpha ? (
            <>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink/90">{alpha.decision.recommendation}</p>
              <ul className="mt-1.5 space-y-0.5 text-[13px] text-muted">
                {alpha.decision.reasoning.map((x, i) => (
                  <li key={i}>· {x}</li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="加权预期 ROI" value={pct(weightedRoiPct)} />
            <Mini label="加权月净利" value={cny(weightedNetCny, { compact: true })} />
            <Mini label="ACOS 安全边际" value={signedPt(band.safetyPt)} tone={band.safetyPt >= 0 ? "green" : "red"} />
            <Mini label="回本周期" value={`${pnl.paybackMonths.toFixed(1)} 月`} />
          </div>
        </div>
      </div>

      {/* auxiliary 5-dim (reference only) + economics */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">辅助评分 · 经典五维加权</span>
            <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-muted">参考 · 不参与决策</span>
          </div>
          <div className="mt-1 text-[12px] text-muted">
            综合分 <span className="font-mono font-semibold text-ink">{e.composite}</span> · 导入时快照，仅作历史参考；进入与否以上方机会指数为准。
          </div>
          <table className="mt-2 w-full text-left text-[14px]">
            <tbody>
              {dims.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="py-2">{DIMENSION_LABELS[d.key]}</td>
                  <td className="py-2 text-muted">权重 {d.weight}%</td>
                  <td className="py-2">
                    <div className="h-2 w-full rounded bg-panel-2">
                      <div className="h-2 rounded bg-subtle" style={{ width: `${e.scores[d.key]}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-right font-mono font-bold">{e.scores[d.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="text-[15px] font-semibold">单位经济 · 中性场景</div>
          <table className="mt-2 w-full text-left text-[14px]">
            <tbody>
              <Row label="售价 / 采购" value={`${usd(e.price_usd)} / ${cny(e.cost_cny)}`} />
              <Row label="单件净贡献" value={usd(pnl.contributionPerUnit)} />
              <Row label="月净利" value={cny(pnl.monthlyNetCny)} />
              <Row label="净利率" value={pct(pnl.netMarginPct)} />
              <Row label="资金需求" value={cny(pnl.capitalRequiredCny, { compact: true })} />
              <Row label="预估 / 临界 ACOS" value={`${pct(band.estAcosPct)} / ${pct(band.maxAcceptableAcosPct)}`} />
            </tbody>
          </table>
        </div>
      </div>

      {/* market capacity & trend */}
      {marketInsight ? <MarketInsightCard mi={marketInsight} /> : null}

      {/* cross-platform reference */}
      <EbayReference query={e.main_keyword || e.name} amazonPrice={e.price_usd} />

      {/* scenarios summary */}
      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="text-[15px] font-semibold">三场景 · 概率加权</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {results.map((s) => (
            <div key={s.key} className="rounded-lg border border-line p-3">
              <div className="flex justify-between">
                <span className="font-medium">{s.label}</span>
                <span className="text-[12px] text-muted">{Math.round(s.probability * 100)}%</span>
              </div>
              <div className="mt-1 font-mono text-xl font-bold">{cny(s.monthlyNetCny, { compact: true })}</div>
              <div className="text-[12px] text-muted">ROI {pct(s.roiPct)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`font-mono text-lg font-bold ${tone === "green" ? "text-green" : tone === "red" ? "text-red" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-line">
      <td className="py-2 text-muted">{label}</td>
      <td className="py-2 text-right font-mono">{value}</td>
    </tr>
  );
}
