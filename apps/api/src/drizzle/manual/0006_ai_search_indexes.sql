CREATE INDEX IF NOT EXISTS menu_items_price_idx
  ON menu_items (price);

CREATE INDEX IF NOT EXISTS restaurants_rating_idx
  ON restaurants (average_rating, review_count);

CREATE INDEX IF NOT EXISTS menu_item_nutrition_protein_idx
  ON menu_item_nutrition (protein);

CREATE INDEX IF NOT EXISTS menu_item_nutrition_calories_idx
  ON menu_item_nutrition (calories);

