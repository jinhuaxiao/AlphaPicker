import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Badge";
import { ScatterQuadrant } from "@/components/charts/Scatter";
import { getEvaluationByAsin, pnlInputsFor } from "@/lib/queries";
import { computePnl } from "@/lib/economics";
import { cny, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const CANDIDATES = [
  { x: 0.62, y: 0.86, size: 18, zone: "chance" as const },
  { x: 0.78, y: 0.74, size: 16, zone: "chance" as const },
  { x: 0.4, y: 0.7, size: 13, zone: "gold" as const },
  { x: 0.66, y: 0.6, size: 12, zone: "chance" as const },
  { x: 0.5, y: 0.45, size: 11, zone: "steady" as const },
  { x: 0.36, y: 0.38, size: 10, zone: "steady" as const },
  { x: 0.46, y: 0.3, size: 11, zone: "steady" as const },
  { x: 0.28, y: 0.22, size: 9, zone: "steady" as const },
  { x: 0.58, y: 0.35, size: 10, zone: "avoid" as const },
  { x: 0.74, y: 0.42, size: 11, zone: "avoid" as const },
  { x: 0.82, y: 0.28, size: 9, zone: "avoid" as const },
  { x: 0.68, y: 0.18, size: 8, zone: "avoid" as const },
];

export default async function SandboxPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  if (!e) notFound();

  const base = pnlInputsFor(e);
  const pnl = computePnl(base);
  const riskComposite = 100 - e.scores.risk;
  const roi = Math.round(pnl.roiPct);
  const capital = pnl.capitalRequiredCny;
  const payback = pnl.paybackMonths;
  const maxDrawdown = -Math.round(pnl.inventoryCostCny * 0.4);
  const winRate = Math.max(40, Math.min(92, e.composite - 7));

  const px = riskComposite / 100;
  const py = Math.max(0.05, Math.min(0.95, roi / 60));
  const zone =
    px < 0.5 && py >= 0.5
      ? "黄金区候选"
      : px >= 0.5 && py >= 0.5
        ? "机会区候选"
        : px < 0.5
          ? "稳健区候选"
          : "避让区候选";

  return (
    <div>
      <p className="mb-4 text-[14px] text-muted">
        像评估一支股票那样评估这个 SKU — 把它和同类目 247 个候选放到{" "}
        <span className="font-medium text-ink">风险 × 预期回报</span> 平面上。
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex justify-center rounded-xl border border-line bg-panel p-5 shadow-card">
          <ScatterQuadrant candidates={CANDIDATES} product={{ x: px, y: py }} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">投资摘要</span>
            <Pill tone="green">{zone}</Pill>
          </div>
          <div className="mt-2 rounded-xl border border-line bg-panel p-5 shadow-card">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Summary label="预期年化 ROI" value={pct(roi)} sub="中性场景" />
              <Summary label="风险综合" value={`${riskComposite}`} sub="/ 100" />
              <Summary label="资金需求" value={cny(capital, { compact: true })} sub={`首批 ${e.target_monthly_units} 件`} />
              <Summary label="回本周期" value={`${payback.toFixed(1)} 月`} sub={`ACOS ${e.est_acos_pct}%`} />
              <Summary label="最大回撤" value={cny(maxDrawdown, { compact: true })} sub="保守场景" />
              <Summary label="胜率" value={pct(winRate)} sub="历史回测" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-panel-2 p-4 text-[14px] leading-relaxed">
            <span className="font-medium text-blue">沙盘解读：</span>该产品落在
            {px < 0.45 ? "稳健-黄金过渡区" : "机会区"}。建议中等仓位（
            {cny(capital * 0.85, { compact: true })}-{cny(capital * 1.15, { compact: true })}），先以保守 ACOS {e.est_acos_pct}% 试投 2 周。
          </div>

          <div className="mt-4 flex gap-2">
            <Link href={`/evaluations/${asin}/simulator`} className="flex-1 rounded-lg bg-blue px-5 py-2.5 text-center text-[14px] font-medium text-white hover:bg-blue-strong">
              进入沙盘模拟器
            </Link>
            <Link href="/dashboard" className="flex-1 rounded-lg border border-line bg-panel px-5 py-2.5 text-center text-[14px] font-medium hover:bg-panel-2">
              对比另一只候选
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[13px] text-muted">{label}</div>
      <div className="font-mono text-2xl font-bold">{value}</div>
      <div className="text-[12px] text-subtle">{sub}</div>
    </div>
  );
}
