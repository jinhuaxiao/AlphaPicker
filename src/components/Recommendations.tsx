"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Rec {
  asin: string;
  name: string;
  image: string;
  category: string;
  price: number;
  monthlyUnits: number;
  opportunityIndex: number;
  level: string;
  levelLabel: string;
  netMarginAfterTacosPct: number;
  top3Concentration: number;
  gatePass: boolean;
}

const LEVEL_TONE: Record<string, string> = {
  enter_and_scale: "border-green/40 bg-green-soft text-green",
  enter: "border-blue/40 bg-blue-soft text-blue",
  observe_or_micro_test: "border-orange/40 bg-orange-soft text-orange",
  avoid: "border-red/40 bg-red-soft text-red",
};
const idxColor = (i: number) =>
  i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";

export function Recommendations({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Rec[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const variety = useRef(0);

  async function load(next = false) {
    setErr(null);
    setItems(null);
    if (next) variety.current += 1;
    try {
      const r = await fetch(`/api/recommend?v=${variety.current}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "推荐失败");
      setItems(d.items || []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(asin: string) {
    setAdding(asin);
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asin, source: "amazon", site: "US" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "加入失败");
      router.push(`/evaluations/${d.asin}/decision`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setAdding(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[14px] text-muted">
          基于你的画像类目（{categories.join(" / ") || "通用"}）与预算，按机会指数排序的真实候选。
        </div>
        <button
          onClick={() => load(true)}
          disabled={items === null && !err}
          className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[13px] font-medium hover:bg-panel-2 disabled:opacity-60"
        >
          重新生成
        </button>
      </div>

      {err ? <div className="mb-3 text-[14px] text-red">⚠ {err}</div> : null}

      {items === null && !err ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-line bg-panel-2/60" />
          ))}
        </div>
      ) : items && items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.asin} className="flex flex-col rounded-xl border border-line bg-panel p-4 shadow-card">
              <div className="flex gap-3">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-panel-2" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[14px] font-medium leading-snug">{it.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">{it.category}</div>
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-muted">机会指数</div>
                  <div className={`font-mono text-3xl font-bold ${idxColor(it.opportunityIndex)}`}>
                    {it.opportunityIndex}
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[12px] ${LEVEL_TONE[it.level]}`}>
                  {it.levelLabel}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 border-t border-line pt-2 text-[12px]">
                <Mini k="售价" v={`$${it.price}`} />
                <Mini k="月销" v={it.monthlyUnits.toLocaleString()} />
                <Mini k="Top3" v={`${it.top3Concentration}%`} />
              </div>

              <button
                onClick={() => add(it.asin)}
                disabled={!!adding}
                className="mt-3 rounded-lg bg-blue px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-strong disabled:opacity-60"
              >
                {adding === it.asin ? "拉取数据中…" : "加入评估 · 看决策"}
              </button>
            </div>
          ))}
        </div>
      ) : items ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          暂无符合画像的候选，去<a href="/profile" className="text-blue">完善卖家画像</a>或调整类目后重试。
        </div>
      ) : null}
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="text-center">
      <div className="text-muted">{k}</div>
      <div className="font-mono font-medium text-ink">{v}</div>
    </div>
  );
}
