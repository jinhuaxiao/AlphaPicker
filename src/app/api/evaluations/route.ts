import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSeller } from "@/lib/queries";
import {
  compositeScore,
  deriveScores,
  statusFromComposite,
} from "@/lib/scoring";
import { acosSafety, computePnl } from "@/lib/economics";

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function POST(req: Request) {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "no seller" }, { status: 404 });

  const b = await req.json();

  const price = num(b.price_usd);
  const cost = num(b.cost_cny);
  const freight = num(b.freight_cny);
  const fba = num(b.fba_fee_usd);
  const commission = num(b.commission_pct, 15);
  const coupon = num(b.coupon_pct);
  const returnRate = num(b.return_rate_pct);
  const units = num(b.target_monthly_units, 1);
  const acos = num(b.est_acos_pct);
  const conversion = num(b.conversion_pct, 8);
  const secondary: string[] = Array.isArray(b.secondary_keywords)
    ? b.secondary_keywords
    : [];

  const pnlInputs = {
    priceUsd: price,
    costCny: cost,
    freightCny: freight,
    fbaFeeUsd: fba,
    commissionPct: commission,
    couponPct: coupon,
    returnRatePct: returnRate,
    monthlyUnits: units || 1,
    acosPct: acos,
  };
  const pnl = computePnl(pnlInputs);
  const safety = acosSafety(pnlInputs);

  // Pre-ad gross margin %
  const netRev = price * (1 - coupon / 100);
  const amazonFee = price * (commission / 100) + fba;
  const landed = (cost + freight) / 7.2;
  const grossMarginPct = netRev
    ? Math.round(((netRev - amazonFee - landed) / netRev) * 100)
    : 0;

  const top3 = num(b.top3_concentration, 55);
  const monthlySearch =
    num(b.monthly_search) || Math.round((units / (conversion / 100 || 1)) * 2.5);
  const weightedCpc =
    num(b.weighted_cpc) || Number(((price * (acos / 100)) / 2.6).toFixed(2));

  const scores = deriveScores({
    monthlySearch,
    top3Concentration: top3,
    grossMarginPct,
    unfilledSellingPoints: num(b.unfilled_selling_points, 3),
    returnRatePct: returnRate,
    acosSafetyPt: safety.safetyPt,
  });
  const composite = compositeScore(scores, seller.experience);
  const status: string = b.draft
    ? "draft"
    : statusFromComposite(composite, scores.risk);

  const asin = (b.asin || `B0NEW${Date.now().toString(36).toUpperCase()}`).slice(0, 16);

  try {
    const res = await pool.query(
      `INSERT INTO evaluations (
        seller_id, asin, name, category_path, target_market,
        price_usd, cost_cny, freight_cny, fba_fee_usd, commission_pct, coupon_pct, return_rate_pct,
        main_keyword, secondary_keywords, target_monthly_units, est_acos_pct, conversion_pct,
        score_demand, score_competition, score_profit, score_differentiation, score_risk,
        composite, status, monthly_search, weighted_cpc, top3_concentration, gross_margin_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      RETURNING asin`,
      [
        seller.id,
        asin,
        b.name || "未命名产品",
        b.category_path || "",
        b.target_market || "Amazon US",
        price,
        cost,
        freight,
        fba,
        commission,
        coupon,
        returnRate,
        b.main_keyword || "",
        secondary,
        units,
        acos,
        conversion,
        scores.demand,
        scores.competition,
        scores.profit,
        scores.differentiation,
        scores.risk,
        composite,
        status,
        monthlySearch,
        weightedCpc,
        top3,
        grossMarginPct,
      ] as never[],
    );
    return NextResponse.json({
      ok: true,
      asin: res.rows[0].asin,
      composite,
      status,
      monthlyNetCny: Math.round(pnl.monthlyNetCny),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
