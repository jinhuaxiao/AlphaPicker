// Keyword demand-breadth + competitor traffic-coverage gap analysis. Runs
// server-side from three Sorftime tools: category_keywords (the subcategory's
// core keyword universe), keyword_extends (long-tail entry points), and
// competitor_product_keywords (the product's natural-rank positions). The gap =
// high-volume core keywords the product does not yet rank for on page 1.

import { pool } from "./db";
import {
  categoryKeywords,
  keywordExtends,
  competitorProductKeywords,
  type CoreKeyword,
  type LongTailKeyword,
  type CoverageKeyword,
} from "./sorftime";

export interface KeywordGap {
  keyword: string;
  monthlySearch: number;
  cpc: number;
}

export interface KeywordInsight {
  breadthSearchTotal: number; // total monthly search across core keywords
  coverageScore: number; // % of core keywords ranked page 1
  page1Count: number;
  gapCount: number;
  coreKeywords: CoreKeyword[];
  longtail: LongTailKeyword[];
  coverage: CoverageKeyword[];
  gaps: KeywordGap[];
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * Build the keyword breadth + traffic-gap insight for a product.
 * Returns null when no core keywords are available for the category.
 */
export async function analyzeKeywords(
  asin: string,
  nodeId: string,
  mainKeyword: string,
  site = "US",
): Promise<KeywordInsight | null> {
  const [core, cov] = await Promise.all([
    categoryKeywords(nodeId, site).catch(() => [] as CoreKeyword[]),
    competitorProductKeywords(asin, site).catch(() => [] as CoverageKeyword[]),
  ]);
  if (!core.length) return null;

  const seed = mainKeyword || core[0].keyword;
  const ext = await keywordExtends(seed, site).catch(() => [] as LongTailKeyword[]);

  // Best (lowest) natural-rank page the product holds per keyword.
  const bestPage = new Map<string, number>();
  for (const c of cov) {
    if (!c.page) continue;
    const k = norm(c.keyword);
    const prev = bestPage.get(k);
    if (prev === undefined || c.page < prev) bestPage.set(k, c.page);
  }

  const isPage1 = (kw: string) => bestPage.get(norm(kw)) === 1;
  const page1Count = core.filter((c) => isPage1(c.keyword)).length;
  const coverageScore = Math.round((page1Count / core.length) * 100);

  // Gap = high-volume core keywords the product does NOT rank page-1 for.
  const gaps: KeywordGap[] = core
    .filter((c) => !isPage1(c.keyword))
    .sort((a, b) => b.monthlySearch - a.monthlySearch)
    .slice(0, 12)
    .map((c) => ({ keyword: c.keyword, monthlySearch: c.monthlySearch, cpc: c.cpc }));

  const coreSet = new Set(core.map((c) => norm(c.keyword)));
  const longtail = ext
    .filter((e) => !coreSet.has(norm(e.keyword)))
    .sort((a, b) => b.monthlySearch - a.monthlySearch)
    .slice(0, 15);

  return {
    breadthSearchTotal: core.reduce((a, c) => a + c.monthlySearch, 0),
    coverageScore,
    page1Count,
    gapCount: core.length - page1Count,
    coreKeywords: core.sort((a, b) => b.monthlySearch - a.monthlySearch).slice(0, 20),
    longtail,
    coverage: cov.sort((a, b) => b.monthlySearch - a.monthlySearch).slice(0, 15),
    gaps,
  };
}

/** Upsert a keyword insight, keyed by (seller, asin, site). */
export async function saveKeywordInsight(
  sellerId: number,
  asin: string,
  site: string,
  ki: KeywordInsight,
): Promise<void> {
  await pool.query(
    `INSERT INTO keyword_insights
       (seller_id, asin, amz_site, breadth_search_total, coverage_score, page1_count,
        gap_count, core_keywords, longtail, coverage, gaps, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     ON CONFLICT (seller_id, asin, amz_site) DO UPDATE SET
       breadth_search_total=EXCLUDED.breadth_search_total, coverage_score=EXCLUDED.coverage_score,
       page1_count=EXCLUDED.page1_count, gap_count=EXCLUDED.gap_count,
       core_keywords=EXCLUDED.core_keywords, longtail=EXCLUDED.longtail,
       coverage=EXCLUDED.coverage, gaps=EXCLUDED.gaps, fetched_at=now()`,
    [
      sellerId, asin, site, ki.breadthSearchTotal, ki.coverageScore, ki.page1Count,
      ki.gapCount, JSON.stringify(ki.coreKeywords), JSON.stringify(ki.longtail),
      JSON.stringify(ki.coverage), JSON.stringify(ki.gaps),
    ] as never[],
  );
}
