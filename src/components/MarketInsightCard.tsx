import type { MarketInsight } from "@/lib/market";
import type { TrendPoint } from "@/lib/sorftime";

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** Tiny inline-SVG sparkline for a monthly series. */
function Sparkline({
  data,
  color = "var(--color-blue, #4f46e5)",
  w = 260,
  h = 48,
}: {
  data: TrendPoint[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (data.length < 2) {
    return <div className="text-[12px] text-muted">趋势数据不足</div>;
  }
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 3;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.value - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
      <polyline points={area} fill={color} opacity={0.08} stroke="none" />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.6} fill={color} />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`font-mono text-[15px] font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function MarketInsightCard({ mi }: { mi: MarketInsight }) {
  const growthTone = mi.growthYoyPct > 0 ? "text-green" : mi.growthYoyPct < 0 ? "text-red" : "";
  const amazonTone = mi.amazonOwnedShare >= 50 ? "text-red" : mi.amazonOwnedShare >= 25 ? "text-orange" : "";
  const catSeries = mi.categoryTrend.slice(-18);
  const prodSeries = mi.productTrend.slice(-18);

  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">市场容量与趋势</span>
          {mi.categoryName ? (
            <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[12px] text-muted">
              {mi.categoryName}
            </span>
          ) : null}
        </div>
        <span className="rounded-full border border-green/40 bg-green-soft px-2 py-0.5 text-[11px] text-green">
          Sorftime 类目实时
        </span>
      </div>

      {/* capacity headline */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="市场容量 · 月销量" value={`${compact(mi.tamUnits)} 件`} />
        <Stat label="市场容量 · 月销额" value={`$${compact(mi.tamRevenueUsd)}`} />
        <Stat label="同比增长" value={`${mi.growthYoyPct > 0 ? "+" : ""}${mi.growthYoyPct}%`} tone={growthTone} />
        <Stat label="季节高峰" value={mi.peakMonth || "—"} />
      </div>

      {/* trend sparklines */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <div className="mb-1 text-[12px] text-muted">类目月销量趋势（近 {catSeries.length} 月）</div>
          <Sparkline data={catSeries} />
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="mb-1 text-[12px] text-muted">本品月销量趋势（近 {prodSeries.length} 月）</div>
          <Sparkline data={prodSeries} color="#0ea5e9" />
        </div>
      </div>

      {/* market structure */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Top3 产品集中度" value={`${mi.top3ProductShare}%`} tone={mi.top3ProductShare >= 60 ? "text-orange" : ""} />
        <Stat label="Top3 品牌集中度" value={`${mi.top3BrandShare}%`} />
        <Stat label="Top3 卖家集中度" value={`${mi.top3SellerShare}%`} tone={mi.top3SellerShare >= 60 ? "text-orange" : ""} />
        <Stat label="亚马逊自营占比" value={`${mi.amazonOwnedShare}%`} tone={amazonTone} />
        <Stat label="均价 / 中位价" value={`$${mi.avgPrice} / $${mi.medianPrice}`} />
        <Stat label="评论壁垒 (>1k)" value={`${mi.highReviewsShare}%`} tone={mi.highReviewsShare >= 80 ? "text-orange" : ""} />
      </div>

      {mi.amazonOwnedShare >= 50 ? (
        <p className="mt-3 rounded-lg border border-dashed border-red/40 bg-red-soft/30 p-2.5 text-[13px] text-red">
          ⚠ 亚马逊自营占据 {mi.amazonOwnedShare}% 销量，第三方卖家进入空间受限。
        </p>
      ) : mi.highReviewsShare >= 80 ? (
        <p className="mt-3 rounded-lg border border-dashed border-orange/40 bg-orange-soft/30 p-2.5 text-[13px] text-orange">
          ⚠ {mi.highReviewsShare}% 的销量集中在评论数 1000+ 的产品，新品需跨越评论壁垒。
        </p>
      ) : null}
    </div>
  );
}
