import { notFound } from "next/navigation";
import { Simulator } from "@/components/Simulator";
import { getEvaluationByAsin, pnlInputsFor } from "@/lib/queries";
import { computePnl } from "@/lib/economics";

export const dynamic = "force-dynamic";

export default async function SimulatorPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  if (!e) notFound();

  const base = pnlInputsFor(e);
  const prevNet = computePnl(base).monthlyNetCny;

  return (
    <div className="rounded-xl border border-line bg-panel p-6 shadow-card">
      <h2 className="text-[17px] font-semibold">盈亏模拟器</h2>
      <p className="mt-1 text-[14px] text-muted">拖动滑块 · 实时看到净利、利润率、盈亏临界点</p>
      <div className="mt-5">
        <Simulator base={base} prevNetCny={prevNet} />
      </div>
    </div>
  );
}
