import { UnitConversionService } from './unit-conversion.service';

describe('UnitConversionService', () => {
  let service: UnitConversionService;

  beforeEach(() => {
    service = new UnitConversionService();
  });

  it('converts kilograms to grams without confirmation', () => {
    const result = service.convertToGrams({
      ingredientName: 'uc ga',
      quantity: 1.5,
      unit: 'kg',
    });

    expect(result).toEqual({
      quantityGram: 1500,
      requiresConfirmation: false,
      notes: [],
    });
  });

  it('estimates tablespoon oil conversion and requires confirmation', () => {
    const result = service.convertToGrams({
      ingredientName: 'dau an',
      quantity: 2,
      unit: 'tbsp',
    });

    expect(result.quantityGram).toBe(27);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.notes[0]).toContain('oil');
  });

  it('converts egg pieces with a known per-piece weight', () => {
    const result = service.convertToGrams({
      ingredientName: 'trung ga',
      quantity: 2,
      unit: 'piece',
    });

    expect(result.quantityGram).toBe(100);
    expect(result.requiresConfirmation).toBe(false);
  });

  it('does not invent grams for unsupported cup units', () => {
    const result = service.convertToGrams({
      ingredientName: 'com trang',
      quantity: 1,
      unit: 'cup',
    });

    expect(result.quantityGram).toBeNull();
    expect(result.requiresConfirmation).toBe(true);
  });

  it('keeps bowl quantities review-required instead of inventing grams', () => {
    const result = service.convertToGrams({
      ingredientName: 'du du xanh',
      quantity: 0.25,
      unit: 'bowl',
    });

    expect(result.quantityGram).toBeNull();
    expect(result.requiresConfirmation).toBe(true);
    expect(result.notes[0]).toContain('requires restaurant confirmation');
  });

  it('keeps bunch quantities review-required because they are variable', () => {
    const result = service.convertToGrams({
      ingredientName: 'rau song',
      quantity: 1,
      unit: 'bunch',
    });

    expect(result.quantityGram).toBeNull();
    expect(result.requiresConfirmation).toBe(true);
    expect(result.notes[0]).toContain('too variable');
  });
});
