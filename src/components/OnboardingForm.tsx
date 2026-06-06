"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXPERIENCE_META, SALES_BAND_META } from "@/lib/types";
import type { ExperienceLevel, SalesBand } from "@/lib/types";

const CATEGORIES = ["宠物", "家居", "收纳", "小家电", "户外", "母婴", "汽配"];
const PLATFORMS = [
  "Amazon US",
  "Amazon EU",
  "Amazon JP",
  "TikTok Shop",
  "Shopify",
  "Temu",
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 font-serif text-[15px] transition ${
        active
          ? "border-blue bg-blue-soft text-blue"
          : "border-line bg-panel text-ink/80 hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingForm({
  initial,
  mode = "onboarding",
}: {
  mode?: "onboarding" | "settings";
  initial: {
    name: string;
    experience: ExperienceLevel;
    sales_band: SalesBand;
    categories: string[];
    risk_preference: number;
    per_product_budget_cny: number;
    platforms: string[];
  };
}) {
  const router = useRouter();
  const [experience, setExperience] = useState<ExperienceLevel>(initial.experience);
  const [salesBand, setSalesBand] = useState<SalesBand>(initial.sales_band);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [risk, setRisk] = useState(initial.risk_preference);
  const [budget, setBudget] = useState(initial.per_product_budget_cny || 0);
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (
    list: string[],
    set: (v: string[]) => void,
    val: string,
  ) => set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  async function save(skip = false) {
    setSaving(true);
    setSaved(false);
    await fetch("/api/seller", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        skip
          ? { onboarded: true }
          : {
              experience,
              sales_band: salesBand,
              categories,
              risk_preference: risk,
              per_product_budget_cny: budget,
              platforms,
              onboarded: true,
            },
      ),
    });
    if (mode === "settings") {
      setSaving(false);
      setSaved(true);
      router.refresh(); // re-render the derived policy panel
      return;
    }
    // After the profile is set, go straight to profile-driven recommendations.
    router.push("/recommend");
    router.refresh();
  }

  const riskLabel = risk < 33 ? "保守" : risk < 66 ? "均衡" : "激进";

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            {mode === "settings" ? "卖家画像" : "先聊聊你是谁"}
          </h2>
          <p className="mt-2 text-[15px] text-muted">
            {mode === "settings"
              ? "画像决定算法的硬性门槛、风险容忍与卖家适配乘数 — 改完即时生效。"
              : "我们会根据你的画像调整评分权重 — 新手更重风险，老兵更重规模"}
          </p>
        </div>
        {mode === "onboarding" ? (
          <div className="font-serif text-[15px] text-muted">
            STEP <span className="text-2xl font-bold text-ink">1</span> / 3 · 卖家画像
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <div className="mb-2 font-serif text-[16px]">① 经验等级</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EXPERIENCE_META) as ExperienceLevel[]).map((k) => (
                <Chip key={k} active={experience === k} onClick={() => setExperience(k)}>
                  {EXPERIENCE_META[k]}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 font-serif text-[16px]">② 月销售额规模</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SALES_BAND_META) as SalesBand[]).map((k) => (
                <Chip key={k} active={salesBand === k} onClick={() => setSalesBand(k)}>
                  {SALES_BAND_META[k]}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 font-serif text-[16px]">③ 主营类目</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  active={categories.includes(c)}
                  onClick={() => toggle(categories, setCategories, c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between font-serif text-[16px]">
              <span>④ 风险偏好</span>
              <span className="text-blue">{riskLabel}</span>
            </div>
            <div className="text-[13px] text-muted">保守 ←→ 激进</div>
            <input
              type="range"
              min={0}
              max={100}
              value={risk}
              onChange={(e) => setRisk(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 text-[13px] text-muted">影响 ACOS 安全边际的容忍区间</div>
          </div>

          <div>
            <div className="mb-2 font-serif text-[16px]">⑤ 单品可投入资金</div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3">
              <div className="flex items-center gap-2 font-mono text-lg">
                ¥
                <input
                  type="number"
                  value={budget || ""}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  placeholder="40,000"
                  className="w-32 bg-transparent outline-none"
                />
              </div>
              <span className="font-serif text-[14px] text-muted">含备货 + 头程 + 广告</span>
            </div>
          </div>

          <div>
            <div className="mb-2 font-serif text-[16px]">⑥ 主要平台</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Chip
                  key={p}
                  active={platforms.includes(p)}
                  onClick={() => toggle(platforms, setPlatforms, p)}
                >
                  {p}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-blue/40 bg-blue-soft/40 px-4 py-2 text-[14px] text-blue">
        ↘ 硬性门槛、风险容忍与卖家适配乘数会随这些选择动态调整
      </div>

      <div className="mt-7 flex items-center justify-between">
        {mode === "onboarding" ? (
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="text-[15px] text-muted hover:text-ink"
          >
            ← 跳过，使用通用权重
          </button>
        ) : (
          <span className="text-[14px] text-green">
            {saved ? "✓ 画像已保存，算法策略已更新" : ""}
          </span>
        )}
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="rounded-lg bg-blue px-7 py-2.5 text-[14px] font-medium text-white hover:bg-blue-strong disabled:opacity-60"
        >
          {saving ? "保存中…" : mode === "settings" ? "保存画像" : "下一步 · 接入数据源"}
        </button>
      </div>
    </div>
  );
}
