# Production-Grade AI Semantic Search Architecture

## 1. Overview

The goal is to implement a robust AI-powered search feature (e.g., "high protein food", "cheat meal food", "highly rated restaurant near me") in the customer mobile app.

Since the project already uses PostgreSQL, Drizzle ORM, and has a foundation for `pgvector` (as seen in `0003_vector_search.sql` and the Drizzle schemas), the most robust approach is **Vector Similarity Search (Semantic Search)**.

## 2. Core Architecture

### Components

1. **Embedding Model**: A 768-dimensional text embedding model (e.g., `nomic-embed-text` via Ollama, or an equivalent OpenAI model).
2. **Database (pgvector)**: The `menu_items` and `restaurants` tables already have an `embedding` column of type `vector(768)` and HNSW indexes.
3. **Write Path (Background Job)**: NestJS CQRS Event Handlers to asynchronously generate and update embeddings without blocking user mutations.
4. **Read Path (Search API)**: A new endpoint that vectorizes the user's query and performs a similarity search (`<=>`) in PostgreSQL.

---

## 3. The Write Path: Data Ingestion & Synchronization

We must not generate embeddings synchronously during standard CRUD operations, as LLM calls introduce latency and potential failure points.

### Workflow:

1. **Trigger**: A restaurant updates a menu item (e.g., name, tags, or AI nutrition is saved).
2. **Event**: The service emits a CQRS event: `MenuItemUpdatedEvent`.
3. **Handler**: `SyncSearchDocumentHandler` catches the event in the background.
4. **Document Construction**: The handler builds a rich textual representation of the item.
   - _Example_: `"Name: Cơm gà nướng. Description: Cơm gà sốt teriyaki đậm vị. Tags: gà, cơm. Nutrition: 660 calories, 55g protein, 45g carbs. Status: available."\*
5. **Embedding Generation**: The handler calls the Vercel AI SDK (`embed` function) to get the 768-float vector.
6. **Database Update**: The handler updates the `search_document` and `embedding` fields in the `menu_items` table.

---

## 4. The Read Path: Semantic Search Execution

When the customer uses the AI search bar:

1. **Query Vectorization**: The user types _"high protein food"_. The backend API converts this exact string into a 768-dimensional vector using the same embedding model.
2. **Vector Search Query**: The backend queries the database using pgvector's cosine distance operator (`<=>`).

### Drizzle Query Example:

```typescript
import { cosineDistance, desc, sql, and, eq } from 'drizzle-orm';

// Vectorize the user's query
const queryEmbedding = await aiService.generateEmbedding(query);

// Perform semantic search
const results = await db
  .select({
    id: menuItems.id,
    name: menuItems.name,
    restaurantId: menuItems.restaurantId,
    similarity: sql<number>`1 - (${cosineDistance(menuItems.embedding, queryEmbedding)})`,
  })
  .from(menuItems)
  .where(
    and(
      eq(menuItems.status, 'available'),
      // Pre-filtering: Only search within delivery zone / open restaurants
      sql`${cosineDistance(menuItems.embedding, queryEmbedding)} < 0.5`, // Similarity threshold
    ),
  )
  .orderBy(cosineDistance(menuItems.embedding, queryEmbedding))
  .limit(20);
```

---

## 5. Handling Complex AI Queries ("Near me", "Highly rated")

Semantic search is great for "high protein", but bad for "near me" or "highly rated" because embeddings don't understand math or geofences well.

**Solution: Hybrid AI Search (Query Understanding)**
Before vectorizing the query, we can use a fast LLM (e.g., `llama3.1` or `gpt-4o-mini`) as a router/parser to extract intents:

1. User Query: _"Highly rated high protein chicken near me"_
2. LLM Intent Extraction (Structured Output):
   ```json
   {
     "semanticQuery": "high protein chicken",
     "filters": {
       "minRating": 4.5,
       "location": "NEARBY"
     }
   }
   ```
3. Execution:
   - Vectorize `"high protein chicken"`.
   - Add SQL `WHERE` clauses for `average_rating >= 4.5` and geospatial constraints.

---

## 6. Implementation Steps

### Phase 1: Backend Infrastructure (NestJS)

1. Implement `AiSearchService` using Vercel AI SDK (`embed` and `generateObject`).
2. Implement CQRS Event Handlers (`MenuItemUpdatedHandler`, `RestaurantUpdatedHandler`) to maintain the embeddings in the background.
3. Create the `GET /search/semantic` endpoint with Hybrid Query Understanding and pgvector queries.

### Phase 2: Frontend Integration (Expo Mobile App)

1. Add an "AI Search" toggle or floating action button on the home screen.
2. Build the AI Search results screen (showing both matched restaurants and specific menu items).
3. Connect to the new endpoint using React Query (`useQuery`).
