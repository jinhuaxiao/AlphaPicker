// Profile-driven product recommendations.
//
// Flow: seller profile → category seed keywords (+ budget price band) → one
// Amazon `product_search` per seed → build a transient evaluation per candidate
// → score with the new decision algorithm (runAlpha) → rank by opportunity index.
// Nothing is written to the DB until the seller clicks "加入评估".

import { searchProducts, type AmazonSearchItem } from "./sorftime";
import { runAlpha } from "./alpha";
import type { Evaluation, Seller } from "./types";

const FX = 7.2;

// Seller category (zh) → rotating pool of representative Amazon search seeds.
// "重新生成" rotates through these so different products surface each time.
const CAT_SEEDS: Record<string, string[]> = {
  宠物: ["slow feeder dog bowl", "pet hair remover", "cat litter mat", "dog grooming brush", "elevated dog bowl"],
  厨房: ["garlic press stainless steel", "spice rack organizer", "silicone baking mat", "kitchen scale digital", "vegetable chopper"],
  收纳: ["drawer organizer", "storage bins", "closet organizer", "cable management box", "under bed storage"],
  家居: ["foldable plant stand", "shower caddy", "wall mounted shelf", "led strip lights", "door draft stopper"],
  小家电: ["mini humidifier", "milk frother handheld", "usb desk fan", "electric wine opener", "portable blender"],
  户外: ["insulated water bottle", "camping cookware", "collapsible cooler bag", "hammock straps", "trekking poles"],
  母婴: ["baby bottle drying rack", "diaper caddy organizer", "baby teether", "nursing pillow", "pacifier clip"],
  汽配: ["car trunk organizer", "car phone mount", "seat gap filler", "car trash can", "windshield sun shade"],
};
const DEFAULT_SEEDS = ["slow feeder dog bowl", "garlic press stainless steel", "drawer organizer"];

// Small deterministic PRNG so a given `variety` reproduces the same picks.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Recommendation {
  asin: string;
  name: string;
  image: string;
  category: string;
  price: number;
  monthlyUnits: number;
  fbaFee: number;
  opportunityIndex: number;
  level: string;
  levelLabel: string;
  netMarginAfterTacosPct: number;
  top3Concentration: number;
  seed: string;
  gatePass: boolean;
}

/**
 * One rotating seed per category (so every category is covered, and "重新生成"
 * with a new `variety` picks different search terms). Fills a second pass if the
 * seller has few categories.
 */
function seedsFor(seller: Seller, variety = 0): string[] {
  const cats = (seller.categories?.length ? seller.categories : []).filter((c) => CAT_SEEDS[c]);
  if (!cats.length) return DEFAULT_SEEDS;

  const seeds: string[] = [];
  // pass 1: rotate one seed from each category
  for (const c of cats) {
    const pool = CAT_SEEDS[c];
    seeds.push(pool[variety % pool.length]);
  }
  // pass 2: if few categories, add another (offset) seed per category
  if (cats.length <= 3) {
    for (const c of cats) {
      const pool = CAT_SEEDS[c];
      seeds.push(pool[(variety + 1) % pool.length]);
    }
  }
  return Array.from(new Set(seeds)).slice(0, 8);
}

/** Price band the seller's budget can realistically stock a first batch of. */
function priceBand(seller: Seller): { price_min: number; price_max: number } {
  const budget = seller.per_product_budget_cny || 40000;
  // budget ≈ inventory + ads. Assume ~55% to inventory, ~300 unit first batch.
  const maxLandedUsd = (budget * 0.55) / 300 / FX;
  const price_max = Math.round(Math.min(60, Math.max(18, maxLandedUsd / 0.3)));
  return { price_min: 6, price_max };
}

/** Build a transient (un-persisted) evaluation from a search result + batch stats. */
function toEvaluation(
  seller: Seller,
  item: AmazonSearchItem,
  top3: number,
): Evaluation {
  const price = item.price;
  const fba = item.fbaFee || Number((price * 0.28).toFixed(2));
  const landedCny = price * FX * 0.3;
  const costCny = Number((landedCny * 0.8).toFixed(1));
  const freightCny = Number((landedCny * 0.2).toFixed(1));
  const amazonFeeUsd = price * 0.15 + fba;
  const landedUsd = (costCny + freightCny) / FX;
  const grossMargin = price ? Math.round(((price - amazonFeeUsd - landedUsd) / price) * 100) : 0;
  const wcpc = Number(Math.min(2.5, Math.max(0.4, 0.4 + price * 0.05)).toFixed(2));
  const estAcos = Math.min(40, Math.max(12, Math.round(15 + wcpc * 10)));

  return {
    id: 0,
    seller_id: seller.id,
    asin: item.asin,
    name: item.title.slice(0, 90),
    category_path: [item.category, item.subcategory].filter(Boolean).join(" › "),
    target_market: "Amazon US",
    image_url: item.image,
    price_usd: price,
    cost_cny: costCny,
    freight_cny: freightCny,
    fba_fee_usd: fba,
    commission_pct: 15,
    coupon_pct: 0,
    return_rate_pct: 3.5,
    main_keyword: item.title.split(/[ ,-]/).slice(0, 3).join(" ").toLowerCase(),
    secondary_keywords: [],
    target_monthly_units: Math.min(2000, Math.max(100, Math.round(item.monthlyUnits * 0.04))),
    est_acos_pct: estAcos,
    conversion_pct: 8,
    scores: { demand: 0, competition: 0, profit: 0, differentiation: 0, risk: 0 },
    composite: 0,
    status: "draft",
    monthly_search: item.monthlyUnits, // Amazon monthly sales as the demand proxy
    weighted_cpc: wcpc,
    top3_concentration: top3,
    gross_margin_pct: grossMargin,
    created_at: "",
    updated_at: "",
  };
}

export async function recommendForSeller(
  seller: Seller,
  limit = 8,
  variety = 0,
): Promise<Recommendation[]> {
  const seeds = seedsFor(seller, variety);
  const band = priceBand(seller);

  const batches = await Promise.all(
    seeds.map(async (seed) => {
      try {
        const items = await searchProducts(seed, "US", {
          price_min: band.price_min,
          price_max: band.price_max,
          month_sales_volume_min: 300,
        });
        return { seed, items: items.filter((i) => i.asin && i.price > 0) };
      } catch {
        return { seed, items: [] as AmazonSearchItem[] };
      }
    }),
  );

  const recs: Recommendation[] = [];
  const seen = new Set<string>();
  for (let bi = 0; bi < batches.length; bi++) {
    const { seed, items } = batches[bi];
    if (!items.length) continue;
    // Top-3 sales concentration within this search batch (real signal).
    const sales = items.map((i) => i.monthlyUnits).sort((a, b) => b - a);
    const total = sales.reduce((a, b) => a + b, 0) || 1;
    const top3 = Math.round((sales.slice(0, 3).reduce((a, b) => a + b, 0) / total) * 100);

    // Sample 2 products from the batch's top sellers — shuffled by `variety`,
    // so regenerating surfaces different products instead of the same #1-3.
    const picked = seededShuffle(items.slice(0, 8), variety * 131 + bi * 17 + 7).slice(0, 2);
    for (const item of picked) {
      if (seen.has(item.asin)) continue;
      seen.add(item.asin);
      const evalObj = toEvaluation(seller, item, top3);
      const a = runAlpha(evalObj, seller, []);
      recs.push({
        asin: item.asin,
        name: evalObj.name,
        image: item.image,
        category: evalObj.category_path,
        price: item.price,
        monthlyUnits: item.monthlyUnits,
        fbaFee: evalObj.fba_fee_usd,
        opportunityIndex: a.opportunityIndex,
        level: a.decision.level,
        levelLabel: a.decision.levelLabel,
        netMarginAfterTacosPct: a.finance.netMarginAfterTacosPct,
        top3Concentration: top3,
        seed,
        gatePass: a.gatePass,
      });
    }
  }

  return recs.sort((x, y) => y.opportunityIndex - x.opportunityIndex).slice(0, limit);
}
