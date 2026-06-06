import { OnboardingForm } from "@/components/OnboardingForm";
import { getSeller } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const seller = await getSeller();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-12">
      <div className="mb-6 flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3 L21 20 H3 Z" stroke="var(--color-blue)" strokeWidth="1.8" />
          <circle cx="12" cy="14" r="2.4" fill="var(--color-blue)" />
        </svg>
        <span className="text-[18px] font-semibold tracking-tight">AlphaPicker</span>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-7 shadow-card md:p-9">
        <OnboardingForm
          initial={{
            name: seller?.name ?? "新卖家",
            experience: seller?.experience ?? "novice",
            sales_band: seller?.sales_band ?? "lt5w",
            categories: seller?.categories ?? [],
            risk_preference: seller?.risk_preference ?? 30,
            per_product_budget_cny: seller?.per_product_budget_cny ?? 0,
            platforms: seller?.platforms ?? [],
          }}
        />
      </div>
    </main>
  );
}
