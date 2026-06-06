// Server-side eBay client. Mints an OAuth application token from the
// APP/CERT credentials and queries the Browse API for live cross-platform pricing.

const APPID = process.env.EBAY_APPID ?? "";
const CERTID = process.env.EBAY_CERTID ?? "";
const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

let cached: { token: string; expiresAt: number } | null = null;

async function appToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${APPID}:${CERTID}`).toString("base64");
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body:
      "grant_type=client_credentials&scope=" +
      encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`eBay token: ${JSON.stringify(data).slice(0, 200)}`);
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export interface EbayItem {
  title: string;
  price: number;
  currency: string;
  condition: string;
  url: string;
  image: string;
}

export interface EbayReference {
  query: string;
  marketplace: string;
  total: number; // total live listings matching
  count: number; // sampled
  currency: string;
  min: number;
  median: number;
  max: number;
  items: EbayItem[];
}

/* ---------- richer market view (used to build real evaluations) ---------- */

export interface EbayMarketItem {
  legacyId: string;
  title: string;
  price: number;
  image: string;
  seller: string;
  feedback: number;
  category: string;
  url: string;
}

export interface EbayMarket {
  query: string;
  total: number; // total live listings (market size proxy)
  sample: number;
  currency: string;
  priceMin: number;
  priceMedian: number;
  priceMax: number;
  top3SellerSharePct: number; // concentration within the sample
  related: { term: string; count: number; sharePct: number }[];
  representative: EbayMarketItem | null; // a mid-priced item with an image
}

const STOP = new Set([
  "the", "and", "for", "with", "set", "pack", "new", "of", "to", "in", "a", "x",
  "pcs", "pc", "piece", "pieces", "size", "color", "black", "white", "free", "us",
  "kitchen", "home", "dog", "pet", "stainless", "steel",
]);

async function browse(query: string, marketplace: string, limit: number) {
  const token = await appToken();
  const res = await fetch(
    `${BROWSE_URL}?q=${encodeURIComponent(query)}&limit=${limit}&filter=${encodeURIComponent("buyingOptions:{FIXED_PRICE}")}`,
    {
      headers: { authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": marketplace },
      signal: AbortSignal.timeout(20_000),
    },
  );
  return res.json();
}

export async function ebayMarket(
  query: string,
  marketplace = "EBAY_US",
  limit = 50,
): Promise<EbayMarket> {
  const data = await browse(query, marketplace, limit);
  const summaries: Record<string, unknown>[] = data.itemSummaries ?? [];

  const items: EbayMarketItem[] = summaries
    .map((s) => {
      const price = (s.price as { value?: string; currency?: string }) ?? {};
      const cats = (s.categories as { categoryName?: string }[]) ?? [];
      const leaf = cats[0]?.categoryName ?? "";
      const root = cats[cats.length - 1]?.categoryName ?? "";
      const seller = (s.seller as { username?: string; feedbackScore?: number }) ?? {};
      return {
        legacyId: String(s.itemId ?? "").split("|")[1] ?? "",
        title: String(s.title ?? ""),
        price: Number(price.value ?? 0),
        image: String((s.image as { imageUrl?: string })?.imageUrl ?? ""),
        seller: String(seller.username ?? ""),
        feedback: Number(seller.feedbackScore ?? 0),
        category: root && root !== leaf ? `${root} › ${leaf}` : leaf || "eBay",
        url: String(s.itemWebUrl ?? ""),
      };
    })
    .filter((i) => i.price > 0);

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

  // seller concentration within the sample
  const sellerCounts = new Map<string, number>();
  for (const i of items) sellerCounts.set(i.seller, (sellerCounts.get(i.seller) ?? 0) + 1);
  const top3 = [...sellerCounts.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  const top3SellerSharePct = items.length ? Math.round((top3 / items.length) * 100) : 0;

  // related terms from titles
  const termCounts = new Map<string, number>();
  const qTokens = new Set(query.toLowerCase().split(/\s+/));
  for (const i of items) {
    const seen = new Set<string>();
    for (const tok of i.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)) {
      if (tok.length < 3 || STOP.has(tok) || qTokens.has(tok) || seen.has(tok)) continue;
      seen.add(tok);
      termCounts.set(tok, (termCounts.get(tok) ?? 0) + 1);
    }
  }
  const related = [...termCounts.entries()]
    .map(([term, count]) => ({ term, count, sharePct: Math.round((count / (items.length || 1)) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // representative item: closest-to-median price, must have an image
  let representative: EbayMarketItem | null = null;
  let best = Infinity;
  for (const i of items) {
    if (!i.image) continue;
    const d = Math.abs(i.price - median);
    if (d < best) { best = d; representative = i; }
  }

  return {
    query,
    total: Number(data.total ?? items.length),
    sample: items.length,
    currency: items[0]?.price ? "USD" : "USD",
    priceMin: prices[0] ?? 0,
    priceMedian: median,
    priceMax: prices[prices.length - 1] ?? 0,
    top3SellerSharePct,
    related,
    representative,
  };
}

export async function ebayReference(
  query: string,
  marketplace = "EBAY_US",
  limit = 50,
): Promise<EbayReference> {
  const token = await appToken();
  const res = await fetch(
    `${BROWSE_URL}?q=${encodeURIComponent(query)}&limit=${limit}&filter=${encodeURIComponent("buyingOptions:{FIXED_PRICE}")}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplace,
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  const data = await res.json();
  const summaries: Record<string, unknown>[] = data.itemSummaries ?? [];

  const items: EbayItem[] = summaries
    .map((s) => {
      const price = (s.price as { value?: string; currency?: string }) ?? {};
      return {
        title: String(s.title ?? ""),
        price: Number(price.value ?? 0),
        currency: String(price.currency ?? "USD"),
        condition: String(s.condition ?? ""),
        url: String(s.itemWebUrl ?? ""),
        image: String((s.image as { imageUrl?: string })?.imageUrl ?? ""),
      };
    })
    .filter((i) => i.price > 0);

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

  return {
    query,
    marketplace,
    total: Number(data.total ?? summaries.length),
    count: items.length,
    currency: items[0]?.currency ?? "USD",
    min: prices[0] ?? 0,
    median,
    max: prices[prices.length - 1] ?? 0,
    items: items.slice(0, 6),
  };
}
