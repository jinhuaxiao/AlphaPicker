import { config } from "dotenv";

config({ path: ".env.local" });
config();

// Each entry is imported LIVE from the eBay Browse API (Sorftime is over quota).
// Real price/image/category/seller-concentration/related-terms are pulled per keyword.
// Optional COGS (¥/件) reverse-derives the margin so score and P&L stay aligned.
const SEED: { q: string; costCny?: number; freightCny?: number }[] = [
  { q: "elevated dog bowl stainless steel", costCny: 9, freightCny: 4 },
  { q: "garlic press stainless steel", costCny: 6, freightCny: 2 },
  { q: "clear drawer organizer set", costCny: 14, freightCny: 5 },
  { q: "cable management sleeve", costCny: 10, freightCny: 3 },
  { q: "reusable lint roller", costCny: 7, freightCny: 3 },
  { q: "insulated water bottle stainless", costCny: 34, freightCny: 10 },
];

async function main() {
  // Import after dotenv so the pg pool + Sorftime client see the env.
  const { pool } = await import("../src/lib/db");
  const { importByEbayKeyword } = await import("../src/lib/importProduct");
  const { getSeller } = await import("../src/lib/queries");

  await pool.query("TRUNCATE keywords, evaluations, sellers RESTART IDENTITY CASCADE");

  await pool.query(
    `INSERT INTO sellers (name, experience, sales_band, categories, risk_preference,
        per_product_budget_cny, platforms, plan, eval_quota_used, eval_quota_total, onboarded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    ["老高", "novice", "lt5w", ["宠物", "厨房", "收纳", "家居"], 30, 40000,
     ["Amazon US", "TikTok Shop"], "专业版", 0, 30, true],
  );
  const seller = await getSeller();
  if (!seller) throw new Error("seller insert failed");

  let ok = 0;
  for (const item of SEED) {
    try {
      const r = await importByEbayKeyword(seller, item.q, {
        costCny: item.costCny,
        freightCny: item.freightCny,
      });
      ok++;
      console.log(`✓ ${item.q} → ${r.asin} · 综合 ${r.composite} · ${r.status} · 毛利率 ${r.grossMarginPct}% · ${r.source}`);
    } catch (e) {
      console.log(`✗ ${item.q} — ${(e as Error).message}`);
    }
  }

  // Keep one draft so the 草稿 tab is non-empty (no live data needed).
  await pool.query(
    `INSERT INTO evaluations (seller_id, asin, name, category_path, target_market,
        price_usd, cost_cny, freight_cny, fba_fee_usd, main_keyword, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
     ON CONFLICT (seller_id, asin) DO NOTHING`,
    [seller.id, "DRAFT0001", "LED Strip Corner Clip", "Home › Lighting › Accessories",
     "Amazon US", 8.99, 6, 2, 3.1, "led strip corner clip"],
  );

  // Reflect real usage in the quota.
  await pool.query("UPDATE sellers SET eval_quota_used = $1 WHERE id = $2", [ok + 1, seller.id]);

  console.log(`\n✓ seeded seller 老高 + ${ok} real products (Sorftime) + 1 draft`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
