"use client";

import { useMemo, useState } from "react";
import { computePnl, type PnlInputs, FX_USD_CNY } from "@/lib/economics";
import { cny, usd, pct } from "@/lib/format";

interface SliderDef {
  key: keyof PnlInputs;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  { key: "priceUsd", label: "售价 USD", min: 5, max: 40, step: 0.5, fmt: (v) => usd(v) },
  { key: "costCny", label: "采购成本 CNY", min: 2, max: 60, step: 0.5, fmt: (v) => `¥${v.toFixed(1)}` },
  { key: "freightCny", label: "头程物流 / 件 CNY", min: 0, max: 30, step: 0.2, fmt: (v) => `¥${v.toFixed(1)}` },
  { key: "commissionPct", label: "平台佣金", min: 8, max: 20, step: 1, fmt: (v) => pct(v) },
  { key: "monthlyUnits", label: "月销量", min: 50, max: 3000, step: 10, fmt: (v) => `${v} 件` },
  { key: "returnRatePct", label: "退货率", min: 0, max: 20, step: 0.1, fmt: (v) => pct(v, 1) },
  { key: "acosPct", label: "ACOS", min: 1, max: 45, step: 1, fmt: (v) => pct(v) },
];

export function Simulator({
  base,
  prevNetCny,
}: {
  base: PnlInputs;
  prevNetCny: number;
}) {
  const [inputs, setInputs] = useState<PnlInputs>(base);
  const pnl = useMemo(() => computePnl(inputs), [inputs]);

  const set = (k: keyof PnlInputs, v: number) =>
    setInputs((s) => ({ ...s, [k]: v }));

  // unit cost structure (USD per unit, as fraction of price)
  const price = inputs.priceUsd;
  const landed = (inputs.costCny + inputs.freightCny) / FX_USD_CNY;
  const commission = price * (inputs.commissionPct / 100);
  const ad = pnl.adCostPerUnit;
  const fba = 0; // folded into amazon fee elsewhere; show commission as platform fee
  const profit = Math.max(0, pnl.contributionPerUnit);
  const segs = [
    { label: "采购", v: landed, color: "#b3ad99" },
    { label: "佣金", v: commission, color: "#c8731f" },
    { label: "广告", v: ad, color: "#c0392b" },
    { label: "利润", v: profit, color: "#4f8a4f" },
  ];
  const segTotal = segs.reduce((a, s) => a + s.v, 0) || 1;

  const delta = pnl.monthlyNetCny - prevNetCny;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* inputs */}
      <div>
        <div className="font-serif text-[16px] text-blue">输入变量</div>
        <div className="mt-3 space-y-4">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between font-serif text-[15px]">
                <span>{s.label}</span>
                <span className={`font-mono ${s.key === "acosPct" || s.key === "priceUsd" ? "text-blue" : ""}`}>
                  {s.fmt(inputs[s.key])}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={inputs[s.key]}
                onChange={(e) => set(s.key, Number(e.target.value))}
                className="mt-1.5 w-full"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-dashed border-line p-3 font-serif text-[14px] text-muted">
          💡 锁定 2 个变量 · 求解第 3 个（盈亏临界 ACOS ≈ {pct(pnl.breakevenAcosPct)}）
        </div>
      </div>

      {/* outputs */}
      <div className="space-y-4">
        <div className="rounded-xl border border-line p-5">
          <div className="font-serif text-[14px] text-muted">月净利润</div>
          <div className={`mt-1 font-mono text-5xl font-bold ${pnl.monthlyNetCny < 0 ? "text-red" : "text-green"}`}>
            {cny(pnl.monthlyNetCny)}
          </div>
          <div className="mt-1 text-[13px] text-muted">广告后 · 净利率 {pct(pnl.netMarginPct)}</div>
        </div>

        <div className="rounded-xl border border-line p-5">
          <div className="font-serif text-[14px] text-muted">
            单件结构 · {usd(price)}
          </div>
          <div className="mt-3 flex h-7 w-full overflow-hidden rounded-md">
            {segs.map((s) => (
              <div
                key={s.label}
                style={{ width: `${(s.v / segTotal) * 100}%`, background: s.color }}
                className="flex items-center justify-center text-[11px] text-white"
                title={`${s.label} ${usd(s.v)}`}
              >
                {s.v / segTotal > 0.12 ? s.label : ""}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-muted">
            {segs.map((s) => (
              <span key={s.label}>
                <span style={{ color: s.color }}>■</span> {s.label} {Math.round((s.v / segTotal) * 100)}%
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-line p-4">
          <div className="font-serif text-[14px] text-muted">vs 上一版方案</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-2xl font-bold ${delta >= 0 ? "text-green" : "text-red"}`}>
              {delta >= 0 ? "+" : ""}{cny(delta)}
            </span>
            <span className="text-[13px] text-muted">月净利变化</span>
          </div>
          <button
            onClick={() => setInputs(base)}
            className="mt-3 rounded-lg border border-line px-4 py-1.5 font-serif text-[14px]"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
