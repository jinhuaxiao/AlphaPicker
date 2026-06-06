import { notFound } from "next/navigation";
import { DecisionPanel } from "@/components/DecisionPanel";
import {
  getEvaluationByAsin,
  getSeller,
  getKeywords,
  getReviewInsight,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  const seller = await getSeller();
  if (!e || !seller) notFound();
  const keywords = await getKeywords(e.id);
  const reviewInsight = await getReviewInsight(seller.id, e.asin);

  return (
    <div>
      <p className="mb-4 text-[14px] text-muted">
        硬性门槛 → TACOS 财务底座 → 市场机会分 → 利润/风险/卖家适配乘数 → VOC 人机确认 → 机会指数与决策。
      </p>
      <DecisionPanel
        evaluation={e}
        seller={seller}
        keywords={keywords}
        reviewInsight={reviewInsight}
      />
    </div>
  );
}
