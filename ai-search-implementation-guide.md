# AI Search Implementation Guide for Customer Mobile App

## 1. Goal

Implement an optional AI search mode in the customer mobile app.

The current search box supports direct keyword search through `GET /api/search`. The new feature should let a customer type natural language requests such as:

```text
high protein food
highly rated food nearby
budget food
cheap banh mi near me
spicy noodles under 50000
healthy dinner with chicken
```

The user can toggle AI mode on or off from the search surface:

- AI mode off: keep the current classic search behavior.
- AI mode on: interpret the natural language query, retrieve real menu items/restaurants, explain why results match, and still allow direct navigation to menu items/restaurants.

The important product rule is:

```text
AI interprets the query.
Backend retrieves real catalog data.
Backend ranks deterministically.
AI may summarize only the returned data.
```

Do not let the model invent restaurants, menu items, prices, ratings, delivery distances, or nutrition facts.

---

## 2. Reference Model: Google AI Mode and Chrome

Google's AI Mode in Search is a useful reference because it is not only a chatbot. It is a search mode built on top of retrieval systems. According to Google's March 2025 announcement, AI Mode supports complex multi-part questions, follow-up questions, links to source content, real-time information sources, and a "query fan-out" technique that runs multiple related searches across subtopics and data sources before merging the answer.

Reference links:

- Google Search announcement: https://blog.google/products-and-platforms/products/search/ai-mode-search/
- The Verge coverage of Gemini in Chrome moving into a persistent panel and handling multi-step browsing tasks: https://www.theverge.com/news/869731/google-gemini-ai-chrome-auto-browse

What to copy for UITFood:

- A clear AI mode entry point instead of silently changing every search.
- Natural language input in the same search box.
- Query fan-out: turn one natural language query into several retrieval branches.
- Grounded results: show real items/restaurants and links/actions, not only prose.
- Follow-up chips such as "cheaper", "higher protein", "nearer", "open now".
- Fallback to classic results when AI confidence is low or the AI service fails.

What not to copy for MVP:

- Web-wide retrieval.
- Browser automation.
- Multi-tab/page analysis.
- Generated long-form answers without actionable food cards.

For this app, the "AI Mode" should feel like a smarter food search, not a general assistant.

---

## 3. Current System Baseline

The project already has a strong foundation for this feature.

Backend:

- `apps/api/src/module/restaurant-catalog/search/search.controller.ts`
- `apps/api/src/module/restaurant-catalog/search/search.service.ts`
- `apps/api/src/module/restaurant-catalog/search/search.repository.ts`
- Current endpoint: `GET /api/search`
- Current query params: `q`, `category`, `cuisineType`, `tag`, `lat`, `lon`, `radiusKm`, `offset`, `limit`
- Current response: `{ restaurants, items, total }`
- Existing features: accent-insensitive search, restaurant/item sections, geo radius filtering, tags, cuisine filtering, item prices, restaurant ratings.

Mobile:

- `apps/mobile/src/features/restaurants/screen/home-screen.tsx`
- `apps/mobile/src/features/restaurants/components/home/home-search-bar.tsx`
- `apps/mobile/src/features/restaurants/components/home/home-search-results.tsx`
- `apps/mobile/src/features/restaurants/api/restaurant-api.ts`
- Current hook: `useUnifiedSearch`
- Current UX: typing in `HomeSearchBar` activates `HomeSearchResults`.

AI infrastructure:

- The API already has AI nutrition code under `apps/api/src/module/nutrition/ai`.
- Existing env vars: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_API_KEY`.
- Existing pattern: call AI from the backend only, validate output locally, keep deterministic domain logic outside the model.

This feature should extend search. It should not replace the existing search stack.

---

## 4. MVP Scope

### Included

- AI mode toggle in the customer home search area.
- Persist the toggle locally on the device.
- New backend endpoint for AI search.
- Structured intent extraction from natural language.
- Deterministic retrieval and ranking over real menu/restaurant data.
- Result cards with short match reasons.
- Graceful fallback to `GET /api/search`.
- Basic follow-up suggestions.
- Observability events for latency, fallback, and zero-result searches.

### Not included

- Voice input.
- Image input.
- Chat history.
- Personal medical/diet advice.
- Vector database.
- Web search.
- Restaurant-side AI search management.
- Fully conversational multi-turn assistant.

---

## 5. User Experience

### Search Box

Keep the existing search box. Add a compact mode control inside or near it:

```text
[Search restaurants, dishes...]        [AI]
```

Recommended behavior:

- Use a switch, segmented control, or sparkle/icon toggle.
- Persist with AsyncStorage or Zustand persistence.
- AI mode off placeholder: `Search restaurants, dishes...`
- AI mode on placeholder: `Ask for food by need, budget, rating...`
- Keep the same submit/search keyboard behavior.

### AI Results Layout

In AI mode, return a search results view with:

1. Interpreted query summary.
2. Applied filter chips.
3. Best matching food item cards.
4. Restaurant cards when restaurant-level results are relevant.
5. Follow-up chips.

Example for `high protein food`:

```text
Showing high-protein options
[Protein >= 25g] [Open now] [Nearby]

Best matches
- Grilled Chicken Rice
  42g protein, 4.6 rating, 1.2 km away

Follow up:
[Cheaper] [Nearer] [More chicken] [Under 50000]
```

Example for `highly rated food nearby`:

```text
Showing nearby food from highly rated restaurants
[Rating >= 4.3] [Review count >= 3] [Within 5 km]
```

Example for `budget food`:

```text
Showing budget-friendly food
[Price <= 50000 VND] [Open now]
```

### Toggle Off Behavior

If the user toggles AI mode off while a query is present, immediately re-run classic search for the same text using `GET /api/search?q=...`.

### Fallback UX

If AI parsing fails:

- Keep the user's query.
- Show classic search results.
- Do not block the user behind an AI error.

The frontend can show a subtle state such as:

```text
Showing regular results
```

Avoid exposing provider-specific error messages to the customer.

---

## 6. Backend Architecture

Split the restaurant catalog search module into two explicit subfolders:

- `standard/`: the existing deterministic search implementation.
- `ai/`: the new AI search implementation.

The public API paths should stay stable. Moving the existing files into `standard/` is an internal organization change; `GET /api/search` should continue to work exactly as it does today.

Recommended structure:

```text
apps/api/src/module/restaurant-catalog/search/
+-- standard/
|   +-- search.controller.ts
|   +-- search.service.ts
|   +-- search.repository.ts
|   +-- search.dto.ts
+-- ai/
|   +-- ai-search.controller.ts
|   +-- ai-search.service.ts
|   +-- ai-search.repository.ts
|   +-- ai-search.dto.ts
|   +-- ai-search.types.ts
|   +-- ai-search-intent.service.ts
|   +-- ai-search-intent.schema.ts
|   +-- ai-search-prompt.ts
+-- search.module.ts
```

Responsibilities:

### `standard/`

Owns the current keyword/filter-based search stack:

- `SearchController`: exposes `GET /api/search`.
- `SearchService`: validates standard search inputs.
- `SearchRepository`: runs deterministic restaurant/menu item search.
- `search.dto.ts`: standard unified SERP response DTOs.

This folder should remain AI-free. It is the fallback path and the baseline behavior when the customer turns AI mode off.

### `ai/`

Owns the AI search stack:

- `AiSearchController`: exposes `POST /api/search/ai`.
- `AiSearchService`: coordinates intent extraction, fan-out retrieval, ranking, explanations, and fallback.
- `AiSearchRepository`: runs deterministic SQL queries needed by AI search.
- `AiSearchIntentService`: converts natural language into a strict validated search intent.
- `ai-search-intent.schema.ts`: Zod schema for model output validation.
- `ai-search-prompt.ts`: prompt constants and model instructions.

### `AiSearchController`

Expose the customer-facing endpoint.

Recommended endpoint:

```http
POST /api/search/ai
```

Use `POST` instead of `GET` because the request will eventually carry structured context such as user location, selected filters, and follow-up state.

### `AiSearchService`

Orchestrate the flow:

1. Validate request.
2. Call intent extraction.
3. Build retrieval branches.
4. Run database queries.
5. Merge and rank results.
6. Build explanation and follow-up chips.
7. Fallback to classic search when needed.

### `AiSearchIntentService`

Call the LLM and return a strict structured intent object.

The LLM must not query the database, calculate final ranking, or create final cards. It only converts text into a plan.

### `AiSearchRepository`

Run deterministic SQL queries against restaurants, menu items, ratings, prices, tags, geo fields, and menu item nutrition.

### `AiSearchAnswerService` - Optional

For MVP, avoid a second LLM call. Generate simple templated summaries from the structured intent and returned rows.

Example:

```text
Showing budget-friendly options under 50000 VND near your delivery address.
```

Only add an AI answer-generation service later if needed, and pass only retrieved result rows to it.

---

## 7. API Design

### Request

```http
POST /api/search/ai
Content-Type: application/json
```

```json
{
  "query": "high protein food nearby",
  "lat": 10.762622,
  "lon": 106.660172,
  "radiusKm": 5,
  "offset": 0,
  "limit": 20
}
```

### Response

```json
{
  "mode": "ai",
  "query": "high protein food nearby",
  "interpretation": "Showing nearby high-protein food options.",
  "appliedFilters": [
    {
      "key": "proteinMinG",
      "label": "Protein >= 25g",
      "source": "ai_inferred"
    },
    {
      "key": "radiusKm",
      "label": "Within 5 km",
      "source": "request"
    }
  ],
  "items": [
    {
      "id": "menu-item-id",
      "name": "Grilled Chicken Rice",
      "price": 65000,
      "imageUrl": "https://cdn.example.com/item.jpg",
      "categoryName": "Rice",
      "score": 87,
      "matchReasons": ["42g protein", "1.2 km away", "4.6 rating"],
      "restaurant": {
        "id": "restaurant-id",
        "name": "Healthy Bowl",
        "address": "District 1",
        "averageRating": 4.6,
        "reviewCount": 42,
        "distanceKm": 1.2
      }
    }
  ],
  "restaurants": [],
  "total": {
    "restaurants": 0,
    "items": 14
  },
  "followUps": [
    {
      "label": "Cheaper",
      "query": "high protein food under 50000 nearby"
    },
    {
      "label": "Nearer",
      "query": "high protein food within 2 km"
    }
  ],
  "fallback": null
}
```

### Fallback Response

```json
{
  "mode": "classic_fallback",
  "query": "high protein food",
  "interpretation": "Showing regular search results.",
  "appliedFilters": [],
  "items": [],
  "restaurants": [],
  "total": {
    "restaurants": 0,
    "items": 0
  },
  "followUps": [],
  "fallback": {
    "reason": "AI_SEARCH_UNAVAILABLE"
  }
}
```

---

## 8. Intent Extraction

The intent schema should be strict and locally validated with Zod.

Recommended shape:

```ts
type AiSearchIntent = {
  rewrittenQuery: string;
  language: 'en' | 'vi' | 'unknown';
  foodTerms: string[];
  cuisineTerms: string[];
  dietaryTags: string[];
  excludedTerms: string[];
  nutrition: {
    highProtein?: boolean;
    proteinMinG?: number;
    caloriesMax?: number;
    fatMaxG?: number;
    carbsMaxG?: number;
  };
  price: {
    maxPriceVnd?: number;
    minPriceVnd?: number;
    budgetIntent?: boolean;
  };
  rating: {
    minAverageRating?: number;
    minReviewCount?: number;
  };
  geo: {
    nearbyIntent?: boolean;
    radiusKm?: number;
  };
  sort: 'relevance' | 'distance' | 'rating' | 'price_asc' | 'protein_desc';
  confidence: number;
  needsFallback: boolean;
};
```

Prompt rules:

```text
- Convert the customer food search into structured filters.
- Do not invent restaurant names or menu items.
- Do not make medical claims.
- Use null/empty arrays when the query does not specify a constraint.
- If the query says "budget", use maxPriceVnd = 50000 unless a specific amount is provided.
- If the query says "high protein", use proteinMinG = 25 unless a specific amount is provided.
- If the query says "highly rated", use minAverageRating = 4.3 and minReviewCount = 3.
- If the query says "nearby", use radiusKm from the request, defaulting to 5.
- Return JSON only.
```

The defaults above are product defaults and should be easy to change in constants.

Recommended constants:

```ts
const AI_SEARCH_DEFAULT_BUDGET_MAX_VND = 50_000;
const AI_SEARCH_DEFAULT_HIGH_PROTEIN_MIN_G = 25;
const AI_SEARCH_DEFAULT_HIGH_RATING_MIN = 4.3;
const AI_SEARCH_DEFAULT_MIN_REVIEW_COUNT = 3;
const AI_SEARCH_DEFAULT_RADIUS_KM = 5;
const AI_SEARCH_MIN_CONFIDENCE = 0.65;
```

---

## 9. Query Fan-Out for UITFood

Google AI Mode uses query fan-out across subtopics and data sources. Adapt that pattern to the food catalog.

For one user query, run multiple retrieval branches concurrently:

```text
User query: "highly rated budget chicken nearby"

Branch A: lexical food search
  q = chicken

Branch B: budget item search
  price <= 50000

Branch C: rating search
  restaurant.averageRating >= 4.3
  restaurant.reviewCount >= 3

Branch D: geo search
  lat/lon within radius

Branch E: tag/category search
  tags/categories/cuisine related to chicken
```

Merge results by item id and restaurant id, then score each candidate.

This gives AI mode breadth without requiring a vector database for MVP.

---

## 10. Ranking

Use deterministic ranking. The model should not decide the final order.

Example item score:

```text
score =
  lexicalMatchScore
  + nutritionScore
  + ratingScore
  + priceScore
  + distanceScore
  + availabilityScore
  + reviewConfidenceScore
```

Suggested weights:

```ts
const AI_ITEM_SCORE = {
  exactNameMatch: 25,
  partialNameMatch: 15,
  tagMatch: 10,
  categoryMatch: 8,
  cuisineMatch: 6,
  highProteinMatch: 18,
  budgetMatch: 14,
  highlyRatedMatch: 14,
  nearbyMatch: 12,
  openNow: 8,
};
```

Ranking examples:

- `high protein food`: prioritize `protein >= 25g`, then lexical relevance, rating, distance.
- `highly rated food nearby`: prioritize rating and review count, then distance.
- `budget food`: prioritize items under budget, then rating, then distance.
- `spicy noodles under 50000`: prioritize lexical/tag/category match and price cap.

Each returned item should include `matchReasons` generated from facts:

```text
42g protein
Under 50000 VND
4.6 rating
1.2 km away
Open now
```

Do not include reasons that are not backed by database fields.

---

## 11. Data Requirements

### Existing Data

The current system already has:

- Menu item name, description, price, category, tags, image.
- Restaurant name, cuisine, description, location, open status.
- Restaurant average rating, rating sum, review count.
- Menu item nutrition on detail APIs.

### Needed for Strong AI Search

AI search should join or project nutrition into search results:

- `menu_item_nutrition.protein`
- `menu_item_nutrition.calories`
- `menu_item_nutrition.carbs`
- `menu_item_nutrition.fat`
- `menu_item_nutrition.verified_by_restaurant`

If nutrition is missing:

- Do not claim the item is high protein.
- Allow lexical fallback only if the query includes food words.
- Optionally show a lower-confidence match reason such as `Nutrition not available` only in internal/debug UI, not customer-facing cards.

### Recommended Indexes

Add indexes if they do not already exist:

```sql
CREATE INDEX IF NOT EXISTS menu_items_price_idx
  ON menu_items (price);

CREATE INDEX IF NOT EXISTS restaurants_rating_idx
  ON restaurants (average_rating, review_count);

CREATE INDEX IF NOT EXISTS menu_item_nutrition_protein_idx
  ON menu_item_nutrition (protein);

CREATE INDEX IF NOT EXISTS menu_item_nutrition_calories_idx
  ON menu_item_nutrition (calories);
```

Use actual column/table names from the Drizzle schema when implementing.

---

## 12. Suggested Database Tables for Analytics

Do not block MVP on these, but add them early if possible.

### `ai_search_sessions`

Purpose: debug quality, latency, and fallbacks.

Columns:

```text
id
user_id nullable
raw_query
normalized_query
intent_json jsonb
lat_bucket nullable
lon_bucket nullable
result_count_items
result_count_restaurants
fallback_reason nullable
latency_ms
created_at
```

Store coarse location buckets only. Do not store exact coordinates unless there is a clear operational need.

### `ai_search_feedback`

Purpose: collect thumbs up/down and selected result.

Columns:

```text
id
search_session_id
user_id nullable
feedback enum('up', 'down')
selected_item_id nullable
selected_restaurant_id nullable
created_at
```

---

## 13. AI Provider Strategy

Use the backend only. Never call the AI provider directly from the mobile app.

Recommended MVP:

- Reuse the existing Ollama Cloud integration style.
- Add AI search-specific env vars so this feature can be enabled/disabled separately from nutrition.

Suggested env vars:

```env
AI_SEARCH_ENABLED=false
AI_SEARCH_MODEL=gpt-oss:20b
AI_SEARCH_TIMEOUT_MS=8000
AI_SEARCH_MIN_CONFIDENCE=0.65
AI_SEARCH_DAILY_LIMIT_PER_USER=100
```

Implementation options:

1. Reuse `OLLAMA_API_KEY` and the existing Ollama runtime config.
2. Later extract a shared `AiProviderModule` if nutrition and AI search start duplicating code.

For local development, implement a deterministic intent parser fallback so core examples work even without an AI key:

```text
"high protein" -> proteinMinG = 25
"budget" or "cheap" -> maxPriceVnd = 50000
"highly rated" or "best rated" -> minAverageRating = 4.3
"nearby" or "near me" -> nearbyIntent = true
```

This fallback also makes tests stable.

---

## 14. Mobile Implementation

### Types

Add AI search response types near:

```text
apps/mobile/src/features/restaurants/types/index.ts
```

Suggested types:

```ts
export interface AiSearchAppliedFilter {
  key: string;
  label: string;
  source: 'request' | 'ai_inferred' | 'system_default';
}

export interface AiSearchFollowUp {
  label: string;
  query: string;
}

export interface AiSearchItemResult extends SearchItemResult {
  matchReasons: string[];
}

export interface AiSearchResponse {
  mode: 'ai' | 'classic_fallback';
  query: string;
  interpretation: string;
  appliedFilters: AiSearchAppliedFilter[];
  restaurants: RestaurantSearchResult[];
  items: AiSearchItemResult[];
  total: UnifiedSearchTotals;
  followUps: AiSearchFollowUp[];
  fallback: null | {
    reason: string;
  };
}
```

### API Hook

Add to:

```text
apps/mobile/src/features/restaurants/api/restaurant-api.ts
```

Recommended hook:

```ts
export function useAiSearch(params: AiSearchParams) {
  return useQuery({
    queryKey: restaurantKeys.aiSearch(params),
    queryFn: () =>
      apiFetch<AiSearchResponse>('/api/search/ai', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    enabled: params.query.trim().length > 0 && params.enabled,
  });
}
```

The current `apiFetch` signature may need a small extension if it only supports GET today.

### Toggle State

Create one of:

```text
apps/mobile/src/features/restaurants/store/search-mode-store.ts
```

or add to an existing UI/search store:

```ts
type SearchMode = 'classic' | 'ai';
```

Persist with AsyncStorage so the user's preference survives app restarts.

### Home Screen Flow

Update:

```text
apps/mobile/src/features/restaurants/screen/home-screen.tsx
```

Flow:

```text
search mode = classic
  -> useUnifiedSearch
  -> HomeSearchResults

search mode = ai
  -> useAiSearch
  -> HomeAiSearchResults
```

### Components

Update or add:

```text
apps/mobile/src/features/restaurants/components/home/home-search-bar.tsx
apps/mobile/src/features/restaurants/components/home/home-ai-search-results.tsx
```

`HomeSearchBar` should accept:

```ts
mode: 'classic' | 'ai';
onToggleMode: () => void;
```

`HomeAiSearchResults` should render:

- Interpretation text.
- Applied filter chips.
- AI item cards with match reasons.
- Restaurant cards.
- Follow-up chips.
- Loading and error/fallback states.

Keep navigation handlers unchanged:

- Menu item card -> `/restaurant/menu-item/[id]`
- Restaurant card -> `/restaurant/[id]`

---

## 15. Backend Implementation Steps

### Phase 1: Deterministic AI Search Without LLM

Goal: prove the product behavior and database queries before adding model latency.

Tasks:

1. Add `POST /api/search/ai`.
2. Add request/response DTOs.
3. Implement rule-based intent parsing for:
   - `high protein`
   - `highly rated`
   - `nearby`
   - `budget`
   - explicit `under <amount>`
4. Implement `AiSearchRepository`.
5. Return `matchReasons`.
6. Add tests for the example queries.

This phase should work with `AI_SEARCH_ENABLED=false`.

### Phase 2: Database Query Expansion

Add filters and joins for:

- Price caps.
- Rating thresholds.
- Review count threshold.
- Nutrition thresholds.
- Distance and open status.
- Tags/categories/cuisine terms.

Keep the existing `SearchRepository` untouched unless shared helpers are clearly useful.

### Phase 3: LLM Intent Extraction

Add:

- `AiSearchIntentService`
- `ai-search-intent.schema.ts`
- Prompt constants
- Timeout
- Retry once
- Confidence threshold

If the LLM fails validation, use the deterministic parser.

### Phase 4: Mobile Toggle and Result UI

Add:

- Search mode state.
- AI toggle in `HomeSearchBar`.
- `useAiSearch`.
- `HomeAiSearchResults`.
- Follow-up chip behavior.

### Phase 5: Observability and Feedback

Track:

- Query text length, not full prompt in logs.
- AI parse latency.
- DB retrieval latency.
- End-to-end endpoint latency.
- Fallback reason.
- Result count.
- Result selected.
- Zero-result rate.

Use existing Sentry/mobile observability and API logs.

---

## 16. Security, Privacy, and Safety

Rules:

- Do not expose AI provider credentials to mobile.
- Do not send exact user location to the LLM. Use location only in backend SQL.
- Do not send user identity to the LLM.
- Rate-limit AI search per user/IP.
- Add request length limits, for example 300 characters.
- Treat the user query as untrusted text.
- Do not log raw provider responses in production.
- Use timeouts and fallback to classic search.
- Do not make medical claims.
- Do not classify food as safe for a disease or medical condition.
- For allergens/dietary claims, use explicit item tags or verified nutrition data only.

Prompt injection note:

The customer query may contain instructions like "ignore previous instructions". This should not matter because the model only returns a schema, and the backend validates every field. Never let model output choose SQL fragments directly.

---

## 17. Testing Strategy

### Backend Unit Tests

Test intent parsing:

```text
high protein food -> proteinMinG = 25
highly rated food nearby -> rating + review count + geo
budget food -> maxPriceVnd = 50000
under 30000 -> maxPriceVnd = 30000
spicy noodles under 50000 -> foodTerms + price cap
```

Test ranking:

```text
high protein ranks higher protein items first
budget excludes items above max price
highly rated requires min review count
nearby ranks closer items higher when all else is equal
```

Test safety:

```text
LLM invalid JSON falls back
LLM timeout falls back
low confidence falls back
missing lat/lon with nearby intent does not crash
```

### Backend E2E Tests

Add tests for:

```text
POST /api/search/ai
POST /api/search/ai with no coordinates
POST /api/search/ai when AI disabled
POST /api/search/ai with budget query
POST /api/search/ai with high protein query
```

Mock the AI service. Do not call the real provider in test runs.

### Mobile Tests

At minimum:

```text
toggle AI mode changes hook path
classic mode still calls useUnifiedSearch
AI mode renders applied filters
follow-up chip updates query
fallback response renders regular results
```

---

## 18. Acceptance Criteria

The feature is MVP-ready when:

- Customer can toggle AI search on/off.
- Toggle preference persists across app restart.
- Classic search behavior remains unchanged when AI mode is off.
- AI mode supports the three required examples:
  - `high protein food`
  - `highly rated food nearby`
  - `budget food`
- AI mode returns real menu items/restaurants only.
- Each AI result has factual match reasons.
- The API falls back to classic search on AI failure.
- No AI provider key is shipped to mobile.
- Tests cover parsing, ranking, fallback, and mobile mode switching.

---

## 19. Open Product Decisions

Decide before implementation:

1. Budget default: is `50000 VND` the right default for "budget food"?
2. High-protein default: should it be `25g` per serving or another threshold?
3. Minimum review count: should highly rated require at least `3`, `5`, or `10` reviews?
4. Missing nutrition: should high-protein queries hide items without nutrition or show them lower?
5. AI mode default: should new users start with AI mode off or on?

Recommended MVP answers:

```text
Budget default: 50000 VND
High protein: 25g per serving
Highly rated: averageRating >= 4.3 and reviewCount >= 3
Missing nutrition: hide from high-protein result set
AI mode default: off
```

---

## 20. Final Architecture Summary

```text
Customer search box
  |
  | classic mode
  v
GET /api/search
  |
  v
Existing unified search results

Customer search box
  |
  | AI mode
  v
POST /api/search/ai
  |
  v
AiSearchService
  |
  +--> AiSearchIntentService
  |      |
  |      +--> LLM structured intent, or deterministic fallback
  |
  +--> AiSearchRepository
  |      |
  |      +--> menu items, restaurants, ratings, nutrition, price, geo
  |
  +--> deterministic ranking and match reasons
  |
  v
AI search response with real cards, filters, and follow-ups
```

This keeps AI as a search planner and explanation helper. The source of truth remains the UITFood database.
