import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { NewEvaluationForm } from "@/components/NewEvaluationForm";
import { AmazonImport } from "@/components/AmazonImport";
import { getSeller } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewEvaluationPage() {
  const seller = await getSeller();
  if (!seller) redirect("/onboarding");

  return (
    <AppShell seller={seller} active="new" title="新建评估" breadcrumb="我的选品 / 新建评估">
      <div className="mx-auto max-w-5xl space-y-5">
        <AmazonImport />

        <div className="flex items-center gap-3 text-[13px] text-muted">
          <span className="h-px flex-1 bg-line" />
          或手动录入
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="rounded-xl border border-line bg-panel p-6 shadow-card">
          <NewEvaluationForm />
        </div>
      </div>
    </AppShell>
  );
}
