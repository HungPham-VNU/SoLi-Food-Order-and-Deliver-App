import { buildSearchDocument } from './ai-search-document';

describe('buildSearchDocument', () => {
  it('generates a stable hash from normalized searchable content', () => {
    const first = buildSearchDocument({
      primaryName: '  Chicken   Rice ',
      description: 'Grilled chicken with rice.',
      tags: ['Grilled', 'Rice'],
      categoryName: 'Rice',
      cuisineType: 'Vietnamese',
      restaurantName: 'Healthy Bowl',
    });
    const second = buildSearchDocument({
      primaryName: 'chicken rice',
      description: 'grilled chicken with rice',
      tags: ['grilled', 'rice'],
      categoryName: 'rice',
      cuisineType: 'vietnamese',
      restaurantName: 'healthy bowl',
    });

    expect(second.document).toBe(first.document);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it('changes the hash when searchable content changes', () => {
    const original = buildSearchDocument({
      primaryName: 'Chicken Rice',
      description: 'Grilled chicken',
    });
    const changed = buildSearchDocument({
      primaryName: 'Chicken Rice',
      description: 'Roasted chicken',
    });

    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it('indexes the canonical item kind independently from category text', () => {
    const document = buildSearchDocument({
      primaryName: 'House Special',
      itemKind: 'beverage',
      categoryName: 'Dessert',
    });

    expect(document.document).toContain('item type beverage');
    expect(document.document).toContain('dessert');
  });

  it('only includes nutrition text when nutrition is restaurant verified', () => {
    const unverified = buildSearchDocument({
      primaryName: 'Chicken Rice',
      nutrition: {
        protein: 42,
        calories: 520,
        carbs: 60,
        fat: 10,
        verifiedByRestaurant: false,
      },
    });
    const verified = buildSearchDocument({
      primaryName: 'Chicken Rice',
      nutrition: {
        protein: 42,
        calories: 520,
        carbs: 60,
        fat: 10,
        verifiedByRestaurant: true,
      },
    });

    expect(unverified.document).not.toContain('protein');
    expect(verified.document).toContain('protein');
    expect(verified.contentHash).not.toBe(unverified.contentHash);
  });

  it('includes ingredient names only when nutrition is restaurant verified', () => {
    const unverified = buildSearchDocument({
      primaryName: 'Summer Bowl',
      ingredients: ['uc ga', 'com trang'],
      nutrition: {
        verifiedByRestaurant: false,
      },
    });
    const verified = buildSearchDocument({
      primaryName: 'Summer Bowl',
      ingredients: ['uc ga', 'com trang'],
      nutrition: {
        verifiedByRestaurant: true,
      },
    });

    expect(unverified.document).not.toContain('uc');
    expect(unverified.document).not.toContain('trang');
    expect(verified.document).toContain('ingredients');
    expect(verified.document).toContain('uc');
    expect(verified.document).toContain('trang');
    expect(verified.contentHash).not.toBe(unverified.contentHash);
  });
});
