"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  asin: string;
  title: string;
  brand: string;
  price: number;
  monthlyUnits: number;
  monthlyRevenue: number;
  star: number;
  reviews: number;
  image: string;
  subcategory: string;
}

const SITES = ["US", "UK", "DE", "FR", "JP", "CA"];
const ASIN_RE = /^[A-Z0-9]{10}$/i;

export function AmazonImport() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [site, setSite] = useState("US");
  const [source, setSource] = useState<"ebay" | "amazon">("ebay");
  const [costCny, setCostCny] = useState("");
  const [freightCny, setFreightCny] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setErr(null);
    setBusy(true);
    setItems(null);
    // eBay: build the evaluation straight from the keyword's live market.
    if (source === "ebay") {
      await runImport({ query: term });
      setBusy(false);
      return;
    }
    // Amazon/Sorftime: an ASIN imports directly, a keyword lists candidates.
    if (ASIN_RE.test(term)) {
      await runImport({ asin: term });
      setBusy(false);
      return;
    }
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(term)}&site=${site}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "搜索失败");
      setItems(d.items || []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport(body: { asin?: string; query?: string }) {
    setErr(null);
    setImporting(body.asin || body.query || "");
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body,
          site,
          source,
          cost_cny: costCny.trim() === "" ? undefined : Number(costCny),
          freight_cny: freightCny.trim() === "" ? undefined : Number(freightCny),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "导入失败");
      router.push(`/evaluations/${d.asin}/score`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setImporting(null);
    }
  }

  return (
    <div className="rounded-xl border border-blue/30 bg-blue-soft/60 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-blue">导入真实数据</span>
        <div className="flex rounded-lg border border-line bg-panel p-0.5 text-[13px]">
          <button
            type="button"
            onClick={() => { setSource("ebay"); setItems(null); }}
            className={`rounded-md px-3 py-1 ${source === "ebay" ? "bg-blue text-white" : "text-muted"}`}
          >
            eBay · 实时
          </button>
          <button
            type="button"
            onClick={() => { setSource("amazon"); setItems(null); }}
            className={`rounded-md px-3 py-1 ${source === "amazon" ? "bg-blue text-white" : "text-muted"}`}
          >
            Amazon · Sorftime
          </button>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {source === "ebay"
          ? "输入关键词 — 从 eBay Browse API 实时拉取在售行情、价格、图片、卖家集中度、关联词并评分。"
          : "输入关键词搜索类目热销品，或直接粘贴 ASIN — Sorftime 拉取价格、FBA、毛利、反查关键词并评分。"}
      </p>

      <div className="mt-3 flex gap-2">
        {source === "amazon" ? (
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px]"
          >
            {SITES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : null}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder={source === "ebay" ? "garlic press stainless steel" : "slow feeder dog bowl  或  B0FQHYMS15"}
          className="flex-1 rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px] outline-none focus:border-blue"
        />
        <button
          onClick={search}
          disabled={busy || !!importing}
          className="rounded-lg bg-blue px-5 py-2.5 text-[14px] font-medium text-white hover:bg-blue-strong disabled:opacity-60"
        >
          {busy ? "查询中…" : "搜索 / 导入"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-muted">真实成本（可选，应用于本次导入）：</span>
        <label className="flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[13px]">
          <span className="text-muted">采购 ¥</span>
          <input
            value={costCny}
            onChange={(e) => setCostCny(e.target.value)}
            inputMode="decimal"
            placeholder="18.5"
            className="w-16 bg-transparent font-mono outline-none"
          />
          <span className="text-subtle">/件</span>
        </label>
        <label className="flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[13px]">
          <span className="text-muted">头程 ¥</span>
          <input
            value={freightCny}
            onChange={(e) => setFreightCny(e.target.value)}
            inputMode="decimal"
            placeholder="6.2"
            className="w-16 bg-transparent font-mono outline-none"
          />
          <span className="text-subtle">/件</span>
        </label>
        <span className="text-[12px] text-subtle">
          填了就用真实 COGS 反推毛利率，评分与盈亏一致；留空按售价 30% 估算。
        </span>
      </div>

      {err ? <div className="mt-3 text-[13px] text-red">⚠ {err}</div> : null}
      {importing ? (
        <div className="mt-3 text-[13px] text-blue">正在拉取 {importing} 的实时数据并评分…</div>
      ) : null}

      {items && items.length > 0 ? (
        <div className="mt-4 space-y-2">
          {items.map((it) => (
            <div key={it.asin} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-3">
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="h-12 w-12 rounded bg-panel-2" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{it.title}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                  <span className="font-mono">{it.asin}</span>
                  <span>${it.price}</span>
                  <span>月销 {it.monthlyUnits.toLocaleString()}</span>
                  <span>★ {it.star} · {it.reviews.toLocaleString()}</span>
                  {it.subcategory ? <span>{it.subcategory}</span> : null}
                </div>
              </div>
              <button
                onClick={() => runImport({ asin: it.asin })}
                disabled={!!importing}
                className="shrink-0 rounded-lg border border-blue/40 bg-panel px-4 py-2 text-[13px] font-medium text-blue hover:bg-blue-soft disabled:opacity-60"
              >
                评估
              </button>
            </div>
          ))}
        </div>
      ) : items && items.length === 0 ? (
        <div className="mt-3 text-[13px] text-muted">未找到相关产品，换个关键词试试。</div>
      ) : null}
    </div>
  );
}
