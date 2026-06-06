import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getSeller } from "@/lib/queries";
import { buildSellerPolicy } from "@/lib/alpha";
import { EXPERIENCE_META, SALES_BAND_META } from "@/lib/types";
import { cny, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const seller = await getSeller();
  if (!seller) redirect("/onboarding");
  const policy = buildSellerPolicy(seller);
  const riskLabel =
    seller.risk_preference < 33 ? "保守" : seller.risk_preference < 66 ? "均衡" : "激进";

  return (
    <AppShell seller={seller} active="profile" title="卖家画像">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* current snapshot */}
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Chip label="经验" value={EXPERIENCE_META[seller.experience]} />
          <Chip label="月销规模" value={SALES_BAND_META[seller.sales_band]} />
          <Chip label="风险偏好" value={riskLabel} />
          <Chip label="单品预算" value={cny(seller.per_product_budget_cny, { compact: true })} />
          <Chip label="主营类目" value={seller.categories.join(" / ") || "—"} />
          <Chip label="平台" value={seller.platforms.join(" / ") || "—"} />
        </div>

        {/* editable form */}
        <div className="rounded-xl border border-line bg-panel p-6 shadow-card">
          <OnboardingForm
            mode="settings"
            initial={{
              name: seller.name,
              experience: seller.experience,
              sales_band: seller.sales_band,
              categories: seller.categories,
              risk_preference: seller.risk_preference,
              per_product_budget_cny: seller.per_product_budget_cny,
              platforms: seller.platforms,
            }}
          />
        </div>

        {/* derived algorithm policy */}
        <div className="rounded-xl border border-line bg-panel p-6 shadow-card">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold">画像 → 算法策略</span>
            <span className="rounded-full border border-blue/30 bg-blue-soft px-2 py-0.5 text-[11px] text-blue">
              buildSellerPolicy()
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            机会决策算法直接读取这套策略 — 改画像即改门槛、风险容忍与卖家适配。
          </p>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-[13px] font-medium text-muted">硬性门槛 / 财务</div>
              <Row k="需求门槛 · 月搜索" v={`≥ ${policy.minMonthlySearch.toLocaleString()}`} />
              <Row k="目标净利率（TACOS 后）" v={`≥ ${pct(policy.targetNetMarginPct)}`} />
              <Row k="TACOS 安全下限" v={`≥ ${policy.minTacosSafetyPt}pt`} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-muted">风险 / 预算 / 适配</div>
              <Row k="风险容忍" v={`${Math.round(policy.riskTolerance * 100)}% · ${riskLabel}`} />
              <Row k="单品预算" v={cny(policy.budgetCny)} />
              <Row k="最大测试预算占比" v={pct(policy.maxTestBudgetRatio * 100)} />
              <Row k="卖家适配类目" v={policy.categories.join(" / ") || "通用"} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3 shadow-card">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[14px] font-medium">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-[14px] first:border-t-0">
      <span className="text-muted">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
