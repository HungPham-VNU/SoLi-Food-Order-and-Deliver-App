-- Manual ops migration: AI search production ranking stats.
--
-- These tables store precomputed global popularity signals used by the Phase 3
-- ranking pipeline. They are refreshed from delivered order history and joined
-- during retrieval so search requests do not aggregate orders inline.

CREATE TABLE IF NOT EXISTS ai_search_item_ranking_stats (
  menu_item_id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  delivered_order_count_30d INTEGER NOT NULL DEFAULT 0,
  delivered_order_count_90d INTEGER NOT NULL DEFAULT 0,
  ordered_quantity_30d INTEGER NOT NULL DEFAULT 0,
  ordered_quantity_90d INTEGER NOT NULL DEFAULT 0,
  last_ordered_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_search_item_ranking_stats_restaurant_idx
  ON ai_search_item_ranking_stats (restaurant_id);

CREATE INDEX IF NOT EXISTS ai_search_item_ranking_stats_updated_idx
  ON ai_search_item_ranking_stats (updated_at);

CREATE TABLE IF NOT EXISTS ai_search_restaurant_ranking_stats (
  restaurant_id UUID PRIMARY KEY,
  delivered_order_count_30d INTEGER NOT NULL DEFAULT 0,
  delivered_order_count_90d INTEGER NOT NULL DEFAULT 0,
  ordered_quantity_30d INTEGER NOT NULL DEFAULT 0,
  ordered_quantity_90d INTEGER NOT NULL DEFAULT 0,
  last_ordered_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_search_restaurant_ranking_stats_updated_idx
  ON ai_search_restaurant_ranking_stats (updated_at);
