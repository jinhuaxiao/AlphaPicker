"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FormState {
  asin: string;
  name: string;
  image_url: string;
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
  image_url: "",
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
  image_url: "",
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

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB — keep data URL within a sane TEXT size

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("仅支持图片文件"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("图片过大（上限 4MB）"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function ImageDrop({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  onError: (msg: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function accept(file: File | undefined | null) {
    if (!file) return;
    try {
      onError(null);
      onChange(await readImageFile(file));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void accept(e.dataTransfer.files?.[0]);
      }}
      onPaste={(e) => {
        const file = Array.from(e.clipboardData.items)
          .find((i) => i.type.startsWith("image/"))
          ?.getAsFile();
        if (file) void accept(file);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-panel-2 text-center text-muted transition-colors ${
        dragging ? "border-blue bg-blue-soft text-blue" : "border-line hover:border-ink"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="产品图" className="h-full w-full object-contain" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              onError(null);
            }}
            className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[12px] text-white hover:bg-ink"
          >
            移除
          </button>
        </>
      ) : (
        <span className="px-3 text-[14px]">
          {dragging ? "松开以上传" : "产品图 / 拖入 · 点击 · 粘贴"}
        </span>
      )}
    </div>
  );
}

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
  const [recognizing, setRecognizing] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const set = (k: keyof FormState) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  // Upload a product image → Qwen-VL recognises it → auto-fill the form.
  async function onImage(dataUrl: string) {
    setF((s) => ({ ...s, image_url: dataUrl }));
    setAiNote(null);
    if (!dataUrl) return;
    setRecognizing(true);
    setErr(null);
    try {
      const r = await fetch("/api/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "识别失败");
      setF((s) => ({
        ...s,
        name: d.name || s.name,
        category_path: d.category_path || s.category_path,
        target_market: d.target_market || s.target_market,
        main_keyword: d.main_keyword || s.main_keyword,
        secondary_count: Array.isArray(d.secondary_keywords) && d.secondary_keywords.length
          ? String(d.secondary_keywords.length)
          : s.secondary_count,
        price_usd: d.est_price_usd ? String(d.est_price_usd) : s.price_usd,
      }));
      setAiNote(
        `✓ AI 识别：${d.name}（置信度 ${(Number(d.confidence) * 100).toFixed(0)}% · ${d.model}）。经济参数请补全或点「一键填充示例」。`,
      );
    } catch (e) {
      setErr(`图片识别失败：${(e as Error).message}`);
    } finally {
      setRecognizing(false);
    }
  }

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
          <div className="flex items-center justify-between">
            <div className="font-serif text-[16px] text-blue">① 产品基础</div>
            <span className="rounded-full border border-blue/30 bg-blue-soft px-2 py-0.5 text-[11px] text-blue">
              上传图片 · AI 识别填表
            </span>
          </div>
          <ImageDrop value={f.image_url} onChange={onImage} onError={setErr} />
          {recognizing ? (
            <div className="rounded-lg border border-blue/30 bg-blue-soft/60 px-3 py-2 text-[13px] text-blue">
              ✨ 通义千问视觉识别中…
            </div>
          ) : aiNote ? (
            <div className="rounded-lg border border-green/30 bg-green-soft/60 px-3 py-2 text-[12px] text-green">
              {aiNote}
            </div>
          ) : null}
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
