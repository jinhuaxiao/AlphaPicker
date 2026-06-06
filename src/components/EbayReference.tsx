"use client";

import { useEffect, useState } from "react";

interface Ref {
  total: number;
  count: number;
  currency: string;
  min: number;
  median: number;
  max: number;
  items: { title: string; price: number; currency: string; url: string; image: string }[];
}

export function EbayReference({
  query,
  amazonPrice,
}: {
  query: string;
  amazonPrice: number;
}) {
  const [data, setData] = useState<Ref | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!query) return;
    fetch(`/api/ebay?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setErr(d.error);
        else setData(d);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [query]);

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const delta =
    data && data.median && amazonPrice
      ? Math.round(((amazonPrice - data.median) / data.median) * 100)
      : null;

  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold">跨平台参考 · eBay</div>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">Browse API · 实时</span>
      </div>
      <div className="mt-1 text-[12px] text-muted">关键词「{query}」在 eBay 的在售行情</div>

      {err ? (
        <div className="mt-3 text-[13px] text-muted">eBay 数据暂不可用（{err.slice(0, 60)}）</div>
      ) : !data ? (
        <div className="mt-3 text-[13px] text-muted">加载中…</div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[12px] text-muted">在售（FIXED）</div>
              <div className="font-mono text-xl font-bold">{data.total.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">价格区间</div>
              <div className="font-mono text-xl font-bold">{fmt(data.min)}–{fmt(data.max)}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">中位价</div>
              <div className="font-mono text-xl font-bold">{fmt(data.median)}</div>
            </div>
          </div>
          {delta !== null ? (
            <div className="mt-2 text-[13px]">
              Amazon 售价 <span className="font-mono">{fmt(amazonPrice)}</span> ·{" "}
              <span className={delta > 0 ? "text-orange" : "text-green"}>
                {delta > 0 ? `较 eBay 中位高 ${delta}%` : `较 eBay 中位低 ${Math.abs(delta)}%`}
              </span>
            </div>
          ) : null}
          {data.items.length ? (
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              {data.items.slice(0, 4).map((it, i) => (
                <a
                  key={i}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-between gap-3 text-[13px] hover:text-blue"
                >
                  <span className="truncate text-muted">{it.title}</span>
                  <span className="shrink-0 font-mono">{fmt(it.price)}</span>
                </a>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
