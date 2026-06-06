import type { Evaluation } from "@/lib/types";
import { usd, cny } from "@/lib/format";

export function ProductHeader({ e }: { e: Evaluation }) {
  return (
    <div className="flex items-center gap-4 border-b border-dashed border-line pb-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-[12px] text-muted">
        img
      </div>
      <div className="min-w-0">
        <h2 className="font-serif text-2xl">{e.name}</h2>
        <p className="mt-0.5 truncate text-[14px] text-muted">
          {e.category_path} · ASIN{" "}
          <span className="font-mono text-ink">{e.asin}</span> · {usd(e.price_usd)} · 成本{" "}
          {cny(e.cost_cny)} + {usd(e.fba_fee_usd)} FBA
        </p>
      </div>
    </div>
  );
}
