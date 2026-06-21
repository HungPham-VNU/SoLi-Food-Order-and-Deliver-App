To make your MVP production-grade, do **not** simply “add RAG.” Your current plan is already a good foundation: **LLM intent extraction → query fan-out → deterministic DB retrieval/ranking → grounded result cards** . To reach an industry-standard AI search experience, upgrade it into a **hybrid retrieval + ranking + grounded answer system**.

Google’s AI Mode is a useful reference because it uses **query fan-out**: it breaks a user query into subtopics and issues multiple related searches across data sources before merging the response. ([blog.google][1])

## Target architecture

```text
User query
  |
  v
Query understanding layer
  - intent extraction
  - query rewriting
  - language detection
  - safety classification
  - personalization context
  |
  v
Query fan-out planner
  - lexical search branch
  - semantic vector branch
  - SQL filter branch
  - geo branch
  - nutrition branch
  - restaurant quality branch
  - popularity/history branch
  |
  v
Candidate retrieval
  - PostgreSQL / SQL
  - full-text search
  - vector search
  - geo search
  - cache
  |
  v
Candidate merging + deduplication
  |
  v
Ranking pipeline
  - hard filters
  - business rules
  - ML/heuristic ranking
  - personalization
  - freshness/availability
  |
  v
Grounded answer generation
  - only summarize retrieved rows
  - cite/explain with factual fields
  |
  v
Search results UI
  - food cards
  - restaurant cards
  - explanation
  - filter chips
  - follow-up chips
```

## 1. Upgrade from SQL-only retrieval to hybrid retrieval

Your MVP mostly uses structured SQL filters. Production search should combine several retrieval strategies.

### A. Lexical search

Use this for exact or near-exact matches:

```text
"banh mi"
"chicken rice"
"pizza"
"phở bò"
```

Implementation options:

```text
PostgreSQL full-text search
PostgreSQL trigram search
Meilisearch
Typesense
OpenSearch / Elasticsearch
```

For your current scale, I would start with **PostgreSQL full-text + trigram** before adding a separate search engine.

### B. Semantic search

Add embeddings for:

```text
menu item name
description
tags
category
cuisine
restaurant description
nutrition summary
```

This lets queries like these work better:

```text
"food for bulking"
"light dinner"
"cheat meal"
"something healthy but cheap"
"comfort food"
```

These may not match exact keywords, but they have semantic meaning.

Recommended starting stack:

```text
PostgreSQL + pgvector
embedding model: multilingual embedding model
```

Because your app may support Vietnamese, English, and other languages, choose a **multilingual embedding model**, not English-only.

### C. Structured SQL retrieval

Keep SQL for hard facts:

```text
price <= 50000
protein >= 25g
rating >= 4.3
distance <= 5km
restaurant is open
verified nutrition = true
```

This is important because embeddings are bad at exact constraints.

### D. Geo retrieval

Use PostGIS or equivalent geo queries for:

```text
near me
within 2km
near campus
fast delivery
```

Do not send exact user coordinates to the LLM. Let the backend handle location.

## 2. Make query fan-out more advanced

Your MVP fan-out is good but too static. Production-grade fan-out should generate multiple retrieval plans.

Example query:

```text
healthy cheap chicken near me
```

Fan-out branches:

```text
Branch 1: lexical
q = chicken

Branch 2: semantic
embedding("healthy cheap chicken meal")

Branch 3: nutrition
protein >= 25g OR calories <= threshold

Branch 4: price
price <= 50000

Branch 5: geo
distance <= radiusKm

Branch 6: restaurant quality
rating >= 4.3 AND reviewCount >= 3

Branch 7: availability
restaurant open now
```

Then merge candidates by `menuItemId` and `restaurantId`.

The important production improvement is that the fan-out planner should not be just a few if-statements. It should produce a structured plan like:

```ts
type RetrievalPlan = {
  lexicalQueries: string[];
  semanticQueries: string[];
  sqlFilters: {
    maxPriceVnd?: number;
    minProteinG?: number;
    maxCalories?: number;
    minRating?: number;
    openNow?: boolean;
  };
  geoFilter?: {
    lat: number;
    lon: number;
    radiusKm: number;
  };
  sortIntent: 'relevance' | 'distance' | 'rating' | 'price' | 'protein';
};
```

## 3. Add a real ranking pipeline

Do not let the LLM rank results. Production systems usually separate retrieval from ranking.

A better ranking pipeline:

```text
Step 1: Hard filter
Remove items that violate strict constraints.

Step 2: Candidate scoring
Score candidates from lexical, semantic, SQL, geo, rating, price, nutrition.

Step 3: Business ranking
Boost open restaurants, available items, verified nutrition, good ratings.

Step 4: Personalization
Boost cuisines/categories the user often orders.

Step 5: Diversity
Avoid returning 10 items from the same restaurant.

Step 6: Final rerank
Return the best balanced list.
```

Example score:

```ts
score =
  lexicalScore * 0.2 +
  semanticScore * 0.2 +
  nutritionScore * 0.15 +
  priceScore * 0.15 +
  distanceScore * 0.1 +
  ratingScore * 0.1 +
  availabilityScore * 0.05 +
  personalizationScore * 0.05;
```

Later, if you have enough data, replace manual weights with a **learning-to-rank model** trained from:

```text
impressions
clicks
add-to-cart events
orders
reorders
thumbs up/down
query reformulations
```

## 4. Add grounded answer generation

For MVP, templated summaries are fine. For production, you can add a second LLM step, but only after retrieval.

Good flow:

```text
Retrieved rows -> compact evidence object -> LLM summary
```

Example evidence object:

```json
{
  "query": "high protein food nearby",
  "topItems": [
    {
      "name": "Grilled Chicken Rice",
      "protein": 42,
      "price": 65000,
      "rating": 4.6,
      "distanceKm": 1.2,
      "restaurantName": "Healthy Bowl"
    }
  ]
}
```

The LLM may write:

```text
I found nearby high-protein meals. The best match is Grilled Chicken Rice with 42g protein, a 4.6 rating, and it is 1.2km away.
```

But it must not invent anything outside the evidence object.

## 5. Add citations/explanations for every result

For food search, “citations” are not web links. They are factual match reasons from your database.

Example:

```text
Grilled Chicken Rice
Why this matches:
- 42g protein
- 1.2km away
- 4.6 rating from 42 reviews
- Open now
```

This is essential for trust.

Avoid vague AI explanations like:

```text
This seems like a healthy choice.
```

Use database-backed explanations:

```text
42g protein
530 calories
Verified by restaurant
Under 50000 VND
```

## 6. Add multilingual support properly

Since restaurants may use Vietnamese, English, Japanese, etc., production search should support multilingual queries.

Use three layers:

```text
1. LLM intent extraction
   "đồ ăn nhiều đạm" -> highProtein = true

2. Multilingual embeddings
   "healthy chicken meal" can match Vietnamese menu descriptions.

3. Dictionary/synonym normalization
   gà -> chicken
   bò -> beef
   cơm -> rice
   bún/mì/phở -> noodle-like categories
```

Do not rely only on translation. Translation can lose food-specific meaning.

Recommended normalized fields:

```text
originalName
normalizedName
language
translatedNameForSearch
tags
cuisineType
embeddingText
```

## 7. Add personalization, but carefully

Google-style AI search often feels better because it uses context. For UITFood, useful context could be:

```text
user location
past orders
favorite cuisines
average budget
dietary preferences
blocked ingredients
frequent restaurants
```

But make it transparent and controllable.

Example:

```text
Because you often order rice dishes, I prioritized chicken rice options.
```

Do not personalize sensitive health claims unless the user explicitly sets dietary preferences.

## 8. Add production safety rules

For food, the risky areas are:

```text
allergies
medical diets
weight loss
diabetes
pregnancy
religious dietary claims
food safety
```

Rules:

```text
Do not say “safe for diabetes” unless verified by a proper source.
Do not say “allergen-free” unless restaurant-provided allergen metadata exists.
Do not infer halal/vegan/gluten-free from name alone.
Do not make medical recommendations.
For health-related queries, show factual nutrition filters only.
```

Example safe response:

```text
Showing lower-calorie options based on available nutrition data. This is not medical advice.
```

## 9. Add observability and evaluation

Production AI search needs measurement. Without this, you cannot know whether it is better than classic search.

Track:

```text
query
language
intent
retrieval branches used
LLM latency
DB latency
total latency
fallback reason
result count
zero-result rate
click-through rate
add-to-cart rate
order conversion rate
query reformulation rate
thumbs up/down
```

Create an evaluation dataset:

```text
100 common user queries
expected intent
expected filters
expected good results
bad results to avoid
```

Example:

```text
Query: "cheap chicken near me"
Expected:
- chicken-related items
- price <= 50000 if possible
- nearby restaurants
- open restaurants boosted
```

Run this eval every time you change:

```text
prompt
model
ranking weights
embedding model
search index
```

## 10. Add reliability controls

Production AI search should degrade gracefully.

Use:

```text
LLM timeout
retry once
circuit breaker
rate limit
daily quota
cache common query plans
fallback to deterministic parser
fallback to classic search
```

Suggested latency budget:

```text
Intent extraction: 500ms - 1500ms
Retrieval: 100ms - 500ms
Ranking: <100ms
Answer generation: optional, 500ms - 1500ms
Total target: under 2-3 seconds
```

For mobile UX, show partial results as soon as possible if answer generation is slow.

## 11. Recommended production architecture for your stack

Given your current app uses NestJS, PostgreSQL, Drizzle, React Native, and Ollama-style AI integration, a realistic production-grade version would be:

```text
NestJS API
  |
  +-- AiSearchController
  +-- AiSearchOrchestratorService
  +-- IntentExtractionService
  +-- QueryFanoutService
  +-- HybridRetrievalService
  +-- SearchRankingService
  +-- GroundedAnswerService
  +-- SearchAnalyticsService

PostgreSQL
  |
  +-- menu_items
  +-- restaurants
  +-- nutrition
  +-- reviews
  +-- tags
  +-- search_embeddings via pgvector
  +-- ai_search_sessions
  +-- ai_search_feedback

Redis
  |
  +-- cached intent plans
  +-- cached search results
  +-- rate limiting

Background worker
  |
  +-- generate embeddings
  +-- update search index
  +-- aggregate popularity signals
```

## 12. Suggested roadmap

### Phase 1: Strong MVP

Keep your current plan:

```text
LLM intent extraction
SQL query fan-out
deterministic ranking
fallback to classic search
match reasons
```

### Phase 2: Hybrid retrieval

Add:

```text
Postgres full-text search
trigram search
pgvector semantic search
multilingual embeddings
```

### Phase 3: Production ranking

Add:

```text
better score normalization
deduplication
diversity ranking
personalization
popularity signals
availability boost
```

### Phase 4: Grounded AI answer

Add:

```text
LLM result summary
follow-up query generation
evidence-only prompting
hallucination checks
```

### Phase 5: Search quality platform

Add:

```text
offline evals
A/B testing
query analytics
feedback loop
ranking experiments
prompt/model versioning
```

## Best final definition

Your production feature should become:

```text
A hybrid AI search system that uses an LLM as a query planner, retrieves candidates through lexical, semantic, structured, and geo search, ranks results deterministically or with learning-to-rank, and generates grounded explanations only from retrieved catalog data.
```

[1]: https://blog.google/products-and-platforms/products/search/google-search-ai-mode-update/?utm_source=chatgpt.com 'AI in Search: Going beyond information to intelligence'
