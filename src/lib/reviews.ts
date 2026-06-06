// Real Amazon review VOC analysis. Runs server-side (Sorftime key is server-only):
// pull a product's reviews, split positive/negative, and cluster the negatives
// into ranked pain points — each backed by a real customer quote. This replaces
// the hardcoded regex VOC in alpha.ts for Amazon (ASIN) products.

import { pool } from "./db";
import { productReviews, type AmazonReview } from "./sorftime";
import type { Severity, Solvable, VocPainPoint } from "./alpha";

export interface ReviewPainPoint {
  id: string;
  point: string; // canonical Chinese label
  severity: Severity;
  evidence: string; // frequency + real quote, shown in the UI
  count: number; // negative reviews mentioning this aspect
  sharePct: number; // count / negCount
  avgStar: number; // avg star of mentioning reviews
  quote: string; // representative real review excerpt
}

export interface ReviewInsight {
  reviewCount: number;
  posCount: number;
  negCount: number;
  avgStar: number;
  negRatioPct: number;
  painPoints: ReviewPainPoint[];
}

/** Aspect lexicon: English review signals → Chinese pain label + base severity. */
const ASPECTS: { label: string; severity: Severity; re: RegExp }[] = [
  { label: "密封性差 / 漏液", severity: "high", re: /\b(leak|leaks|leaked|leaking|leakage|spill|spills|spilled|drip|drips|dripping|watertight)\b/ },
  { label: "做工差 / 易损坏", severity: "high", re: /\b(broke|broken|breaks|breaking|crack|cracked|cracks|flimsy|fragile|cheap|cheaply|defective|fell apart|falls apart|poorly made|low quality|poor quality|stopped working|malfunction)\b/ },
  { label: "异味 / 化学味", severity: "mid", re: /\b(smell|smells|smelly|odor|odour|stink|stinks|chemical|toxic|plastic taste|bad taste|fumes)\b/ },
  { label: "尺寸 / 描述不符", severity: "mid", re: /\b(too small|too big|too large|tiny|doesn'?t fit|does not fit|not as described|misleading|smaller than|larger than|not the size|wrong size)\b/ },
  { label: "材质偏薄 / 生锈", severity: "mid", re: /\b(thin|flimsy material|rust|rusts|rusted|rusty|corrode|corroded|peeling|peeled|scratches|scratched|warp|warped)\b/ },
  { label: "清洗不便", severity: "mid", re: /\b(hard to clean|difficult to clean|cannot clean|can'?t clean|not dishwasher|mold|moldy|mildew|residue|stains|stained)\b/ },
  { label: "续航 / 性能不足", severity: "mid", re: /\b(battery|charge|charging|weak|underpowered|not powerful|loses suction|suction|doesn'?t hold|won'?t stay|slow)\b/ },
  { label: "安装 / 使用困难", severity: "low", re: /\b(hard to use|difficult to use|confusing|complicated|instructions|hard to assemble|difficult to assemble|hard to install)\b/ },
];

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function excerpt(s: string, n = 160): string {
  const t = clean(s);
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

const STOP = new Set([
  "the", "and", "for", "with", "but", "not", "this", "that", "are", "was", "you",
  "have", "has", "had", "they", "them", "very", "would", "could", "will", "just",
  "too", "out", "get", "got", "one", "all", "its", "it's", "from", "your", "than",
  "then", "when", "what", "which", "were", "been", "being", "about", "after", "also",
  "product", "item", "amazon", "bought", "buy", "purchase", "ordered", "order",
]);

/** Frequency fallback when no aspect matches (e.g. non-English reviews). */
function frequentPhrases(negatives: AmazonReview[]): ReviewPainPoint[] {
  const counts = new Map<string, { count: number; star: number; quote: string }>();
  for (const r of negatives) {
    const words = clean(`${r.title} ${r.body}`)
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter((w) => w.length >= 4 && !STOP.has(w));
    const seen = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (seen.has(bigram)) continue;
      seen.add(bigram);
      const cur = counts.get(bigram) ?? { count: 0, star: 0, quote: "" };
      cur.count += 1;
      if (!cur.quote || r.star < cur.star) {
        cur.star = r.star;
        cur.quote = excerpt(r.body || r.title);
      }
      counts.set(bigram, cur);
    }
  }
  const total = negatives.length || 1;
  return [...counts.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([phrase, v], i) => ({
      id: `voc${i + 1}`,
      point: `高频差评：${phrase}`,
      severity: "mid" as Severity,
      evidence: `差评提及 ${v.count} 次（占差评 ${Math.round((v.count / total) * 100)}%）· “${v.quote}”`,
      count: v.count,
      sharePct: Math.round((v.count / total) * 100),
      avgStar: 0,
      quote: v.quote,
    }));
}

function clusterNegatives(negatives: AmazonReview[]): ReviewPainPoint[] {
  const total = negatives.length || 1;
  const hits = ASPECTS.map((a) => {
    let count = 0;
    let starSum = 0;
    let quote = "";
    let quoteStar = 99;
    for (const r of negatives) {
      const text = clean(`${r.title} ${r.body}`).toLowerCase();
      if (!a.re.test(text)) continue;
      count += 1;
      starSum += r.star;
      if (r.star <= quoteStar && (r.body || r.title)) {
        quoteStar = r.star;
        quote = excerpt(r.body || r.title);
      }
    }
    return { ...a, count, avgStar: count ? starSum / count : 0, quote };
  })
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (hits.length === 0) return frequentPhrases(negatives);

  return hits.map((h, i) => {
    const sharePct = Math.round((h.count / total) * 100);
    // Escalate to high when an aspect dominates the negatives.
    const severity: Severity = sharePct >= 30 ? "high" : h.severity;
    return {
      id: `voc${i + 1}`,
      point: h.label,
      severity,
      evidence: `差评提及 ${h.count} 次（占差评 ${sharePct}%，均 ${h.avgStar.toFixed(1)}★）· “${h.quote}”`,
      count: h.count,
      sharePct,
      avgStar: Number(h.avgStar.toFixed(1)),
      quote: h.quote,
    };
  });
}

/**
 * Fetch and analyze a product's reviews into a VOC insight.
 * Returns null when no reviews are available (caller falls back to regex VOC).
 */
export async function analyzeReviews(
  asin: string,
  site = "US",
): Promise<ReviewInsight | null> {
  const reviews = await productReviews(asin, site, "Both");
  if (!reviews.length) return null;

  const negatives = reviews.filter((r) => r.star > 0 && r.star <= 3);
  const positives = reviews.filter((r) => r.star >= 4);
  const starred = reviews.filter((r) => r.star > 0);
  const avgStar = starred.length
    ? starred.reduce((a, r) => a + r.star, 0) / starred.length
    : 0;
  const negRatioPct = starred.length
    ? Math.round((negatives.length / starred.length) * 100)
    : 0;

  let painPoints = negatives.length ? clusterNegatives(negatives) : [];
  const refined = await refineWithLLM(negatives, painPoints);
  if (refined) painPoints = refined;

  return {
    reviewCount: reviews.length,
    posCount: positives.length,
    negCount: negatives.length,
    avgStar: Number(avgStar.toFixed(2)),
    negRatioPct,
    painPoints,
  };
}

/** Upsert a computed insight, keyed by (seller, asin, site). */
export async function saveReviewInsight(
  sellerId: number,
  asin: string,
  site: string,
  insight: ReviewInsight,
): Promise<void> {
  await pool.query(
    `INSERT INTO review_insights
       (seller_id, asin, amz_site, review_count, pos_count, neg_count, avg_star, neg_ratio_pct, pain_points, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (seller_id, asin, amz_site) DO UPDATE SET
       review_count=EXCLUDED.review_count, pos_count=EXCLUDED.pos_count, neg_count=EXCLUDED.neg_count,
       avg_star=EXCLUDED.avg_star, neg_ratio_pct=EXCLUDED.neg_ratio_pct,
       pain_points=EXCLUDED.pain_points, fetched_at=now()`,
    [
      sellerId, asin, site, insight.reviewCount, insight.posCount, insight.negCount,
      insight.avgStar, insight.negRatioPct, JSON.stringify(insight.painPoints),
    ] as never[],
  );
}

/** Map persisted pain points to the VocPainPoint shape runAlpha consumes. */
export function toVocPainPoints(
  painPoints: ReviewPainPoint[],
  confirmations: Record<string, Solvable> = {},
): VocPainPoint[] {
  return painPoints.map((p) => ({
    id: p.id,
    point: p.point,
    severity: p.severity,
    evidence: p.evidence,
    supplierSolvable: confirmations[p.id] ?? null,
  }));
}

/**
 * Optional LLM refinement — only runs when ANTHROPIC_API_KEY is set. Sends the
 * top negative-review snippets to Claude for cleaner Chinese pain-point labels.
 * Any failure silently falls back to the deterministic result. supplierSolvable
 * stays a human decision and is never set here.
 */
async function refineWithLLM(
  negatives: AmazonReview[],
  fallback: ReviewPainPoint[],
): Promise<ReviewPainPoint[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || negatives.length < 3) return null;

  const snippets = negatives
    .slice(0, 40)
    .map((r) => `(${r.star}★) ${clean(`${r.title}. ${r.body}`).slice(0, 200)}`)
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          "你是亚马逊选品分析师。基于差评聚类出最多5个产品痛点。只输出 JSON 数组，每项: " +
          '{"point":"中文痛点(≤12字)","severity":"high|mid|low","count":整数,"quote":"原文英文摘录"}。按严重度与频次排序。',
        messages: [{ role: "user", content: `差评样本：\n${snippets}` }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]) as {
      point: string;
      severity: Severity;
      count?: number;
      quote?: string;
    }[];
    if (!Array.isArray(arr) || !arr.length) return null;
    const total = negatives.length || 1;
    return arr.slice(0, 5).map((p, i) => {
      const count = Number(p.count) || 0;
      const sharePct = count ? Math.round((count / total) * 100) : 0;
      const quote = excerpt(p.quote || "");
      return {
        id: `voc${i + 1}`,
        point: String(p.point).slice(0, 20),
        severity: (["high", "mid", "low"].includes(p.severity) ? p.severity : "mid") as Severity,
        evidence: `AI 聚类差评${count ? ` ${count} 次（占 ${sharePct}%）` : ""}${quote ? ` · “${quote}”` : ""}`,
        count,
        sharePct,
        avgStar: 0,
        quote,
      };
    });
  } catch {
    return fallback.length ? null : null; // any error → deterministic fallback
  }
}
