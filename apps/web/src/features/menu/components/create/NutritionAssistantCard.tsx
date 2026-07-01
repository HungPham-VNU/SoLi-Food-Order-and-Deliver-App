import { useMemo, useState } from 'react';
import { Calculator, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  useAnalyzeNutrition,
  useCalculateNutrition,
  useSaveNutrition,
  useStartManualNutritionSession,
} from '../../hooks/useMenuMutations';
import { useMenuItemNutritionAnalysis } from '../../hooks/useMenu';
import type {
  AnalyzeRecipeResponse,
  CalculateNutritionResponse,
  IngredientCategory,
  MenuItemNutrition,
  NutritionReviewIngredient,
  NutritionUnit,
  PreparationState,
} from '../../types';

const UNIT_OPTIONS: NutritionUnit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'tbsp',
  'tsp',
  'piece',
  'cup',
  'bowl',
  'bunch',
  'pinch',
  'unknown',
];

const PREPARATION_OPTIONS: PreparationState[] = [
  'raw',
  'cooked',
  'fried',
  'boiled',
  'grilled',
  'steamed',
  'unknown',
];

const NO_PREPARATION_CATEGORIES: ReadonlySet<IngredientCategory> = new Set([
  'seasoning',
  'sauce',
  'garnish',
  'herb_side',
]);

const OPTIONAL_MEASUREMENT_CATEGORIES: ReadonlySet<IngredientCategory> =
  new Set(['seasoning', 'sauce', 'garnish', 'herb_side']);

const hasPositiveQuantity = (quantity: number | null | undefined) =>
  typeof quantity === 'number' && quantity > 0;

const formatServingsInput = (servings: number | null | undefined) =>
  typeof servings === 'number' && Number.isFinite(servings)
    ? `${servings}`
    : '0';

const parseServingsInput = (value: string) => {
  if (value.trim() === '') return null;

  const servings = Number(value);
  return Number.isFinite(servings) ? servings : null;
};

interface NutritionAssistantCardProps {
  menuItemId?: string;
  currentNutrition?: MenuItemNutrition | null;
  onNutritionSaved?: (nutrition: MenuItemNutrition) => void;
  onSaveBeforeAnalyze?: () => Promise<string | null>;
  isSavingItem?: boolean;
}

const emptyIngredient = (): NutritionReviewIngredient => ({
  name: '',
  quantity: null,
  unit: 'g',
  preparation: 'unknown',
  category: 'main',
  confidence: 1,
  requiresConfirmation: true,
  measurementRequired: true,
  preparationApplicable: true,
  notes: [],
});

const normalizeReviewIngredients = (
  ingredients: NutritionReviewIngredient[],
): NutritionReviewIngredient[] =>
  ingredients.length > 0
    ? ingredients.map((ingredient) =>
        applyIngredientReviewHints({
          ...ingredient,
          notes: ingredient.notes ?? [],
        }),
      )
    : [emptyIngredient()];

const applyIngredientReviewHints = (
  ingredient: NutritionReviewIngredient,
): NutritionReviewIngredient => {
  const category = ingredient.category ?? 'main';
  const preparationApplicable = !NO_PREPARATION_CATEGORIES.has(category);
  const measurementRequired =
    !OPTIONAL_MEASUREMENT_CATEGORIES.has(category) ||
    hasPositiveQuantity(ingredient.quantity);

  return {
    ...ingredient,
    quantity: measurementRequired ? ingredient.quantity : 0,
    preparation: preparationApplicable
      ? (ingredient.preparation ?? 'unknown')
      : null,
    measurementRequired,
    preparationApplicable,
  };
};

export function NutritionAssistantCard({
  menuItemId,
  currentNutrition,
  onNutritionSaved,
  onSaveBeforeAnalyze,
  isSavingItem = false,
}: NutritionAssistantCardProps) {
  const [recipeText, setRecipeText] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeRecipeResponse | null>(null);
  const [ingredients, setIngredients] = useState<NutritionReviewIngredient[]>(
    [],
  );
  const [servingsInput, setServingsInput] = useState('0');
  const [calculation, setCalculation] =
    useState<CalculateNutritionResponse | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hydratedAnalysisSessionId, setHydratedAnalysisSessionId] = useState<
    string | null
  >(null);

  const { data: latestAnalysis, isLoading: isLoadingNutritionAnalysis } =
    useMenuItemNutritionAnalysis(menuItemId);
  const analyzeNutrition = useAnalyzeNutrition(menuItemId);
  const startManualNutrition = useStartManualNutritionSession(menuItemId);
  const calculateNutrition = useCalculateNutrition(menuItemId ?? '');
  const saveNutrition = useSaveNutrition(menuItemId ?? '');

  const allWarnings = useMemo(
    () =>
      Array.from(
        new Set([
          ...(analysis?.warnings ?? []),
          ...(calculation?.warnings ?? []),
        ]),
      ),
    [analysis, calculation],
  );

  const parsedServings = parseServingsInput(servingsInput);
  const isServingsValid = parsedServings !== null && parsedServings > 0;
  const servingsValidationMessage = !isServingsValid
    ? 'Enter a serving count greater than 0 before calculating.'
    : null;

  const canCalculate =
    !!analysis?.analysisSessionId &&
    isServingsValid &&
    ingredients.some((ingredient) => {
      const reviewedIngredient = applyIngredientReviewHints(ingredient);
      return (
        reviewedIngredient.name.trim().length > 0 &&
        reviewedIngredient.measurementRequired
      );
    });

  if (
    latestAnalysis &&
    hydratedAnalysisSessionId !== latestAnalysis.analysisSessionId &&
    (!analysis ||
      analysis.analysisSessionId === latestAnalysis.analysisSessionId)
  ) {
    setRecipeText(latestAnalysis.recipeText);
    setAnalysis(latestAnalysis);
    setIngredients(normalizeReviewIngredients(latestAnalysis.ingredients));
    setServingsInput(formatServingsInput(latestAnalysis.servings));
    setCalculation(null);
    setSaveMessage(null);
    setHydratedAnalysisSessionId(latestAnalysis.analysisSessionId);
  }

  const handleAnalyze = async () => {
    setSaveMessage(null);
    setCalculation(null);
    const targetMenuItemId = menuItemId ?? (await onSaveBeforeAnalyze?.());

    if (!targetMenuItemId) return;

    analyzeNutrition.mutate(
      {
        menuItemId: targetMenuItemId,
        recipeText,
      },
      {
        onSuccess: (result) => {
          setAnalysis(result);
          setIngredients(normalizeReviewIngredients(result.ingredients));
          setServingsInput(formatServingsInput(result.servings));
          setHydratedAnalysisSessionId(result.analysisSessionId);
        },
      },
    );
  };

  const handleStartManualEntry = async () => {
    setSaveMessage(null);
    setCalculation(null);
    const targetMenuItemId = menuItemId ?? (await onSaveBeforeAnalyze?.());

    if (!targetMenuItemId) return;

    startManualNutrition.mutate(targetMenuItemId, {
      onSuccess: (result) => {
        setRecipeText('');
        setAnalysis(result);
        setIngredients(normalizeReviewIngredients(result.ingredients));
        setServingsInput(formatServingsInput(result.servings));
        setHydratedAnalysisSessionId(result.analysisSessionId);
      },
    });
  };

  const updateIngredient = (
    index: number,
    patch: Partial<NutritionReviewIngredient>,
  ) => {
    setIngredients((current) =>
      current.map((ingredient, i) =>
        i === index
          ? applyIngredientReviewHints({ ...ingredient, ...patch })
          : ingredient,
      ),
    );
    setCalculation(null);
    setSaveMessage(null);
  };

  const updateServingsInput = (value: string) => {
    setServingsInput(value);
    setCalculation(null);
    setSaveMessage(null);
  };

  const handleCalculate = () => {
    if (!analysis || !isServingsValid) return;

    calculateNutrition.mutate(
      {
        analysisSessionId: analysis.analysisSessionId,
        servings: parsedServings,
        ingredients: ingredients
          .filter((ingredient) => ingredient.name.trim().length > 0)
          .map((ingredient) => {
            const reviewedIngredient = applyIngredientReviewHints(ingredient);

            return {
              name: reviewedIngredient.name.trim(),
              quantity: reviewedIngredient.quantity,
              unit: reviewedIngredient.unit,
              preparation: reviewedIngredient.preparationApplicable
                ? (reviewedIngredient.preparation ?? 'unknown')
                : null,
              category: reviewedIngredient.category,
            };
          }),
      },
      {
        onSuccess: (result) => {
          setCalculation(result);
          setSaveMessage(null);
        },
      },
    );
  };

  const handleSave = () => {
    if (!analysis || !calculation || !isServingsValid) return;

    saveNutrition.mutate(
      {
        analysisSessionId: analysis.analysisSessionId,
        verifiedByRestaurant: true,
      },
      {
        onSuccess: (nutrition) => {
          onNutritionSaved?.(nutrition);
          setCalculation(null);
          setSaveMessage('Nutrition saved.');
        },
      },
    );
  };

  return (
    <div className="bg-card rounded-3xl p-8 shadow-sm border border-border/50">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Nutrition
          </h3>
        </div>
        {analysis && (
          <Badge
            variant={analysis.status === 'ANALYZED' ? 'default' : 'secondary'}
            className="shrink-0"
          >
            {analysis.status.replace('_', ' ')}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium" htmlFor="recipe-text">
          Recipe text
        </label>
        <Textarea
          id="recipe-text"
          className="min-h-32 resize-y"
          maxLength={5000}
          value={recipeText}
          onChange={(event) => setRecipeText(event.target.value)}
          placeholder="Com ga sot teriyaki&#10;- 500g uc ga&#10;- 300g com trang&#10;Chia 2 phan"
        />
        <Button
          type="button"
          onClick={handleAnalyze}
          disabled={
            recipeText.trim().length === 0 ||
            analyzeNutrition.isPending ||
            isSavingItem ||
            (!menuItemId && !onSaveBeforeAnalyze)
          }
          className="w-full gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {isSavingItem
            ? 'Saving'
            : analyzeNutrition.isPending
              ? 'Analyzing'
              : menuItemId
                ? 'Analyze recipe'
                : 'Save and analyze recipe'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleStartManualEntry}
          disabled={
            startManualNutrition.isPending ||
            isSavingItem ||
            (!menuItemId && !onSaveBeforeAnalyze)
          }
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          {isSavingItem
            ? 'Saving'
            : startManualNutrition.isPending
              ? 'Preparing ingredient table'
              : 'Enter ingredients manually'}
        </Button>
        {analyzeNutrition.error && (
          <p className="text-sm text-destructive">
            {analyzeNutrition.error.message}
          </p>
        )}
        {startManualNutrition.error ? (
          <p className="text-sm text-destructive">
            {startManualNutrition.error.message}
          </p>
        ) : null}
        {isLoadingNutritionAnalysis && (
          <p className="text-xs text-muted-foreground">
            Loading saved recipe analysis...
          </p>
        )}
      </div>

      {analysis && (
        <div className="mt-8 space-y-5">
          <div className="flex items-end gap-3">
            <div className="w-28">
              <label className="text-sm font-medium" htmlFor="servings">
                Servings
              </label>
              <Input
                id="servings"
                type="number"
                min={0}
                step={1}
                value={servingsInput}
                aria-invalid={!isServingsValid}
                aria-describedby={
                  servingsValidationMessage ? 'servings-error' : undefined
                }
                onChange={(event) => updateServingsInput(event.target.value)}
              />
              {servingsValidationMessage && (
                <p
                  id="servings-error"
                  className="mt-1 text-xs text-destructive"
                >
                  {servingsValidationMessage}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setIngredients((current) => [...current, emptyIngredient()])
              }
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Ingredient</th>
                  <th className="px-3 py-2 w-24">Qty</th>
                  <th className="px-3 py-2 w-28">Unit</th>
                  <th className="px-3 py-2 w-32">Prep</th>
                  <th className="px-3 py-2 w-24">Conf.</th>
                  <th className="px-3 py-2">Warning</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ingredient, index) => {
                  const reviewedIngredient =
                    applyIngredientReviewHints(ingredient);
                  const isOptionalUnmeasured =
                    !reviewedIngredient.measurementRequired;
                  const firstNote =
                    (reviewedIngredient.notes ?? [])[0] ??
                    (isOptionalUnmeasured
                      ? 'Not counted unless an amount is added.'
                      : '');

                  return (
                    <tr
                      key={`${ingredient.rawText ?? 'manual'}-${index}`}
                      className={
                        reviewedIngredient.requiresConfirmation
                          ? 'bg-amber-50/70 dark:bg-amber-950/20'
                          : 'bg-card'
                      }
                    >
                      <td className="px-3 py-2">
                        <Input
                          value={reviewedIngredient.name}
                          onChange={(event) =>
                            updateIngredient(index, {
                              name: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={reviewedIngredient.quantity ?? ''}
                          onChange={(event) =>
                            updateIngredient(index, {
                              quantity:
                                event.target.value === ''
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        {isOptionalUnmeasured ? (
                          <span className="inline-flex h-8 items-center rounded-lg bg-muted/50 px-2 text-xs text-muted-foreground">
                            Not measured
                          </span>
                        ) : (
                          <select
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none"
                            value={reviewedIngredient.unit}
                            onChange={(event) =>
                              updateIngredient(index, {
                                unit: event.target.value as NutritionUnit,
                              })
                            }
                          >
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {reviewedIngredient.preparationApplicable ? (
                          <select
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none"
                            value={reviewedIngredient.preparation ?? 'unknown'}
                            onChange={(event) =>
                              updateIngredient(index, {
                                preparation: event.target
                                  .value as PreparationState,
                              })
                            }
                          >
                            {PREPARATION_OPTIONS.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex h-8 items-center rounded-lg bg-muted/50 px-2 text-xs text-muted-foreground">
                            Not applicable
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {typeof reviewedIngredient.confidence === 'number'
                          ? `${Math.round(reviewedIngredient.confidence * 100)}%`
                          : 'Manual'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {firstNote}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setIngredients((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          aria-label="Remove ingredient"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate || calculateNutrition.isPending}
            className="w-full gap-2"
          >
            <Calculator className="h-4 w-4" />
            {calculateNutrition.isPending
              ? 'Calculating'
              : 'Calculate nutrition'}
          </Button>
          {calculateNutrition.error && (
            <p className="text-sm text-destructive">
              {calculateNutrition.error.message}
            </p>
          )}
        </div>
      )}

      {currentNutrition && (
        <SavedNutritionSummary nutrition={currentNutrition} />
      )}

      {calculation && (
        <div className="mt-8 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <NutritionMetric
              label="Calories"
              value={`${calculation.nutrition.perServing.calories}`}
              unit="kcal"
            />
            <NutritionMetric
              label="Protein"
              value={`${calculation.nutrition.perServing.protein}`}
              unit="g"
            />
            <NutritionMetric
              label="Carbs"
              value={`${calculation.nutrition.perServing.carbs}`}
              unit="g"
            />
            <NutritionMetric
              label="Fat"
              value={`${calculation.nutrition.perServing.fat}`}
              unit="g"
            />
          </div>

          <div className="rounded-xl border border-border/60 p-4 text-xs text-muted-foreground">
            Total recipe: {calculation.nutrition.total.calories} kcal,{' '}
            {calculation.nutrition.total.protein}g protein,{' '}
            {calculation.nutrition.total.carbs}g carbs,{' '}
            {calculation.nutrition.total.fat}g fat
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saveNutrition.isPending || !isServingsValid}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {saveNutrition.isPending ? 'Saving' : 'Save verified nutrition'}
          </Button>
          {saveMessage && <p className="text-sm text-primary">{saveMessage}</p>}
          {saveNutrition.error && (
            <p className="text-sm text-destructive">
              {saveNutrition.error.message}
            </p>
          )}
        </div>
      )}

      {allWarnings.length > 0 && (
        <div
          aria-live="polite"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/10 p-4"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-accent-foreground marker:text-accent">
            {allWarnings.map((warning) => (
              <li key={warning} className="break-words">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Nutrition values are estimates based on the provided recipe and
        ingredient database. Actual values may vary depending on ingredients,
        portion size, and cooking method.
      </p>
    </div>
  );
}

function NutritionMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {value}
        <span className="ml-1 text-xs font-medium text-muted-foreground">
          {unit}
        </span>
      </p>
    </div>
  );
}

function SavedNutritionSummary({
  nutrition,
}: {
  nutrition: MenuItemNutrition;
}) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Analyzed nutrition
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Read-only</Badge>
          <Badge variant="secondary">
            {formatNutritionSource(nutrition.source)}
          </Badge>
          {nutrition.verifiedByRestaurant && (
            <Badge variant="secondary">Verified</Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NutritionMetric
          label="Servings"
          value={formatNutritionValue(nutrition.servings)}
          unit="servings"
        />
        <NutritionMetric
          label="Calories"
          value={formatNutritionValue(nutrition.calories)}
          unit="kcal"
        />
        <NutritionMetric
          label="Protein"
          value={formatNutritionValue(nutrition.protein)}
          unit="g"
        />
        <NutritionMetric
          label="Carbs"
          value={formatNutritionValue(nutrition.carbs)}
          unit="g"
        />
        <NutritionMetric
          label="Fat"
          value={formatNutritionValue(nutrition.fat)}
          unit="g"
        />
        <NutritionMetric
          label="Fiber"
          value={formatOptionalNutritionValue(nutrition.fiber)}
          unit={nutrition.fiber === null ? '' : 'g'}
        />
        <NutritionMetric
          label="Sugar"
          value={formatOptionalNutritionValue(nutrition.sugar)}
          unit={nutrition.sugar === null ? '' : 'g'}
        />
        <NutritionMetric
          label="Sodium"
          value={formatOptionalNutritionValue(nutrition.sodium)}
          unit={nutrition.sodium === null ? '' : 'mg'}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {nutrition.disclaimer}
      </p>
    </div>
  );
}

function formatNutritionValue(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatOptionalNutritionValue(value: number | null) {
  return value === null ? 'Not set' : formatNutritionValue(value);
}

function formatNutritionSource(source: MenuItemNutrition['source']) {
  return source
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
