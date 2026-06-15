import {
  IngredientMatchingService,
  type MatchableNutritionFood,
} from './ingredient-matching.service';

function makeFood(
  overrides: Partial<MatchableNutritionFood>,
): MatchableNutritionFood {
  return {
    id: 'food-1',
    nameVi: 'ức gà',
    nameEn: 'chicken breast',
    source: 'TEST',
    sourceFoodId: 'food-1',
    aliases: ['uc ga'],
    category: 'meat',
    state: 'raw',
    calories100g: 120,
    protein100g: 22.5,
    carbs100g: 0,
    fat100g: 2.6,
    fiber100g: null,
    sugar100g: null,
    sodium100g: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('IngredientMatchingService', () => {
  let service: IngredientMatchingService;

  beforeEach(() => {
    service = new IngredientMatchingService();
  });

  it('matches exact Vietnamese names', () => {
    const result = service.matchIngredient({ name: 'ức gà' }, [makeFood({})]);

    expect(result.bestCandidate?.matchedFoodId).toBe('food-1');
    expect(result.bestCandidate?.matchConfidence).toBeGreaterThanOrEqual(0.95);
  });

  it('matches aliases without accents', () => {
    const result = service.matchIngredient({ name: 'uc ga' }, [makeFood({})]);

    expect(result.bestCandidate?.matchedName).toBe('ức gà');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('matches localized Vietnamese aliases for canonical USDA foods', () => {
    const result = service.matchIngredient(
      { name: 'thịt lợn ba chỉ', preparation: 'raw' },
      [
        makeFood({
          id: 'pork-belly',
          nameVi: 'Pork, belly, with skin, raw',
          nameEn: 'Pork, belly, with skin, raw',
          aliases: ['pork belly'],
          localizedName: 'ba chỉ heo',
          localizedAliases: ['ba chi heo', 'thit lon ba chi', 'ba roi'],
        }),
      ],
    );

    expect(result.bestCandidate?.matchedFoodId).toBe('pork-belly');
    expect(result.bestCandidate?.matchedName).toBe('ba chỉ heo');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('uses preparation to prefer cooked state variants', () => {
    const foods = [
      makeFood({
        id: 'rice-raw',
        nameVi: 'cơm trắng',
        nameEn: 'white rice raw-like test',
        aliases: ['com trang'],
        state: 'raw',
      }),
      makeFood({
        id: 'rice-cooked',
        nameVi: 'cơm trắng',
        nameEn: 'cooked white rice',
        aliases: ['com trang'],
        state: 'cooked',
      }),
    ];

    const result = service.matchIngredient(
      { name: 'com trang', preparation: 'cooked' },
      foods,
    );

    expect(result.bestCandidate?.matchedFoodId).toBe('rice-cooked');
  });

  it('matches USDA comma-separated descriptions by token overlap', () => {
    const description = 'Chicken, broilers or fryers, breast, meat only, raw';
    const result = service.matchIngredient(
      { name: 'chicken breast', preparation: 'raw' },
      [
        makeFood({
          id: 'usda-chicken-breast',
          nameVi: description,
          nameEn: description,
          aliases: ['chicken broilers or fryers breast meat only raw'],
          state: 'raw',
        }),
      ],
    );

    expect(result.bestCandidate?.matchedFoodId).toBe('usda-chicken-breast');
    expect(result.bestCandidate?.matchConfidence).toBeGreaterThanOrEqual(0.8);
    expect(result.requiresConfirmation).toBe(true);
  });

  it('matches common bun cha ingredient names through seed aliases', () => {
    const foods = [
      makeFood({
        id: 'pork-belly',
        nameVi: 'ba chỉ heo',
        nameEn: 'pork belly',
        aliases: ['ba chi heo', 'ba roi heo', 'thit lon ba chi'],
        category: 'meat',
      }),
      makeFood({
        id: 'pork-shoulder',
        nameVi: 'nạc vai heo',
        nameEn: 'pork shoulder',
        aliases: ['nac vai', 'nac vai heo', 'thit vai bam'],
        category: 'meat',
      }),
      makeFood({
        id: 'green-papaya',
        nameVi: 'đu đủ xanh',
        nameEn: 'green papaya',
        aliases: ['du du xanh', 'green papaya'],
        category: 'vegetable',
      }),
      makeFood({
        id: 'vinegar',
        nameVi: 'giấm',
        nameEn: 'vinegar',
        aliases: ['giam', 'dam', 'giam tao'],
        category: 'sauce',
        state: 'unknown',
      }),
      makeFood({
        id: 'caramel-sauce',
        nameVi: 'nước màu',
        nameEn: 'caramel cooking sauce',
        aliases: ['nuoc mau', 'nuoc hang'],
        category: 'sauce',
        state: 'unknown',
      }),
      makeFood({
        id: 'mixed-herbs',
        nameVi: 'rau thơm',
        nameEn: 'mixed Vietnamese herbs',
        aliases: ['rau thom', 'rau song', 'rau an kem'],
        category: 'vegetable',
      }),
    ];

    expect(
      service.matchIngredient({ name: 'thịt lợn ba chỉ' }, foods).bestCandidate
        ?.matchedFoodId,
    ).toBe('pork-belly');
    expect(
      service.matchIngredient({ name: 'nạc vai băm' }, foods).bestCandidate
        ?.matchedFoodId,
    ).toBe('pork-shoulder');
    expect(
      service.matchIngredient({ name: 'đu đủ xanh' }, foods).bestCandidate
        ?.matchedFoodId,
    ).toBe('green-papaya');
    expect(
      service.matchIngredient({ name: 'dấm táo' }, foods).bestCandidate
        ?.matchedFoodId,
    ).toBe('vinegar');
    expect(
      service.matchIngredient({ name: 'nước hàng' }, foods).bestCandidate
        ?.matchedFoodId,
    ).toBe('caramel-sauce');
    expect(
      service.matchIngredient({ name: 'rau sống' }, foods).bestCandidate
        ?.matchedFoodId,
    ).toBe('mixed-herbs');
  });

  it('flags generic ingredient names', () => {
    expect(service.isGenericIngredientName('thịt')).toBe(true);
    expect(service.isGenericIngredientName('uc ga')).toBe(false);
  });

  it('returns no candidate when similarity is too low', () => {
    const result = service.matchIngredient({ name: 'coffee beans' }, [
      makeFood({}),
    ]);

    expect(result.bestCandidate).toBeNull();
    expect(result.requiresConfirmation).toBe(true);
  });
});
