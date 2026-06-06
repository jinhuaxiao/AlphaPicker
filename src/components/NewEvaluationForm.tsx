"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FormState {
  asin: string;
  name: string;
  category_path: string;
  target_market: string;
  price_usd: string;
  cost_cny: string;
  freight_cny: string;
  fba_fee_usd: string;
  commission_pct: string;
  coupon_pct: string;
  return_rate_pct: string;
  main_keyword: string;
  secondary_count: string;
  target_monthly_units: string;
  est_acos_pct: string;
  conversion_pct: string;
}

const EMPTY: FormState = {
  asin: "",
  name: "",
  category_path: "",
  target_market: "Amazon US",
  price_usd: "",
  cost_cny: "",
  freight_cny: "",
  fba_fee_usd: "",
  commission_pct: "15",
  coupon_pct: "",
  return_rate_pct: "",
  main_keyword: "",
  secondary_count: "",
  target_monthly_units: "",
  est_acos_pct: "",
  conversion_pct: "",
};

const DEMO: FormState = {
  asin: "B0DEMO" + Math.floor(Math.random() * 1e6),
  name: "Slow Feeder Dog Bowl",
  category_path: "Pet › Bowls",
  target_market: "Amazon US",
  price_usd: "15.99",
  cost_cny: "18.5",
  freight_cny: "6.2",
  fba_fee_usd: "4.78",
  commission_pct: "15",
  coupon_pct: "5",
  return_rate_pct: "3.2",
  main_keyword: "slow feeder dog bowl",
  secondary_count: "3",
  target_monthly_units: "800",
  est_acos_pct: "22",
  conversion_pct: "8",
};

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  auto,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  auto?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-serif text-[14px] text-muted">{label}</span>
        {auto ? (
          <span className="rounded-full border border-blue/40 px-2 text-[11px] text-blue">
            auto
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2.5 focus-within:border-ink">
        {prefix ? <span className="font-mono text-muted">{prefix}</span> : null}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent font-mono outline-none placeholder:text-muted/60"
        />
        {suffix ? <span className="font-mono text-muted">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function NewEvaluationForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof FormState) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(draft: boolean) {
    setBusy(true);
    setErr(null);
    const secondary = Number(f.secondary_count) > 0
      ? Array.from({ length: Number(f.secondary_count) }, (_, i) => `次关键词 ${i + 1}`)
      : [];
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...f,
        secondary_keywords: secondary,
        target_monthly_units: Number(f.target_monthly_units),
        est_acos_pct: Number(f.est_acos_pct),
        conversion_pct: Number(f.conversion_pct),
        draft,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "保存失败");
      return;
    }
    if (draft) {
      router.push("/dashboard");
    } else {
      router.push(`/evaluations/${data.asin}/score`);
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">录入待评估产品</h2>
          <p className="mt-1 text-[14px] text-muted">
            填入产品基础数据 → AlphaPicker 自动拉取关键词、竞品、广告费用基线
          </p>
        </div>
        <button
          type="button"
          onClick={() => setF(DEMO)}
          className="rounded-lg border border-blue/40 bg-blue-soft px-4 py-2 text-[14px] font-medium text-blue"
        >
          ✨ 一键填充示例 · Pet Bowl
        </button>
      </div>

      <div className="mt-7 grid gap-7 md:grid-cols-3">
        {/* ① 产品基础 */}
        <div className="space-y-4">
          <div className="font-serif text-[16px] text-blue">① 产品基础</div>
          <div className="flex h-32 items-center justify-center rounded-lg border border-line bg-panel-2 text-muted">
            产品图 / 拖入
          </div>
          <Field label="ASIN / SKU" value={f.asin} onChange={set("asin")} placeholder="B0XXXXXXXX" />
          <Field label="产品名" value={f.name} onChange={set("name")} placeholder="Slow Feeder Dog Bowl" />
          <Field label="类目" value={f.category_path} onChange={set("category_path")} placeholder="Pet › Bowls" />
          <Field label="目标市场" value={f.target_market} onChange={set("target_market")} />
        </div>

        {/* ② 经济参数 */}
        <div className="space-y-4">
          <div className="font-serif text-[16px] text-blue">② 经济参数</div>
          <Field label="售价 USD" prefix="$" value={f.price_usd} onChange={set("price_usd")} placeholder="15.99" />
          <Field label="采购成本 CNY" prefix="¥" value={f.cost_cny} onChange={set("cost_cny")} placeholder="18.5" />
          <Field label="头程物流 / 件" prefix="¥" value={f.freight_cny} onChange={set("freight_cny")} placeholder="6.2" />
          <Field label="FBA fee" prefix="$" value={f.fba_fee_usd} onChange={set("fba_fee_usd")} placeholder="4.78" auto />
          <Field label="平台佣金" suffix="%" value={f.commission_pct} onChange={set("commission_pct")} />
          <Field label="Coupon / 折扣" suffix="%" value={f.coupon_pct} onChange={set("coupon_pct")} placeholder="5" />
          <Field label="退货率" suffix="%" value={f.return_rate_pct} onChange={set("return_rate_pct")} placeholder="3.2" auto />
        </div>

        {/* ③ 市场参数 */}
        <div className="space-y-4">
          <div className="font-serif text-[16px] text-blue">③ 市场参数</div>
          <Field label="主关键词" value={f.main_keyword} onChange={set("main_keyword")} placeholder="slow feeder dog bowl" />
          <Field label="次关键词（数量）" value={f.secondary_count} onChange={set("secondary_count")} placeholder="3" suffix="个" />
          <Field label="目标月销量" value={f.target_monthly_units} onChange={set("target_monthly_units")} placeholder="800" suffix="件" />
          <Field label="预估 ACOS %" value={f.est_acos_pct} onChange={set("est_acos_pct")} placeholder="22" suffix="%" auto />
          <Field label="转化率" value={f.conversion_pct} onChange={set("conversion_pct")} placeholder="8" suffix="%" auto />
          <div className="rounded-lg border border-dashed border-line p-3 text-[13px] text-muted">
            <span className="text-blue">auto</span> · 空白字段将由 AlphaPicker 调用关键词 API + 类目基线自动估算
          </div>
        </div>
      </div>

      {err ? <div className="mt-4 text-[14px] text-red">⚠ {err}</div> : null}

      <div className="mt-7 flex items-center justify-end gap-3">
        <button
          onClick={() => submit(true)}
          disabled={busy}
          className="rounded-lg border border-line bg-panel px-5 py-2.5 text-[14px] font-medium hover:bg-panel-2"
        >
          保存草稿
        </button>
        <button
          onClick={() => submit(false)}
          disabled={busy}
          className="rounded-lg bg-blue px-7 py-2.5 text-[14px] font-medium text-white hover:bg-blue-strong disabled:opacity-60"
        >
          {busy ? "评分中…" : "生成评分"}
        </button>
      </div>
    </div>
  );
}
