// Backfill the review / market / keyword insights for existing Amazon
// evaluations (rows created before those modules existed). Idempotent: skips an
// insight that already exists unless run with --force. Leaves the evaluation
// rows themselves untouched (no re-scoring, no cost re-estimation).
//
//   npm run db:backfill            # fill only missing insights
//   npm run db:backfill -- --force # recompute all

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { pool } from "../src/lib/db";
import { productDetail, categoryReport } from "../src/lib/sorftime";
import { analyzeReviews, saveReviewInsight } from "../src/lib/reviews";
import { analyzeMarket, saveMarketInsight } from "../src/lib/market";
import { analyzeKeywords, saveKeywordInsight } from "../src/lib/keywords";
import { demandScore, compositeScore, statusFromComposite } from "../src/lib/scoring";
import type { ExperienceLevel } from "../src/lib/types";

const FORCE = process.argv.includes("--force");
const ASIN_RE = /^[A-Z0-9]{10}$/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function has(table: string, sellerId: number, asin: string, site: string): Promise<boolean> {
  if (FORCE) return false;
  const r = await pool.query(
    `SELECT 1 FROM ${table} WHERE seller_id=$1 AND asin=$2 AND amz_site=$3 LIMIT 1`,
    [sellerId, asin, site],
  );
  return (r.rowCount ?? 0) > 0;
}

async function main() {
  const { rows } = await pool.query<{
    seller_id: number;
    asin: string;
    target_market: string;
    main_keyword: string;
    name: string;
    monthly_search: number;
    tam_units: string;
    status: string;
    experience: string;
    score_demand: number;
    score_competition: number;
    score_profit: number;
    score_differentiation: number;
    score_risk: number;
    composite: number;
  }>(
    `SELECT e.seller_id, e.asin, e.target_market, e.main_keyword, e.name,
            e.monthly_search, e.tam_units, e.status,
            e.score_demand, e.score_competition, e.score_profit,
            e.score_differentiation, e.score_risk, e.composite,
            s.experience
       FROM evaluations e JOIN sellers s ON s.id = e.seller_id
      ORDER BY e.seller_id, e.asin`,
  );

  const targets = rows.filter((r) => ASIN_RE.test(r.asin));
  console.log(`${rows.length} evaluations, ${targets.length} Amazon ASINs to backfill${FORCE ? " (force)" : ""}.`);

  let done = 0;
  for (const e of targets) {
    const site = e.target_market.replace(/^Amazon\s+/i, "").trim() || "US";
    const tag = `${e.asin} [${site}]`;

    const needReview = !(await has("review_insights", e.seller_id, e.asin, site));
    const needMarket = !(await has("market_insights", e.seller_id, e.asin, site));
    const needKeyword = !(await has("keyword_insights", e.seller_id, e.asin, site));

    const parts: string[] = [];
    let tamUnits = 0; // captured for the demand rewire below

    // Reviews need only the asin.
    if (needReview) {
      try {
        const ri = await analyzeReviews(e.asin, site);
        if (ri) {
          await saveReviewInsight(e.seller_id, e.asin, site, ri);
          parts.push(`reviews(${ri.reviewCount})`);
        } else parts.push("reviews(none)");
      } catch (err) {
        parts.push(`reviews✗(${(err as Error).message.slice(0, 40)})`);
      }
    }

    // Market + keywords need the category nodeId.
    if (needMarket || needKeyword) {
      let nodeId = "";
      try {
        nodeId = (await productDetail(e.asin, site)).nodeId;
      } catch {
        /* leave nodeId empty → analyzers no-op */
      }
      const report = nodeId ? await categoryReport(nodeId, site).catch(() => null) : null;

      if (needMarket) {
        try {
          const mi = await analyzeMarket(e.asin, nodeId, site, report);
          if (mi) {
            await saveMarketInsight(e.seller_id, e.asin, site, mi);
            tamUnits = mi.tamUnits;
            parts.push(`market(${mi.tamUnits})`);
          } else parts.push("market(none)");
        } catch (err) {
          parts.push(`market✗(${(err as Error).message.slice(0, 40)})`);
        }
      }

      if (needKeyword) {
        try {
          const ki = await analyzeKeywords(e.asin, nodeId, e.main_keyword, site);
          if (ki) {
            await saveKeywordInsight(e.seller_id, e.asin, site, ki);
            parts.push(`keywords(${ki.coreKeywords.length})`);
          } else parts.push("keywords(none)");
        } catch (err) {
          parts.push(`keywords✗(${(err as Error).message.slice(0, 40)})`);
        }
      }
    }

    // Rewire the demand score with real TAM. Use the freshly computed value, or
    // the already-persisted market insight when market was skipped.
    if (!tamUnits) {
      const r = await pool.query<{ tam_units: string }>(
        "SELECT tam_units FROM market_insights WHERE seller_id=$1 AND asin=$2 AND amz_site=$3 LIMIT 1",
        [e.seller_id, e.asin, site],
      );
      tamUnits = Number(r.rows[0]?.tam_units ?? 0);
    }
    if (tamUnits > 0) {
      const newDemand = demandScore(e.monthly_search, tamUnits);
      const scores = {
        demand: newDemand,
        competition: e.score_competition,
        profit: e.score_profit,
        differentiation: e.score_differentiation,
        risk: e.score_risk,
      };
      const newComposite = compositeScore(scores, e.experience as ExperienceLevel);
      const newStatus =
        e.status === "draft" ? "draft" : statusFromComposite(newComposite, e.score_risk);
      const changed =
        newDemand !== e.score_demand ||
        newComposite !== e.composite ||
        Number(e.tam_units) !== tamUnits;
      if (changed || FORCE) {
        await pool.query(
          `UPDATE evaluations SET tam_units=$1, score_demand=$2, composite=$3, status=$4, updated_at=now()
             WHERE seller_id=$5 AND asin=$6`,
          [tamUnits, newDemand, newComposite, newStatus, e.seller_id, e.asin],
        );
        parts.push(`demand ${e.score_demand}→${newDemand}, 综合 ${e.composite}→${newComposite}`);
      }
    }

    if (parts.length === 0) {
      console.log(`· ${tag} — nothing to do`);
      continue;
    }
    done += 1;
    console.log(`✓ ${tag} ${e.name.slice(0, 26)} — ${parts.join(", ")}`);
    await sleep(800); // be gentle on the Sorftime quota
  }

  console.log(`\nDone. ${done} updated.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
