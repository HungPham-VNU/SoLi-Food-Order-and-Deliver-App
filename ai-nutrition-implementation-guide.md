# High-Level Implementation Guide: AI Recipe Nutrition Assistant

## 1. Goal

Implement an MVP AI feature for restaurant users.

Restaurants can write a recipe in text form. The system uses an LLM to extract structured ingredient data, lets the restaurant review and correct the result, matches ingredients with a nutrition database, calculates nutrition values, and saves the final nutrition information to a menu item.

This version does **not** support image upload yet.

---

## 2. Tech Stack

Current project stack:

- Backend: NestJS with TypeScript
- Database: PostgreSQL
- ORM: Drizzle ORM
- LLM runtime: Ollama
- AI SDK: Vercel AI SDK (`ai@^4`)
- Input type: Text recipe only

Recommended LLM integration:

- Use Ollama as an OpenAI-compatible local provider.
- Use Vercel AI SDK v4 for calling the model.
- Use structured output with a schema to force the LLM to return predictable JSON.

---

## 3. Core Principle

The LLM should **not** directly calculate calories.

The LLM should only:

- understand the recipe text;
- extract ingredients;
- extract quantities and units;
- detect missing data;
- normalize ingredient names;
- produce warnings.

The backend should:

- validate the LLM output;
- match ingredients with the nutrition database;
- convert units where possible;
- calculate calories, protein, carbs, fat;
- save the result after restaurant confirmation.

Main rule:

```
AI extracts.
Backend validates.
Restaurant confirms.
System calculates.
```

---

## 4. User Flow

### Step 1: Restaurant enters recipe text

Example input:

```
Cơm gà sốt teriyaki

Nguyên liệu:
- 500g ức gà
- 300g cơm trắng
- 2 muỗng canh sốt teriyaki
- 1 muỗng canh dầu ăn
- 100g bắp cải
- Chia thành 2 phần
```

### Step 2: Backend sends recipe text to AI Extraction Service

The LLM extracts structured data.

Example output:

```json
{
  "recipeName": "Cơm gà sốt teriyaki",
  "servings": 2,
  "ingredients": [
    {
      "rawText": "500g ức gà",
      "name": "ức gà",
      "quantity": 500,
      "unit": "g",
      "preparation": null,
      "confidence": 0.96
    },
    {
      "rawText": "300g cơm trắng",
      "name": "cơm trắng",
      "quantity": 300,
      "unit": "g",
      "preparation": "cooked",
      "confidence": 0.94
    },
    {
      "rawText": "2 muỗng canh sốt teriyaki",
      "name": "sốt teriyaki",
      "quantity": 2,
      "unit": "tbsp",
      "preparation": null,
      "confidence": 0.88
    },
    {
      "rawText": "1 muỗng canh dầu ăn",
      "name": "dầu ăn",
      "quantity": 1,
      "unit": "tbsp",
      "preparation": null,
      "confidence": 0.9
    },
    {
      "rawText": "100g bắp cải",
      "name": "bắp cải",
      "quantity": 100,
      "unit": "g",
      "preparation": null,
      "confidence": 0.93
    }
  ],
  "warnings": []
}
```

### Step 3: Restaurant reviews extracted ingredients

The frontend should display a review table.

Example:

| Ingredient   | Quantity | Unit | Confidence | Needs Review |
| ------------ | -------: | ---- | ---------: | ------------ |
| ức gà        |      500 | g    |        96% | No           |
| cơm trắng    |      300 | g    |        94% | No           |
| sốt teriyaki |        2 | tbsp |        88% | Yes          |
| dầu ăn       |        1 | tbsp |        90% | Yes          |
| bắp cải      |      100 | g    |        93% | No           |

The restaurant can:

- edit ingredient name;
- edit quantity;
- edit unit;
- add missing ingredients;
- remove incorrect ingredients;
- set servings;
- confirm final input.

### Step 4: Backend matches ingredients with nutrition database

Example:

```
"ức gà"       -> nutrition_foods: chicken breast
"cơm trắng"   -> nutrition_foods: cooked white rice
"dầu ăn"      -> nutrition_foods: vegetable oil
"bắp cải"     -> nutrition_foods: cabbage
```

Use simple matching for MVP:

1. Exact match by `name_vi`
2. Exact match by alias
3. Case-insensitive partial match
4. Fuzzy search
5. If multiple candidates exist, return candidates to frontend for manual selection

Avoid relying on the LLM as the only source of truth for ingredient matching.

### Step 5: Backend calculates nutrition

Use values from `nutrition_foods`.

Formula:

```
ingredient_nutrition = quantity_in_grams / 100 * nutrition_per_100g
```

Then:

```
total_nutrition = sum(all ingredient nutrition)
per_serving_nutrition = total_nutrition / servings
```

### Step 6: Save nutrition result

After restaurant confirmation, save the final result to the menu item.

The customer can then see nutrition information on the menu item detail page.

---

## 5. Suggested Backend Modules

Create a `NutritionModule`.

Recommended structure:

```
src/modules/nutrition/
├── nutrition.module.ts
├── nutrition.controller.ts
├── nutrition.service.ts
├── ai/
│   ├── ai-recipe-extraction.service.ts
│   ├── ai-recipe.schema.ts
│   └── ollama.provider.ts
├── matching/
│   ├── ingredient-matching.service.ts
│   └── unit-conversion.service.ts
├── calculator/
│   └── nutrition-calculator.service.ts
├── dto/
│   ├── analyze-recipe.dto.ts
│   ├── calculate-nutrition.dto.ts
│   └── save-menu-item-nutrition.dto.ts
└── types/
    └── nutrition.types.ts
```

Responsibilities:

### `NutritionController`

Expose HTTP endpoints.

### `NutritionService`

Coordinate the full analysis flow. Aggregate and build review warnings after AI extraction. Determine the session status (`NEEDS_REVIEW` vs `ANALYZED`) based on validation rules.

### `AiRecipeExtractionService`

Call Ollama through Vercel AI SDK and return structured recipe data.

### `IngredientMatchingService`

Match extracted ingredients with `nutrition_foods`.

### `UnitConversionService`

Convert units like `tbsp`, `tsp`, `piece`, `ml`, `kg` into grams where possible.

### `NutritionCalculatorService`

Pure business logic. No AI call here.

### `ollama.provider.ts`

Define the Ollama connection as a **NestJS-injectable singleton provider**, not instantiated inline inside a service. Read `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_API_KEY` from environment variables via `ConfigService`, not from `process.env` directly, to ensure the config module is fully loaded before the provider is used.

---

## 6. API Design

### 6.1 Analyze recipe text

```http
POST /restaurant/menu-items/:menuItemId/nutrition/analyze-recipe
```

Purpose:

- Accept recipe text.
- Call AI extraction.
- Return structured ingredients with session ID.
- Do not save final nutrition yet.

Request body:

```json
{
  "recipeText": "Cơm gà sốt teriyaki\n- 500g ức gà\n- 300g cơm trắng\n- 1 muỗng canh dầu ăn\nChia 2 phần"
}
```

Response:

```json
{
  "analysisSessionId": "session_123",
  "recipeName": "Cơm gà sốt teriyaki",
  "servings": 2,
  "ingredients": [
    {
      "rawText": "500g ức gà",
      "name": "ức gà",
      "quantity": 500,
      "unit": "g",
      "confidence": 0.96,
      "requiresConfirmation": false
    },
    {
      "rawText": "1 muỗng canh dầu ăn",
      "name": "dầu ăn",
      "quantity": 1,
      "unit": "tbsp",
      "confidence": 0.9,
      "requiresConfirmation": true,
      "notes": ["1 tbsp of oil estimated as 13.5g. Restaurant should confirm."]
    }
  ],
  "warnings": ["Estimated unit conversions require restaurant confirmation."],
  "status": "NEEDS_REVIEW"
}
```

Possible `status` values in this response:

```
ANALYZED        — all fields complete, no confirmation needed
NEEDS_REVIEW    — some fields are missing or uncertain
FAILED          — AI could not extract a usable result
```

---

### 6.2 Calculate nutrition from confirmed ingredients

```http
POST /restaurant/menu-items/:menuItemId/nutrition/calculate
```

Purpose:

- Accept restaurant-confirmed ingredients.
- Link back to the original analysis session for audit.
- Match ingredients with nutrition database.
- Convert quantities to grams.
- Calculate nutrition.
- Return result for final review.

Request body:

```json
{
  "analysisSessionId": "session_123",
  "servings": 2,
  "ingredients": [
    {
      "name": "ức gà",
      "quantity": 500,
      "unit": "g"
    },
    {
      "name": "cơm trắng",
      "quantity": 300,
      "unit": "g"
    },
    {
      "name": "dầu ăn",
      "quantity": 1,
      "unit": "tbsp"
    }
  ]
}
```

Response:

```json
{
  "matchedIngredients": [
    {
      "inputName": "ức gà",
      "matchedFoodId": "food_chicken_breast",
      "matchedName": "Ức gà",
      "quantityGram": 500,
      "matchConfidence": 0.95,
      "requiresConfirmation": false
    }
  ],
  "nutrition": {
    "total": {
      "calories": 1320,
      "protein": 110,
      "carbs": 90,
      "fat": 42
    },
    "perServing": {
      "calories": 660,
      "protein": 55,
      "carbs": 45,
      "fat": 21
    }
  },
  "warnings": [
    "Nutrition values are estimates and may vary depending on actual ingredients and cooking method."
  ]
}
```

`analysisSessionId` is required. The backend must reject requests without it.

---

### 6.3 Save final nutrition to menu item

```http
PUT /restaurant/menu-items/:menuItemId/nutrition
```

Purpose:

- Save confirmed nutrition result.
- Mark it as restaurant-verified.

Request body:

```json
{
  "analysisSessionId": "session_123",
  "servings": 2,
  "nutrition": {
    "calories": 660,
    "protein": 55,
    "carbs": 45,
    "fat": 21,
    "fiber": null,
    "sugar": null,
    "sodium": null
  },
  "ingredients": [
    {
      "name": "ức gà",
      "quantityGram": 500,
      "matchedFoodId": "food_chicken_breast"
    }
  ],
  "verifiedByRestaurant": true
}
```

Response:

```json
{
  "success": true
}
```

The backend must reject requests where `verifiedByRestaurant` is not `true`.

---

### 6.4 Customer reads menu item nutrition

Update the existing menu item detail endpoint to include:

```json
{
  "nutrition": {
    "calories": 660,
    "protein": 55,
    "carbs": 45,
    "fat": 21,
    "source": "AI_ESTIMATED",
    "verifiedByRestaurant": true,
    "disclaimer": "Nutrition values are estimates based on the provided recipe and ingredient database. Actual values may vary depending on ingredients, portion size, and cooking method."
  }
}
```

---

## 7. Database Design with Drizzle ORM

Add the following tables.

### 7.1 `nutrition_foods`

Stores base nutrition data per 100g.

Columns:

```
id
name_vi
name_en
aliases         — PostgreSQL text array. Add a GIN index on this column.
category
state           — enum: raw | cooked | fried | boiled | grilled | unknown
calories_100g
protein_100g
carbs_100g
fat_100g
fiber_100g
sugar_100g
sodium_100g
created_at
updated_at
```

Notes:

- `aliases` must be a **PostgreSQL text array**, not JSONB. Add a **GIN index** on `aliases` to support efficient array containment queries.
- `state` should be a database enum.
- For MVP, seed 50–100 common Vietnamese ingredients.

Example seed entries:

```
ức gà, cơm trắng, gạo trắng, thịt bò, thịt heo, trứng gà,
dầu ăn, dầu olive, đường, muối, sốt mayonnaise, bắp cải,
xà lách, cà chua, dưa leo, bún, phở, mì spaghetti
```

---

### 7.2 `nutrition_analysis_sessions`

Stores AI extraction sessions for debugging and traceability.

Columns:

```
id
menu_item_id
restaurant_id
input_type          — text | image (image not used in MVP)
raw_recipe_text
ai_extracted_json   — JSONB
status
created_at
updated_at
```

Possible `status` values:

```
ANALYZED
NEEDS_REVIEW
CALCULATED
SAVED
FAILED
```

---

### 7.3 `nutrition_analysis_ingredients`

Stores extracted and corrected ingredient rows per session.

Columns:

```
id
analysis_session_id
raw_text
extracted_name
corrected_name          — populated when restaurant edits the name
quantity
unit
quantity_gram
matched_nutrition_food_id
confidence
requires_confirmation
notes                   — text array; stores unit estimation notes and warnings for this row
created_at
updated_at
```

---

### 7.4 `menu_item_nutrition`

Stores final nutrition values for a menu item.

Columns:

```
id
menu_item_id
servings
calories
protein
carbs
fat
fiber
sugar
sodium
source
verified_by_restaurant
created_at
updated_at
```

Possible `source` values:

```
AI_ESTIMATED
MANUALLY_ENTERED
VERIFIED_BY_RESTAURANT
```

---

## 8. LLM Integration with Ollama and Vercel AI SDK

### 8.1 Install dependencies

```bash
pnpm add ai@^4 @ai-sdk/openai-compatible zod
```

Pin `ai` to version 4 or later. The `Output.object` API used in the extraction service is only available in v4+.

### 8.2 Ollama setup

The local Ollama server should be running:

```bash
ollama serve
```

Pull a model. Recommended MVP models:

```bash
ollama pull qwen2.5:7b
```

or:

```bash
ollama pull llama3.1:8b
```

Avoid Qwen3 models for this use case. Qwen3 emits internal reasoning tokens by default, which can interfere with structured JSON output.

### 8.3 Environment variables

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_API_KEY=ollama
```

For Docker Compose where the backend runs in a container:

```env
# Host machine Ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1

# Or if Ollama is itself a Docker Compose service named "ollama"
OLLAMA_BASE_URL=http://ollama:11434/v1
```

Ollama local does not require a real API key, but the OpenAI-compatible client expects one to be present. Provide a placeholder value.

---

## 9. AI Extraction Schema

Define a strict Zod schema.

Key constraints:

- `unit` must be a **closed enum**, not a free string. Allowed values: `g`, `kg`, `ml`, `l`, `tbsp`, `tsp`, `piece`, `cup`, `unknown`.
- `preparation` must be a **closed enum**, not a free string. Allowed values: `raw`, `cooked`, `fried`, `boiled`, `grilled`, `steamed`, `unknown`.
- Both fields should fall back to `unknown` rather than `null` when the LLM is uncertain, so downstream services always receive a known value.

Using free strings for `unit` and `preparation` will break `UnitConversionService` and ingredient state-matching logic, since those services perform comparisons against known values.

Example field definitions (implementation details up to the coding agent):

```
recipeName    — string | null
servings      — positive number | null
ingredients   — array of:
    rawText       — string
    name          — string
    quantity      — number | null
    unit          — enum(g, kg, ml, l, tbsp, tsp, piece, cup, unknown) | null
    preparation   — enum(raw, cooked, fried, boiled, grilled, steamed, unknown) | null
    confidence    — number between 0 and 1
warnings      — string array
```

---

## 10. AI Extraction Service

The Ollama provider defined in `ollama.provider.ts` must be injected into `AiRecipeExtractionService` through NestJS DI, not instantiated inline inside the service class. This ensures the provider is a singleton and that environment variables are resolved through `ConfigService` at the right time.

High-level behavior:

```
Input:
  recipeText (max 5000 characters)

Process:
  call Ollama model through Vercel AI SDK
  force structured output using schema
  apply a 30-second timeout on the LLM call
  validate result
  mark uncertain rows as requiresConfirmation

Output:
  ExtractedRecipe
```

System prompt rules to include:

```
- Extract recipe name, servings, and ingredients.
- Do not calculate calories.
- Do not invent ingredients.
- If quantity is missing, use null.
- If unit is missing, use "unknown".
- If preparation state is unknown, use "unknown".
- If uncertain about an ingredient, add a warning.
- Keep ingredient names in Vietnamese if the input is in Vietnamese.
- Return only data that matches the schema.
```

---

## 11. Validation and Warning Aggregation

After AI extraction, `NutritionService` is responsible for applying validation rules and building the final warning list. This must happen in the service layer, not in the controller.

Rules:

```
If servings is null:
  add warning: "Servings are missing. Please enter the number of servings."
  set requiresConfirmation = true

If ingredient quantity is null:
  add warning for that ingredient
  set requiresConfirmation = true

If ingredient unit is null or "unknown":
  add warning for that ingredient
  set requiresConfirmation = true

If confidence < 0.8:
  add warning for that ingredient
  set requiresConfirmation = true

If unit is not supported by UnitConversionService:
  add warning, require restaurant correction

If ingredient name is too generic (e.g. "thịt", "rau", "sốt", "gia vị", "bột"):
  add warning, require restaurant correction
```

If any warnings exist after this pass, set session status to `NEEDS_REVIEW`.

If all ingredients are complete and confirmed, set status to `ANALYZED`.

---

## 12. Unit Conversion Rules

`UnitConversionService` must be deterministic. No AI call here.

Supported units for MVP:

```
g, kg, ml, l, tbsp, tsp, piece
```

Basic conversion reference:

```
1 kg  = 1000 g
1 l   = 1000 ml
1 tbsp water-like liquid ≈ 15 ml
1 tsp  water-like liquid ≈ 5 ml
1 tbsp oil              ≈ 13.5 g
1 tbsp sugar            ≈ 12.5 g
1 tsp  sugar            ≈ 4 g
1 egg (piece)           ≈ 50 g
```

Important rules:

- `piece`, `bowl`, `cup`, and similar volume-by-context units require confirmation unless a reliable per-ingredient conversion is known.
- All estimated conversions must set `requiresConfirmation = true` and include a note explaining the assumption.
- Never silently round or drop estimated values.

---

## 13. Ingredient Matching Strategy

For MVP, use deterministic matching only. No LLM call for matching.

Matching order:

```
1. Exact match by name_vi
2. Exact match by aliases array
3. Case-insensitive partial match
4. Fuzzy search
5. If multiple candidates remain, return all candidates to the frontend for manual restaurant selection
```

### State-aware matching

When matching, factor in the `preparation` field from AI extraction against the `state` field in `nutrition_foods`.

```
If preparation is "cooked" → prefer candidates with state = "cooked"
If preparation is "raw"    → prefer candidates with state = "raw"
If preparation is null or "unknown" → use recipe context to infer:
    "cơm" implies cooked rice → prefer state = "cooked"
    "gạo" implies raw rice    → prefer state = "raw"
```

This distinction is nutritionally significant and must not be ignored:

```
gạo trắng ≠ cơm trắng
raw rice  ≠ cooked rice
```

When multiple state variants exist for the same ingredient and preparation is ambiguous, return both as candidates for the restaurant to select.

---

## 14. Nutrition Calculation

Handled by `NutritionCalculatorService`. No AI call here.

Input per ingredient:

```
nutritionFoodId
quantityGram
```

Formula:

```
ingredientCalories = quantityGram / 100 * calories_100g
ingredientProtein  = quantityGram / 100 * protein_100g
ingredientCarbs    = quantityGram / 100 * carbs_100g
ingredientFat      = quantityGram / 100 * fat_100g
```

Then:

```
total    = sum(all ingredients)
perServing = total / servings
```

Rounding rules for display:

```
calories          — nearest integer
protein/carbs/fat — 1 decimal place
sodium            — nearest integer
```

If an ingredient has no `nutritionFoodId` or no `quantityGram`, exclude it from calculation and add a warning. Do not block the entire calculation because of one missing ingredient.

If `servings` is null or zero, block calculation entirely.

---

## 15. Frontend Requirements

Restaurant UI should support:

### Recipe input form

Fields:

```
Menu item
Recipe text (textarea)
Analyze button
```

### AI extraction review table

Columns:

```
Ingredient name  — editable
Quantity         — editable
Unit             — editable dropdown (closed list matching schema enum)
Confidence       — read-only display
Warning          — show note if requiresConfirmation = true
Actions          — Edit, Remove
```

Additional actions:

```
Add ingredient
Set servings
Confirm and calculate
```

Rows where `requiresConfirmation = true` must be visually highlighted.

### Nutrition result screen

Show:

```
Per-serving: Calories, Protein, Carbs, Fat
Total recipe: Calories, Protein, Carbs, Fat
Any warnings
Save button
```

### Mandatory disclaimer

Always display this to the restaurant and the customer:

```
Nutrition values are estimates based on the provided recipe and ingredient database.
Actual values may vary depending on ingredients, portion size, and cooking method.
```

---

## 16. Error Handling

Handle these cases:

### LLM unavailable

```
AI analysis service is currently unavailable.
Please try again or enter ingredients manually.
```

### LLM returns invalid output (fails schema validation)

Retry once. If retry fails:

```
Could not extract recipe reliably.
Please simplify the recipe format or enter ingredients manually.
```

### Missing quantity

Ask restaurant to fill in manually.

### Ingredient not found in database

Return candidates or allow manual nutrition entry.

### Servings missing

Block calculation. Ask restaurant to enter number of servings.

### Missing analysisSessionId on calculate request

Reject the request. Do not calculate without a linked session.

---

## 17. Security and Safety

Frontend should only call NestJS API endpoints. Do not expose Ollama directly.

Backend must:

- limit recipe text input to a maximum length (e.g. 5000 characters);
- sanitize text input;
- rate-limit AI requests per restaurant;
- log failed AI extraction attempts;
- avoid storing raw prompts or AI debug data in production logs;
- require restaurant ownership check for every `menuItemId`.

Authorization rule:

```
A restaurant can only analyze or save nutrition for its own menu items.
```

Do not label food with medical claims, diet suitability claims, or disease-specific assessments.

Tags like "high protein" must be derived from explicit numeric thresholds, not from AI text output.

---

## 18. Suggested Implementation Order

### Phase 1: Database

Drizzle schema and migrations for:

```
nutrition_foods
nutrition_analysis_sessions
nutrition_analysis_ingredients
menu_item_nutrition
```

Seed `nutrition_foods` with common Vietnamese ingredients.

---

### Phase 2: AI extraction

Implement:

```
AiRecipeExtractionService
extractedRecipeSchema (with enum constraints on unit and preparation)
POST /nutrition/analyze-recipe
```

Test with hardcoded recipe text.

---

### Phase 3: Review flow

Return AI result to frontend with session ID.

Allow restaurant to edit ingredients before calculation.

---

### Phase 4: Ingredient matching

Implement:

```
IngredientMatchingService (with state-aware matching)
UnitConversionService
```

Return matched candidates and warnings.

---

### Phase 5: Nutrition calculation

Implement:

```
NutritionCalculatorService
POST /nutrition/calculate (requires analysisSessionId)
```

Calculate total and per-serving nutrition.

---

### Phase 6: Save final result

Implement:

```
PUT /nutrition (requires verifiedByRestaurant: true)
```

Save final nutrition info to menu item.

---

### Phase 7: Customer display

Update customer-facing menu item detail API to include nutrition and disclaimer.

---

## 19. Testing Strategy

### Unit tests

Test:

```
UnitConversionService
IngredientMatchingService — exact match, fuzzy match, state-aware match, no match
NutritionCalculatorService — rounding, missing ingredient exclusion, servings guard
```

### Integration tests

Test:

```
Analyze recipe endpoint — returns session ID and extracted ingredients
Calculate endpoint — blocks if servings missing, blocks if analysisSessionId missing
Save endpoint — blocks if verifiedByRestaurant is not true
```

### AI extraction tests

Use fixed recipe examples. Mock the LLM response. Do not call Ollama in unit tests.

Example test cases:

```
Recipe with clear grams
Recipe with tbsp/tsp only
Recipe missing servings
Recipe missing quantities
Recipe with ambiguous ingredient names
Recipe with Vietnamese food names
Recipe with a generic ingredient name (e.g. "thịt")
```

Validate:

```
Output matches schema (all enum values are valid)
Required fields are present
Ingredients array is non-empty for non-trivial input
Warnings are returned for missing data
```

---

## 20. MVP Acceptance Criteria

The feature is complete when:

- Restaurant can enter recipe text.
- System calls Ollama using Vercel AI SDK v4.
- AI returns structured JSON matching the schema, including valid enum values for `unit` and `preparation`.
- Backend validates the output and builds review warnings.
- Restaurant can review and correct ingredients before calculation.
- Backend matches ingredients with nutrition database using state-aware matching.
- Backend calculates calories, protein, carbs, and fat.
- Restaurant can confirm and save final nutrition values.
- Customer sees nutrition info and disclaimer on menu item detail.
- Tests cover extraction, matching, calculation, and all API endpoints.

---

## 21. Things Not Required for MVP

Do not implement:

```
Image upload
OCR
Computer vision ingredient recognition
Fine-tuned model
Vector database
Full RAG pipeline
Medical diet recommendation
Automatic "healthy/unhealthy" judgment
```

---

## 22. Future Enhancements

Possible improvements:

```
Image-based recipe extraction
USDA FoodData Central integration
Vector search for ingredient matching
Allergen detection
Healthy menu filters
AI-generated customer-friendly nutrition explanation
Restaurant dashboard for nutrition completeness
```

---

## 23. Final Architecture Summary

```
Restaurant Recipe Text
  ↓
NestJS NutritionController
  ↓
NutritionService (validation + warning aggregation)
  ↓
AiRecipeExtractionService
  ↓
Ollama via Vercel AI SDK v4
  ↓
Structured Ingredient JSON (validated enums)
  ↓
Restaurant Review UI
  ↓
IngredientMatchingService (state-aware)
  ↓
UnitConversionService
  ↓
nutrition_foods table
  ↓
NutritionCalculatorService
  ↓
menu_item_nutrition table
  ↓
Customer Menu Item Detail
```

The implementation must keep AI as a helper layer for extraction only. Nutrition values must always come from the database, calculated by the backend, and confirmed by the restaurant.
