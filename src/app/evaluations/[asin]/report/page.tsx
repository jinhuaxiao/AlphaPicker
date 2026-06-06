import { notFound } from "next/navigation";
import { EbayReference } from "@/components/EbayReference";
import { MarketInsightCard } from "@/components/MarketInsightCard";
import {
  getEvaluationByAsin,
  getSeller,
  getMarketInsight,
  pnlInputsFor,
} from "@/lib/queries";
import { acosSafety, computePnl, computeScenarios } from "@/lib/economics";
import { DIMENSION_LABELS, WEIGHTS_BY_EXPERIENCE } from "@/lib/scoring";
import { STATUS_META } from "@/lib/types";
import { cny, pct, usd, signedPt } from "@/lib/format";

export const dynamic = "force-dynamic";

const VERDICT_COPY: Record<string, string> = {
  recommend: "推荐进入 · 该 SKU 落在稳健-黄金过渡区，建议中等仓位试投。",
  watch: "建议观望 · 利润或竞争结构存在不确定，先小仓位验证再加码。",
  avoid: "不建议进入 · 风险结构或 ACOS 安全边际不足，避免占用备货资金。",
  draft: "草稿 · 数据未完成，无法形成结论。",
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  const seller = await getSeller();
  if (!e || !seller) notFound();
  const marketInsight = await getMarketInsight(seller.id, e.asin);

  const base = pnlInputsFor(e);
  const pnl = computePnl(base);
  const band = acosSafety(base);
  const { results, weightedRoiPct, weightedNetCny } = computeScenarios(base);
  const w = WEIGHTS_BY_EXPERIENCE[seller.experience];

  const dims: { key: keyof typeof DIMENSION_LABELS; weight: number }[] = [
    { key: "demand", weight: w.demand },
    { key: "competition", weight: w.competition },
    { key: "profit", weight: w.profit },
    { key: "differentiation", weight: w.differentiation },
    { key: "risk", weight: w.risk },
  ];

  return (
    <div className="space-y-5">
      {/* verdict */}
      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-blue/30 bg-blue-soft p-6 text-center">
          <div className="text-[13px] font-medium text-blue">综合评分</div>
          <div className="font-mono text-6xl font-bold text-blue">{e.composite}</div>
          <div className="font-mono text-[13px] text-blue/60">/ 100</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="text-[15px] font-semibold">
            结论：{STATUS_META[e.status].label}
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-ink/90">{VERDICT_COPY[e.status]}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="加权预期 ROI" value={pct(weightedRoiPct)} />
            <Mini label="加权月净利" value={cny(weightedNetCny, { compact: true })} />
            <Mini label="ACOS 安全边际" value={signedPt(band.safetyPt)} tone={band.safetyPt >= 0 ? "green" : "red"} />
            <Mini label="回本周期" value={`${pnl.paybackMonths.toFixed(1)} 月`} />
          </div>
        </div>
      </div>

      {/* dimensions + economics */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="text-[15px] font-semibold">评分构成 · 权重</div>
          <table className="mt-2 w-full text-left text-[14px]">
            <tbody>
              {dims.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="py-2">{DIMENSION_LABELS[d.key]}</td>
                  <td className="py-2 text-muted">权重 {d.weight}%</td>
                  <td className="py-2">
                    <div className="h-2 w-full rounded bg-panel-2">
                      <div className="h-2 rounded bg-blue" style={{ width: `${e.scores[d.key]}%` }} />
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
