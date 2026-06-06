"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryOpportunity, PotentialProduct } from "@/lib/sorftime";
import { usd } from "@/lib/format";

type Mode = "category" | "product";

const SITES = ["US", "GB", "DE", "FR", "JP", "CA"];
const MONTHS = [
  "Both", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** 0-100 blue-ocean score: fragmented + non-Amazon + newcomer-friendly. */
function blueOcean(c: CategoryOpportunity): number {
  const frag = 100 - c.top3ProductShare;
  const nonAmz = 100 - c.amazonOwnedShare;
  const newcomer = Math.min(c.newProductShare * 4, 100);
  return Math.max(0, Math.min(100, Math.round(frag * 0.4 + nonAmz * 0.4 + newcomer * 0.2)));
}

function scoreTone(s: number): string {
  return s >= 65 ? "text-green" : s >= 45 ? "text-orange" : "text-red";
}

function NumInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] text-muted">{label}</div>
      <div className="flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 focus-within:border-ink">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="decimal"
          className="w-full bg-transparent font-mono text-[14px] outline-none placeholder:text-muted/50"
        />
        {suffix ? <span className="text-[12px] text-muted">{suffix}</span> : null}
      </div>
    </label>
  );
}

const numOrUndef = (s: string) => (s.trim() === "" ? undefined : Number(s));
const pctOrUndef = (s: string) => (s.trim() === "" ? undefined : Number(s) / 100);

export function DiscoverPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("category");
  const [site, setSite] = useState("US");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState<string | null>(null);

  // category filters
  const [salesMin, setSalesMin] = useState("30000");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [top3Max, setTop3Max] = useState("");
  const [amzMax, setAmzMax] = useState("");
  const [newMin, setNewMin] = useState("");
  const [season, setSeason] = useState("Both");

  // product filters
  const [kw, setKw] = useState("");
  const [pSalesMin, setPSalesMin] = useState("300");
  const [delivery, setDelivery] = useState("Both");

  const [cats, setCats] = useState<CategoryOpportunity[] | null>(null);
  const [prods, setProds] = useState<PotentialProduct[] | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const filters =
      mode === "category"
        ? {
            amzSite: site,
            month_sales_volume_min: numOrUndef(salesMin),
            price_min: numOrUndef(priceMin),
            price_max: numOrUndef(priceMax),
            top3Product_sales_share_max: pctOrUndef(top3Max),
            amazonOwned_sales_share_max: pctOrUndef(amzMax),
            newproduct_sales_share_min: pctOrUndef(newMin),
            seasonal_popular_product: season === "Both" ? undefined : season,
          }
        : {
            amzSite: site,
            searchName: kw.trim() || undefined,
            price_min: numOrUndef(priceMin),
            price_max: numOrUndef(priceMax),
            month_sales_volume_min: numOrUndef(pSalesMin),
            delivery_type: delivery === "Both" ? undefined : delivery,
          };
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, filters }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "查询失败");
      if (mode === "category") {
        setCats(d.items);
        setProds(null);
      } else {
        setProds(d.items);
        setCats(null);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function evaluate(asin: string) {
    setEvaluating(asin);
    setErr(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asin, site, source: "amazon" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "评估失败");
      router.push(`/evaluations/${d.asin}/score`);
    } catch (e) {
      setErr(`评估失败：${(e as Error).message}`);
      setEvaluating(null);
    }
  }

  const Tab = ({ m, label }: { m: Mode; label: string }) => (
    <button
      onClick={() => setMode(m)}
      className={`rounded-lg px-4 py-1.5 text-[14px] font-medium transition ${
        mode === m ? "bg-blue text-white" : "border border-line bg-panel text-muted hover:bg-panel-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* mode + site */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Tab m="category" label="类目蓝海" />
          <Tab m="product" label="潜力产品" />
        </div>
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[14px]"
        >
          {SITES.map((s) => (
            <option key={s} value={s}>Amazon {s}</option>
          ))}
        </select>
      </div>

      {/* filters */}
      <div className="rounded-xl border border-line bg-panel p-4 shadow-card">
        {mode === "category" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <NumInput label="月销量下限" value={salesMin} onChange={setSalesMin} placeholder="30000" suffix="件" />
            <NumInput label="均价下限" value={priceMin} onChange={setPriceMin} placeholder="—" suffix="$" />
            <NumInput label="均价上限" value={priceMax} onChange={setPriceMax} placeholder="—" suffix="$" />
            <NumInput label="Top3 产品占比上限" value={top3Max} onChange={setTop3Max} placeholder="—" suffix="%" />
            <NumInput label="亚马逊自营上限" value={amzMax} onChange={setAmzMax} placeholder="—" suffix="%" />
            <NumInput label="新品销量占比下限" value={newMin} onChange={setNewMin} placeholder="—" suffix="%" />
            <label className="block">
              <div className="mb-1 text-[12px] text-muted">旺季月份</div>
              <select value={season} onChange={(e) => setSeason(e.target.value)} className="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px]">
                {MONTHS.map((m) => <option key={m} value={m}>{m === "Both" ? "不限" : m}</option>)}
              </select>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <label className="col-span-2 block sm:col-span-1">
              <div className="mb-1 text-[12px] text-muted">关键词（可选）</div>
              <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="dog, kitchen…" className="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px] outline-none focus:border-ink" />
            </label>
            <NumInput label="价格下限" value={priceMin} onChange={setPriceMin} placeholder="—" suffix="$" />
            <NumInput label="价格上限" value={priceMax} onChange={setPriceMax} placeholder="—" suffix="$" />
            <NumInput label="月销量下限" value={pSalesMin} onChange={setPSalesMin} placeholder="300" suffix="件" />
            <label className="block">
              <div className="mb-1 text-[12px] text-muted">发货方式</div>
              <select value={delivery} onChange={(e) => setDelivery(e.target.value)} className="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px]">
                <option value="Both">不限</option>
                <option value="FBA">FBA</option>
                <option value="FBM">FBM</option>
              </select>
            </label>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            {mode === "category"
              ? "按容量与垄断/新品结构筛选细分类目，蓝海分越高越值得切入。"
              : "按价位与销量筛选潜力新品，可一键拉数据评估。"}
          </p>
          <button
            onClick={run}
            disabled={busy}
            className="rounded-lg bg-blue px-6 py-2 text-[14px] font-medium text-white hover:bg-blue-strong disabled:opacity-60"
          >
            {busy ? "搜索中…" : "搜索机会"}
          </button>
        </div>
        {err ? <div className="mt-3 text-[13px] text-red">⚠ {err}</div> : null}
      </div>

      {/* results */}
      {mode === "category" && cats ? <CategoryTable items={cats} /> : null}
      {mode === "product" && prods ? (
        <ProductTable items={prods} onEvaluate={evaluate} evaluating={evaluating} />
      ) : null}
    </div>
  );
}

function CategoryTable({ items }: { items: CategoryOpportunity[] }) {
  if (!items.length)
    return <Empty text="未找到符合条件的类目，尝试放宽筛选（如降低垄断上限要求或月销量下限）。" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className="p-3 font-normal">细分类目</th>
            <th className="p-3 text-right font-normal">容量(月销量/销额)</th>
            <th className="p-3 text-right font-normal">均价</th>
            <th className="p-3 text-right font-normal">Top3产品</th>
            <th className="p-3 text-right font-normal">亚马逊自营</th>
            <th className="p-3 text-right font-normal">新品占比</th>
            <th className="p-3 text-center font-normal">旺季</th>
            <th className="p-3 text-right font-normal">蓝海分</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const s = blueOcean(c);
            return (
              <tr key={c.nodeId} className="border-t border-line">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-right font-mono">{compact(c.tamUnits)} / ${compact(c.tamRevenueUsd)}</td>
                <td className="p-3 text-right font-mono">{usd(c.avgPrice)}</td>
                <td className={`p-3 text-right font-mono ${c.top3ProductShare >= 50 ? "text-orange" : ""}`}>{c.top3ProductShare}%</td>
                <td className={`p-3 text-right font-mono ${c.amazonOwnedShare >= 50 ? "text-red" : ""}`}>{c.amazonOwnedShare}%</td>
                <td className={`p-3 text-right font-mono ${c.newProductShare >= 10 ? "text-green" : ""}`}>{c.newProductShare}%</td>
                <td className="p-3 text-center text-muted">{c.season || "—"}</td>
                <td className={`p-3 text-right font-mono font-bold ${scoreTone(s)}`}>{s}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductTable({
  items,
  onEvaluate,
  evaluating,
}: {
  items: PotentialProduct[];
  onEvaluate: (asin: string) => void;
  evaluating: string | null;
}) {
  if (!items.length) return <Empty text="未找到潜力产品，尝试更换关键词或放宽价格/销量。" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-card">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className="p-3 font-normal">产品</th>
            <th className="p-3 text-right font-normal">价格</th>
            <th className="p-3 text-right font-normal">月销量/销额</th>
            <th className="p-3 text-right font-normal">星级/评论</th>
            <th className="p-3 text-right font-normal">潜力指数</th>
            <th className="p-3 text-center font-normal">发货/上架</th>
            <th className="p-3 text-right font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.asin} className="border-t border-line align-top">
              <td className="p-3">
                <div className="flex items-start gap-2">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded border border-line object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="line-clamp-2 max-w-[260px] text-[13px]">{p.title}</div>
                    <div className="text-[12px] text-muted">{p.brand} · {p.subcategory}</div>
                  </div>
                </div>
              </td>
              <td className="p-3 text-right font-mono">{usd(p.price)}</td>
              <td className="p-3 text-right font-mono">{compact(p.monthlyUnits)} / ${compact(p.monthlyRevenue)}</td>
              <td className="p-3 text-right font-mono">{p.star}★ / {compact(p.reviews)}</td>
              <td className="p-3 text-right font-mono font-bold text-blue">{p.potentialIndex}</td>
              <td className="p-3 text-center text-[12px] text-muted">{p.fulfillment}<br />{p.listedDate}</td>
              <td className="p-3 text-right">
                <button
                  onClick={() => onEvaluate(p.asin)}
                  disabled={evaluating !== null}
                  className="rounded-md border border-blue/40 bg-blue-soft px-3 py-1 text-[12px] font-medium text-blue hover:bg-blue-soft/70 disabled:opacity-60"
                >
                  {evaluating === p.asin ? "评估中…" : "评估"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel p-10 text-center text-[14px] text-muted">
      {text}
    </div>
  );
}
