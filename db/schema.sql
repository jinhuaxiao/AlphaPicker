-- AlphaPicker schema

CREATE TABLE IF NOT EXISTS sellers (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  experience           TEXT NOT NULL DEFAULT 'novice',
  sales_band           TEXT NOT NULL DEFAULT 'lt5w',
  categories           TEXT[] NOT NULL DEFAULT '{}',
  risk_preference      INTEGER NOT NULL DEFAULT 30,
  per_product_budget_cny NUMERIC NOT NULL DEFAULT 0,
  platforms            TEXT[] NOT NULL DEFAULT '{}',
  plan                 TEXT NOT NULL DEFAULT '专业版',
  eval_quota_used      INTEGER NOT NULL DEFAULT 0,
  eval_quota_total     INTEGER NOT NULL DEFAULT 30,
  onboarded            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id                   SERIAL PRIMARY KEY,
  seller_id            INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  asin                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  category_path        TEXT NOT NULL DEFAULT '',
  target_market        TEXT NOT NULL DEFAULT 'Amazon US',
  image_url            TEXT,

  price_usd            NUMERIC NOT NULL DEFAULT 0,
  cost_cny             NUMERIC NOT NULL DEFAULT 0,
  freight_cny          NUMERIC NOT NULL DEFAULT 0,
  fba_fee_usd          NUMERIC NOT NULL DEFAULT 0,
  commission_pct       NUMERIC NOT NULL DEFAULT 15,
  coupon_pct           NUMERIC NOT NULL DEFAULT 0,
  return_rate_pct      NUMERIC NOT NULL DEFAULT 0,

  main_keyword         TEXT NOT NULL DEFAULT '',
  secondary_keywords   TEXT[] NOT NULL DEFAULT '{}',
  target_monthly_units INTEGER NOT NULL DEFAULT 0,
  est_acos_pct         NUMERIC NOT NULL DEFAULT 0,
  conversion_pct       NUMERIC NOT NULL DEFAULT 0,

  score_demand         INTEGER NOT NULL DEFAULT 0,
  score_competition    INTEGER NOT NULL DEFAULT 0,
  score_profit         INTEGER NOT NULL DEFAULT 0,
  score_differentiation INTEGER NOT NULL DEFAULT 0,
  score_risk           INTEGER NOT NULL DEFAULT 0,
  composite            INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'draft',

  monthly_search       INTEGER NOT NULL DEFAULT 0,
  weighted_cpc         NUMERIC NOT NULL DEFAULT 0,
  top3_concentration   NUMERIC NOT NULL DEFAULT 0,
  gross_margin_pct     NUMERIC NOT NULL DEFAULT 0,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, asin)
);

CREATE TABLE IF NOT EXISTS keywords (
  id              SERIAL PRIMARY KEY,
  evaluation_id   INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  keyword         TEXT NOT NULL,
  monthly_search  INTEGER NOT NULL DEFAULT 0,
  cpc             NUMERIC NOT NULL DEFAULT 0,
  competition     TEXT NOT NULL DEFAULT 'mid',
  top1_pct        NUMERIC NOT NULL DEFAULT 0,
  top3_pct        NUMERIC NOT NULL DEFAULT 0,
  traffic_share_pct NUMERIC NOT NULL DEFAULT 0,
  position        INTEGER NOT NULL DEFAULT 0
);

-- Real Amazon review VOC analysis, computed server-side from product_reviews
-- (Sorftime) at import time. Stores only the derived insight, never raw reviews.
CREATE TABLE IF NOT EXISTS review_insights (
  id            SERIAL PRIMARY KEY,
  seller_id     INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  asin          TEXT NOT NULL,
  amz_site      TEXT NOT NULL DEFAULT 'US',
  review_count  INTEGER NOT NULL DEFAULT 0,
  pos_count     INTEGER NOT NULL DEFAULT 0,
  neg_count     INTEGER NOT NULL DEFAULT 0,
  avg_star      NUMERIC NOT NULL DEFAULT 0,
  neg_ratio_pct NUMERIC NOT NULL DEFAULT 0,
  pain_points   JSONB   NOT NULL DEFAULT '[]',
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, asin, amz_site)
);

-- Real market capacity (TAM) + structure + trend, from Sorftime category_report
-- (类目统计报告), category_trend and product_trend at import time.
CREATE TABLE IF NOT EXISTS market_insights (
  id                 SERIAL PRIMARY KEY,
  seller_id          INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  asin               TEXT NOT NULL,
  amz_site           TEXT NOT NULL DEFAULT 'US',
  node_id            TEXT NOT NULL DEFAULT '',
  category_name      TEXT NOT NULL DEFAULT '',
  tam_units          BIGINT NOT NULL DEFAULT 0,   -- Top100 monthly units (market capacity proxy)
  tam_revenue_usd    NUMERIC NOT NULL DEFAULT 0,  -- Top100 monthly revenue
  top3_product_share NUMERIC NOT NULL DEFAULT 0,
  top3_brand_share   NUMERIC NOT NULL DEFAULT 0,
  top3_seller_share  NUMERIC NOT NULL DEFAULT 0,
  amazon_owned_share NUMERIC NOT NULL DEFAULT 0,  -- Amazon-self-operated sales share (entry risk)
  avg_price          NUMERIC NOT NULL DEFAULT 0,
  median_price       NUMERIC NOT NULL DEFAULT 0,
  high_reviews_share NUMERIC NOT NULL DEFAULT 0,  -- % sales from >1000-review products (review moat)
  growth_yoy_pct     NUMERIC NOT NULL DEFAULT 0,
  peak_month         TEXT NOT NULL DEFAULT '',    -- seasonality peak
  category_trend     JSONB NOT NULL DEFAULT '[]', -- [{month, value}] category monthly sales
  product_trend      JSONB NOT NULL DEFAULT '[]', -- [{month, value}] this product's monthly sales
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, asin, amz_site)
);

-- Keyword demand-breadth + competitor traffic-coverage gap, from Sorftime
-- category_keywords, keyword_extends and competitor_product_keywords.
CREATE TABLE IF NOT EXISTS keyword_insights (
  id                   SERIAL PRIMARY KEY,
  seller_id            INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  asin                 TEXT NOT NULL,
  amz_site             TEXT NOT NULL DEFAULT 'US',
  breadth_search_total BIGINT NOT NULL DEFAULT 0,  -- total monthly search across core keywords
  coverage_score       NUMERIC NOT NULL DEFAULT 0, -- % of core keywords ranked on page 1
  page1_count          INTEGER NOT NULL DEFAULT 0,
  gap_count            INTEGER NOT NULL DEFAULT 0,
  core_keywords        JSONB NOT NULL DEFAULT '[]', -- [{keyword, monthlySearch, cpc, results, season}]
  longtail             JSONB NOT NULL DEFAULT '[]', -- [{keyword, monthlySearch, cpc, season}]
  coverage             JSONB NOT NULL DEFAULT '[]', -- [{keyword, monthlySearch, page, slot}]
  gaps                 JSONB NOT NULL DEFAULT '[]', -- [{keyword, monthlySearch, cpc}]
  fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, asin, amz_site)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_seller ON evaluations(seller_id);
CREATE INDEX IF NOT EXISTS idx_keywords_eval ON keywords(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_review_insights_lookup ON review_insights(seller_id, asin, amz_site);
CREATE INDEX IF NOT EXISTS idx_market_insights_lookup ON market_insights(seller_id, asin, amz_site);
CREATE INDEX IF NOT EXISTS idx_keyword_insights_lookup ON keyword_insights(seller_id, asin, amz_site);
