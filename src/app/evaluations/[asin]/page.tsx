import { redirect } from "next/navigation";

export default async function EvaluationIndex({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  redirect(`/evaluations/${asin}/score`);
}
