// Server-side client for the Sorftime MCP server (Amazon market data).
// The server is stateless: a single JSON-RPC `tools/call` POST per request.

function url() {
  // Read at call time so scripts that load dotenv after import still work.
  const endpoint = process.env.SORFTIME_MCP_URL ?? "https://mcp.sorftime.com";
  const key = process.env.SORFTIME_KEY ?? "";
  return key ? `${endpoint}?key=${key}` : endpoint;
}

type ToolContent = unknown; // parsed JSON, or raw string

export async function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolContent> {
  const res = await fetch(url(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1e9),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    // Sorftime can be slow; give it room.
    signal: AbortSignal.timeout(30_000),
  });

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  let message: { result?: { content?: { type: string; text?: string }[] }; error?: unknown } | undefined;
  if (ct.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        try {
          const m = JSON.parse(line.slice(5).trim());
          if (m.result || m.error) message = m;
        } catch {
          /* ignore */
        }
      }
    }
  } else {
    try {
      message = JSON.parse(text);
    } catch {
      /* ignore */
    }
  }

  if (!message) throw new Error(`Sorftime ${name}: unparseable response`);
  if (message.error) throw new Error(`Sorftime ${name}: ${JSON.stringify(message.error)}`);

  const content = message.result?.content ?? [];
  const textPart = content.find((c) => c.type === "text")?.text ?? "";
  try {
    return JSON.parse(textPart);
  } catch {
    return textPart; // product_detail returns key：value lines, not JSON
  }
}

/* ---------- parsing helpers ---------- */

function firstNumber(s: string | undefined): number {
  if (!s) return 0;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** product_detail returns full-width "键：值" lines. */
export function parseDetail(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const idx = raw.indexOf("：");
    if (idx === -1) continue;
    const key = raw.slice(0, idx).trim();
    const val = raw.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

/* ---------- typed result shapes ---------- */

export interface AmazonSearchItem {
  asin: string;
  title: string;
  brand: string;
  price: number;
  monthlyUnits: number;
  monthlyRevenue: number;
  star: number;
  reviews: number;
  image: string;
  fbaFee: number;
  category: string;
  subcategory: string;
}

export interface AmazonDetail {
  asin: string;
  title: string;
  brand: string;
  image: string;
  price: number;
  fbaFee: number;
  grossMarginPct: number; // Sorftime 毛利率 (pre product-cost: after FBA + referral)
  grossProfitUsd: number;
  nodeId: string;
  category: string;
  subcategory: string;
  monthlyUnits: number;
  reviews: number;
  star: number;
  variations: number;
}

export interface TrafficTerm {
  keyword: string;
  monthlySearch: number;
  recommendedCpc: number;
}

export interface SearchFilters {
  price_min?: number;
  price_max?: number;
  month_sales_volume_min?: number;
}

export async function searchProducts(
  query: string,
  site = "US",
  filters: SearchFilters = {},
): Promise<AmazonSearchItem[]> {
  const data = (await callTool("product_search", {
    searchName: query,
    amzSite: site,
    ...filters,
  })) as Record<string, unknown>[];
  if (!Array.isArray(data)) return [];
  return data.map((r) => ({
    asin: String(r["产品ASIN码"] ?? ""),
    title: String(r["标题"] ?? ""),
    brand: String(r["品牌"] ?? ""),
    price: Number(r["价格"] ?? 0),
    monthlyUnits: Number(r["月销量"] ?? 0),
    monthlyRevenue: Number(r["月销额"] ?? 0),
    star: Number(r["星级"] ?? 0),
    reviews: Number(r["评论数"] ?? 0),
    image: String(r["主图"] ?? ""),
    fbaFee: Number(r["FBA费用"] ?? 0),
    category: String(r["所属大类"] ?? "").replace(/（.*$/, "").trim(),
    subcategory: String(r["所属细分类目"] ?? "").replace(/（.*$/, "").trim(),
  }));
}

export async function productDetail(
  asin: string,
  site = "US",
): Promise<AmazonDetail> {
  const raw = (await callTool("product_detail", { asin, amzSite: site })) as string;
  const d = parseDetail(typeof raw === "string" ? raw : "");
  const cat = (d["所属大类"] || "").replace(/（.*$/, "").trim();
  const sub = (d["所属细分类目"] || "").replace(/（.*$/, "").trim();
  return {
    asin: d["产品ASIN码"] || asin,
    title: d["标题"] || "",
    brand: d["品牌"] || "",
    image: d["主图"] || "",
    price: firstNumber(d["价格"]),
    fbaFee: firstNumber(d["FBA费用"]),
    grossMarginPct: firstNumber(d["毛利率"]),
    grossProfitUsd: firstNumber(d["毛利"]),
    nodeId: d["所属nodeid"] || "",
    category: cat,
    subcategory: sub,
    monthlyUnits: firstNumber(d["月销量"]),
    reviews: firstNumber(d["评论数"]),
    star: firstNumber(d["星级"]),
    variations: firstNumber(d["子体数"]),
  };
}

export async function trafficTerms(
  asin: string,
  site = "US",
): Promise<TrafficTerm[]> {
  const data = (await callTool("product_traffic_terms", {
    asin,
    amzSite: site,
  })) as Record<string, unknown>[];
  if (!Array.isArray(data)) return [];
  return data
    .map((r) => ({
      keyword: String(r["关键词"] ?? ""),
      monthlySearch: Number(r["月搜索量"] ?? 0),
      recommendedCpc: firstNumber(String(r["推荐竞价"] ?? "0")),
    }))
    .filter((t) => t.keyword);
}

export interface AmazonReview {
  date: string; // yyyyMMdd
  star: number;
  title: string;
  body: string;
  attrs: string; // variation attributes, e.g. "Flavor Name=Chicken;Pattern Name=Large"
}

/** Up to ~100 of a product's reviews from the last year. */
export async function productReviews(
  asin: string,
  site = "US",
  reviewType: "Both" | "Positive" | "Negative" = "Both",
): Promise<AmazonReview[]> {
  const data = (await callTool("product_reviews", {
    asin,
    amzSite: site,
    reviewType,
  })) as Record<string, unknown>[];
  if (!Array.isArray(data)) return [];
  return data.map((r) => ({
    date: String(r["评论日期"] ?? ""),
    star: firstNumber(String(r["评星"] ?? "0")),
    title: String(r["标题"] ?? ""),
    body: String(r["评论"] ?? ""),
    attrs: String(r["评论产品的属性"] ?? ""),
  }));
}

export interface CategoryReport {
  /** Raw 类目统计报告 key→value strings (capacity, concentration, prices, review moat). */
  stats: Record<string, string>;
  /** Top100 products in the subcategory. */
  top100: Record<string, unknown>[];
}

/** Full category Top100 report incl. the 类目统计报告 market-structure block. */
export async function categoryReport(
  nodeId: string,
  site = "US",
): Promise<CategoryReport | null> {
  if (!nodeId) return null;
  const data = (await callTool("category_report", { nodeId, amzSite: site })) as {
    Top100产品?: Record<string, unknown>[];
    类目统计报告?: Record<string, string>;
  };
  if (!data || typeof data !== "object") return null;
  return {
    stats: data["类目统计报告"] ?? {},
    top100: Array.isArray(data["Top100产品"]) ? data["Top100产品"] : [],
  };
}

export interface TrendPoint {
  month: string; // YYYY-MM
  value: number;
}

/** Parse Sorftime "YYYY年MM月=value" trend payloads (text or stringified). */
function parseYmSeries(text: string): TrendPoint[] {
  const out: TrendPoint[] = [];
  const re = /(\d{4})年(\d{1,2})月\s*=\s*(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ month: `${m[1]}-${m[2].padStart(2, "0")}`, value: Number(m[3]) });
  }
  return out;
}

/** Category market trend (default: monthly Top100 sales count) over ~2 years. */
export async function categoryTrend(
  nodeId: string,
  trendIndex = "SalesCount",
  site = "US",
): Promise<TrendPoint[]> {
  if (!nodeId) return [];
  const t = await callTool("category_trend", { nodeId, trendIndex, amzSite: site });
  return parseYmSeries(typeof t === "string" ? t : JSON.stringify(t));
}

/** A product's own historical trend (default: monthly sales volume). */
export async function productTrend(
  asin: string,
  productTrendType = "SalesVolume",
  site = "US",
): Promise<TrendPoint[]> {
  const t = await callTool("product_trend", { asin, productTrendType, amzSite: site });
  return parseYmSeries(typeof t === "string" ? t : JSON.stringify(t));
}
