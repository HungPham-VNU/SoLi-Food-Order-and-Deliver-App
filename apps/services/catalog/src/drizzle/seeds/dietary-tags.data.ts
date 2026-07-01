export const dietaryTagSlugs = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  pescatarian: 'pescatarian',
  glutenFree: 'gluten-free',
  dairyFree: 'dairy-free',
  nutFree: 'nut-free',
  halal: 'halal',
  kosher: 'kosher',
  keto: 'keto',
  paleo: 'paleo',
  organic: 'organic',
  sugarFree: 'sugar-free',
  lowSodium: 'low-sodium',
  whole30: 'whole30',
} as const;

export type DietaryTagSlug =
  (typeof dietaryTagSlugs)[keyof typeof dietaryTagSlugs];

export const dietaryTagSeeds = [
  {
    name: 'Vegan',
    slug: dietaryTagSlugs.vegan,
    description:
      'Excludes all animal products, including meat, dairy, eggs, and honey.',
    category: 'dietary' as const,
  },
  {
    name: 'Vegetarian',
    slug: dietaryTagSlugs.vegetarian,
    description:
      'Excludes meat, poultry, and seafood, but may include dairy and eggs.',
    category: 'dietary' as const,
  },
  {
    name: 'Pescatarian',
    slug: dietaryTagSlugs.pescatarian,
    description: 'Excludes meat and poultry, but includes fish and seafood.',
    category: 'dietary' as const,
  },
  {
    name: 'Gluten-Free',
    slug: dietaryTagSlugs.glutenFree,
    description: 'Excludes gluten, a protein found in wheat, barley, and rye.',
    category: 'dietary' as const,
  },
  {
    name: 'Dairy-Free',
    slug: dietaryTagSlugs.dairyFree,
    description:
      'Excludes all dairy products, such as milk, cheese, and yogurt.',
    category: 'dietary' as const,
  },
  {
    name: 'Nut-Free',
    slug: dietaryTagSlugs.nutFree,
    description: 'Excludes peanuts and tree nuts.',
    category: 'dietary' as const,
  },
  {
    name: 'Halal',
    slug: dietaryTagSlugs.halal,
    description: 'Prepared according to Islamic dietary laws.',
    category: 'dietary' as const,
  },
  {
    name: 'Kosher',
    slug: dietaryTagSlugs.kosher,
    description: 'Prepared according to Jewish dietary laws.',
    category: 'dietary' as const,
  },
  {
    name: 'Keto',
    slug: dietaryTagSlugs.keto,
    description: 'A low-carb, high-fat diet designed to induce ketosis.',
    category: 'dietary' as const,
  },
  {
    name: 'Paleo',
    slug: dietaryTagSlugs.paleo,
    description:
      'Focuses on whole foods presumed to be available to paleolithic humans.',
    category: 'dietary' as const,
  },
  {
    name: 'Organic',
    slug: dietaryTagSlugs.organic,
    description:
      'Prepared with ingredients grown without synthetic pesticides or fertilizers.',
    category: 'lifestyle' as const,
  },
  {
    name: 'Sugar-Free',
    slug: dietaryTagSlugs.sugarFree,
    description: 'Contains no added sugars.',
    category: 'dietary' as const,
  },
  {
    name: 'Low-Sodium',
    slug: dietaryTagSlugs.lowSodium,
    description: 'Contains limited amounts of sodium.',
    category: 'dietary' as const,
  },
  {
    name: 'Whole30',
    slug: dietaryTagSlugs.whole30,
    description:
      'A 30-day diet that emphasizes whole foods and eliminates sugar, alcohol, grains, legumes, soy, and dairy.',
    category: 'dietary' as const,
  },
] as const;
