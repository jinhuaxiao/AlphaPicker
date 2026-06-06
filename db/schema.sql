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

CREATE INDEX IF NOT EXISTS idx_evaluations_seller ON evaluations(seller_id);
CREATE INDEX IF NOT EXISTS idx_keywords_eval ON keywords(evaluation_id);
