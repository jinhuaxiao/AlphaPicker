import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Recommendations } from "@/components/Recommendations";
import { getSeller } from "@/lib/queries";
import { EXPERIENCE_META } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
  const seller = await getSeller();
  if (!seller) redirect("/onboarding");

  return (
    <AppShell
      seller={seller}
      active="recommend"
      title="智能选品推荐"
      actions={
        <Link href="/profile" className="rounded-lg border border-line bg-panel px-4 py-2 text-[14px] font-medium hover:bg-panel-2">
          调整画像
        </Link>
      }
    >
      <div className="mb-4 rounded-xl border border-blue/30 bg-blue-soft/60 p-4">
        <div className="text-[14px]">
          <span className="font-semibold text-blue">先画像、再推荐：</span>
          系统读取你的画像（{EXPERIENCE_META[seller.experience]} · {seller.categories.join(" / ") || "通用"} · 预算 {Math.round(seller.per_product_budget_cny / 1000)}k）
          ，在你的类目内按预算价位拉取真实在售品，用机会决策算法逐个打分，给出可直接评估的候选。
        </div>
      </div>

      <Recommendations categories={seller.categories} />
    </AppShell>
  );
}
