import { notFound } from "next/navigation";
import { getEvaluationByAsin, pnlInputsFor } from "@/lib/queries";
import { computeScenarios, type ScenarioResult } from "@/lib/economics";
import { cny, usd, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, { text: string; border: string; soft: string }> = {
  conservative: { text: "text-orange", border: "border-orange/40", soft: "" },
  neutral: { text: "text-blue", border: "border-blue/40", soft: "bg-blue-soft" },
  optimistic: { text: "text-green", border: "border-green/40", soft: "" },
};
const STROKE: Record<string, string> = {
  conservative: "var(--color-orange)",
  neutral: "var(--color-blue)",
  optimistic: "var(--color-green)",
};

function Spark({ slope, color }: { slope: number; color: string }) {
  const h = 48;
  const y1 = h - 6;
  const y2 = h - 6 - Math.min(h - 12, slope);
  return (
    <svg width="100%" height={h} viewBox={`0 0 120 ${h}`} preserveAspectRatio="none">
      <path d={`M2 ${y1} C 40 ${y1}, 70 ${(y1 + y2) / 2}, 118 ${y2}`} fill="none" stroke={color} strokeWidth={2} />
      <path d={`M2 ${y1} C 40 ${y1}, 70 ${(y1 + y2) / 2}, 118 ${y2} L118 ${h} L2 ${h} Z`} fill={color} fillOpacity={0.1} />
    </svg>
  );
}

function ScenarioCard({ s }: { s: ScenarioResult }) {
  const t = TONE[s.key];
  return (
    <div className={`rounded-xl border ${t.border} ${t.soft || "bg-panel"} p-5 shadow-card`}>
      <div className="flex items-start justify-between">
        <div className={`text-xl font-semibold ${t.text}`}>{s.label}</div>
        <div className="text-[12px] text-muted">{s.labelEn} · {Math.round(s.probability * 100)}%</div>
      </div>
      <div className="mt-3"><Spark slope={Math.max(6, s.roiPct * 0.5)} color={STROKE[s.key]} /></div>
      <div className="text-[12px] text-subtle">12 个月累计净利</div>

      <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[14px]">
        <div className="text-muted">月销量</div>
        <div className="text-right font-mono">{s.monthlyUnits} 件</div>
        <div className="text-muted">平均 CPC</div>
        <div className="text-right font-mono">{usd(s.cpcUsd)}</div>
        <div className="text-muted">转化率</div>
        <div className="text-right font-mono">{pct(s.conversionPct)}</div>
        <div className="text-muted">ACOS</div>
        <div className="text-right font-mono">{pct(s.acosPct)}</div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="text-[13px] text-muted">月净利</div>
        <div className={`font-mono text-3xl font-bold ${t.text}`}>{cny(s.monthlyNetCny)}</div>
        <div className="text-[13px] text-muted">
          年化 ROI <span className={`font-semibold ${t.text}`}>{pct(s.roiPct)}</span>
        </div>
      </div>
      {s.key === "neutral" ? <div className="mt-2 text-[13px] font-medium text-blue">★ 主推场景 · 模型基线</div> : null}
    </div>
  );
}

export default async function ScenariosPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  if (!e) notFound();

  const { results, weightedRoiPct, weightedNetCny } = computeScenarios(pnlInputsFor(e));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-muted">把单一预测拆成 3 个未来 · 概率加权后看真实期望</p>
        <div className="text-[14px] text-muted">
          加权预期 ROI <span className="font-mono font-semibold text-blue">{pct(weightedRoiPct)}</span> · 加权净利{" "}
          <span className="font-mono font-semibold text-blue">{cny(weightedNetCny)}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {results.map((s) => (
          <ScenarioCard key={s.key} s={s} />
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-line bg-panel p-4 shadow-card">
        <div className="mb-2 text-[14px] text-muted">概率权重</div>
        <div className="flex h-7 w-full overflow-hidden rounded-md">
          {results.map((s) => (
            <div
              key={s.key}
              style={{ width: `${s.probability * 100}%`, background: STROKE[s.key], opacity: 0.85 }}
              className="flex items-center justify-center text-[12px] font-medium text-white"
            >
              {s.label} {Math.round(s.probability * 100)}%
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
