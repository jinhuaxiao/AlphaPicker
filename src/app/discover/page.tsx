import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DiscoverPanel } from "@/components/DiscoverPanel";
import { getSeller } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const seller = await getSeller();
  if (!seller) redirect("/onboarding");

  return (
    <AppShell seller={seller} active="discover" title="市场机会发现">
      <div className="mb-4 rounded-xl border border-blue/30 bg-blue-soft/60 p-4">
        <div className="text-[14px]">
          <span className="font-semibold text-blue">从需求侧找机会：</span>
          用 Sorftime 类目数据扫描蓝海细分市场（容量足、垄断低、新品有空间），或按价位/销量挖掘潜力新品，
          一键拉数据进入评估流程。
        </div>
      </div>
      <DiscoverPanel />
    </AppShell>
  );
}
