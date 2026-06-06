import { notFound } from "next/navigation";
import { getEvaluationByAsin, pnlInputsFor } from "@/lib/queries";
import { acosSafety, netAtAcos } from "@/lib/economics";
import { cny, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AcosPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  if (!e) notFound();

  const base = pnlInputsFor(e);
  const band = acosSafety(base);
  const est = band.estAcosPct;
  const maxAcos = band.maxAcceptableAcosPct;

  const scaleMax = Math.max(maxAcos * 1.35, est + 10);
  const safeFrac = Math.min(1, maxAcos / scaleMax);
  const estFrac = Math.min(1, est / scaleMax);

  const baseNet = netAtAcos(base, est);
  const strip = [-5, 0, 5, 10, 15].map((d) => ({
    delta: d,
    acos: est + d,
    net: netAtAcos(base, est + d),
  }));

  return (
    <div className="rounded-xl border border-line bg-panel p-6 shadow-card">
      <h2 className="text-[17px] font-semibold">ACOS 安全边际</h2>
      <p className="mt-1 text-[14px] text-muted">广告成本占比 vs 你的利润结构所能承受的极限</p>

      {/* bar */}
      <div className="mt-7">
        <div className="relative h-9 overflow-visible rounded-lg border border-line bg-orange-soft/60">
          <div className="h-full rounded-l-lg bg-green-soft" style={{ width: `${safeFrac * 100}%` }} />
          <div className="absolute -top-2 bottom-[-8px] w-0.5 bg-blue" style={{ left: `${estFrac * 100}%` }}>
            <span className="absolute -top-6 left-1 whitespace-nowrap font-mono text-[12px] text-blue">
              当前 {est}%
            </span>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[13px]">
          <span className="text-muted">0%</span>
          <span className="text-green">安全区</span>
          <span className="text-orange">警戒区 · 临界 {maxAcos}%</span>
        </div>
      </div>

      {/* cards */}
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel-2 p-5">
          <div className="text-[14px] text-muted">预估 ACOS</div>
          <div className="mt-1 font-mono text-5xl font-bold">{pct(est)}</div>
          <div className="mt-1 text-[13px] text-muted">基于关键词加权 CPC · 转化率 {e.conversion_pct}%</div>
        </div>
        <div className="rounded-xl border border-blue/30 bg-blue-soft p-5">
          <div className="text-[14px] font-medium text-blue">最大可承受 ACOS</div>
          <div className="mt-1 font-mono text-5xl font-bold text-blue">{pct(maxAcos)}</div>
          <div className="mt-1 text-[13px] text-muted">盈亏临界 · 净利 → 0</div>
        </div>
      </div>

      {/* sensitivity strip */}
      <div className="mt-7">
        <div className="text-[14px] font-medium text-muted">敏感性 · ACOS 每 +5pt 对净利的冲击</div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          {strip.map((c) => {
            const isBase = c.delta === 0;
            const better = c.net > baseNet;
            return (
              <div key={c.delta} className={`rounded-lg border p-3 text-center ${isBase ? "border-blue/30 bg-blue-soft" : "border-line"}`}>
                <div className="text-[12px] text-muted">
                  {isBase ? "基线" : c.delta > 0 ? `+${c.delta}pt` : `${c.delta}pt`} · ACOS {c.acos}%
                </div>
                <div className={`mt-1 font-mono text-xl font-bold ${isBase ? "text-blue" : c.net < 0 ? "text-red" : better ? "text-green" : "text-orange"}`}>
                  {cny(c.net, { compact: true })}
                </div>
                <div className="text-[12px] text-subtle">月净利</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
