import { notFound } from "next/navigation";
import { Pill } from "@/components/Badge";
import { Donut } from "@/components/charts/Donut";
import { Histogram } from "@/components/charts/Bars";
import { KeywordGapCard } from "@/components/KeywordGapCard";
import {
  getEvaluationByAsin,
  getKeywords,
  getSeller,
  getKeywordInsight,
} from "@/lib/queries";
import { usd, compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const COMP_TONE: Record<string, string> = {
  high: "border-red/40 text-red bg-red-soft",
  mid: "border-orange/40 text-orange bg-orange-soft",
  low: "border-green/40 text-green bg-green-soft",
};

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  if (!e) notFound();
  const keywords = await getKeywords(e.id);
  const seller = await getSeller();
  const keywordInsight = seller ? await getKeywordInsight(seller.id, e.asin) : null;

  const main = keywords[0];
  const top1 = main?.top1_pct ?? Math.round(e.top3_concentration * 0.4);
  const top3 = main?.top3_pct ?? e.top3_concentration;
  const top23 = Math.max(0, top3 - top1);
  const longtail = Math.max(0, 100 - top3);

  const bins = new Array(8).fill(0);
  for (const k of keywords) {
    const idx = Math.min(7, Math.max(0, Math.floor(((k.cpc - 0.4) / (2.0 - 0.4)) * 8)));
    bins[idx] += 1;
  }
  const markerFrac = (e.weighted_cpc - 0.4) / (2.0 - 0.4);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[14px] text-muted">
          {keywords.length} 词 · 月搜索 {compactNumber(e.monthly_search)} · 加权 CPC{" "}
          <span className="font-mono font-medium text-ink">{usd(e.weighted_cpc)}</span>
        </div>
        <div className="flex gap-2">
          <Pill>近 30d</Pill>
          <Pill>US</Pill>
          <Pill>desktop+mobile</Pill>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* table */}
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          {keywords.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line p-8 text-center text-muted">
              该评估暂无关键词明细。主关键词：
              <span className="font-mono text-ink"> {e.main_keyword || "—"}</span>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="pb-2 font-normal">关键词</th>
                  <th className="pb-2 text-right font-normal">月搜索</th>
                  <th className="pb-2 text-right font-normal">CPC</th>
                  <th className="pb-2 text-center font-normal">竞争</th>
                  <th className="pb-2 text-right font-normal">Top1%</th>
                  <th className="pb-2 text-right font-normal">Top3%</th>
                  <th className="pb-2 text-right font-normal">流量</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k) => (
                  <tr key={k.id} className="border-t border-line text-[14px]">
                    <td className="py-2.5">{k.keyword}</td>
                    <td className="py-2.5 text-right font-mono">{k.monthly_search.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono">{usd(k.cpc)}</td>
                    <td className="py-2.5 text-center">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${COMP_TONE[k.competition]}`}>
                        {k.competition}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono">{k.top1_pct}%</td>
                    <td className={`py-2.5 text-right font-mono ${k.top3_pct >= 65 ? "text-red" : ""}`}>{k.top3_pct}%</td>
                    <td className="py-2.5 text-right font-mono text-muted">{k.traffic_share_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* side panels */}
        <div className="space-y-5">
          <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
            <div className="text-[13px] font-medium text-muted">头部集中度 · TOP-N 流量份额</div>
            <div className="mt-3">
              <Donut
                centerTop={`${top3}%`}
                centerBottom="Top3"
                slices={[
                  { label: "Top1 卖家", value: top1, color: "#dc2626" },
                  { label: "Top2-3", value: top23, color: "#d97706" },
                  { label: "长尾", value: longtail, color: "#9ca3af" },
                ]}
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
            <div className="text-[13px] font-medium text-muted">CPC 分布</div>
            <div className="mt-4">
              <Histogram
                bins={bins}
                labels={["$0.4", "$1.0", "$1.5", "$2.0"]}
                markerFrac={Math.max(0, Math.min(1, markerFrac))}
                markerLabel={`${usd(e.weighted_cpc)} 加权`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-orange/30 bg-orange-soft/60 p-4">
            <div className="text-[14px] font-medium text-orange">⚠ 风险提示</div>
            <p className="mt-1.5 text-[14px] leading-relaxed">
              Top3 集中度 {top3}% · 头部 3 家垄断核心词流量。突围路径：转化率优化 + 长尾词组合（占比 {longtail}%），避免与头部硬刚 CPC。
            </p>
          </div>
        </div>
      </div>

      {keywordInsight ? <KeywordGapCard ki={keywordInsight} /> : null}
    </div>
  );
}
