import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildUsdaEnglishLocalization,
  buildUsdaFoundationNutritionFoods,
  parseCsv,
  streamUsdaFoundationNutritionFoodBatches,
} from './usda-foundation-foods';

describe('USDA Foundation Foods import mapper', () => {
  it('parses quoted CSV fields', () => {
    const rows = parseCsv(
      [
        '"id","description"',
        '"1","Chicken, breast"',
        '"2","Cheese ""sharp"""',
      ].join('\n'),
    );

    expect(rows).toEqual([
      { id: '1', description: 'Chicken, breast' },
      { id: '2', description: 'Cheese "sharp"' },
    ]);
  });

  it('builds nutrition food rows from Foundation Foods only', () => {
    const result = buildUsdaFoundationNutritionFoods({
      foundationFood: [
        '"fdc_id","NDB_number","footnote"',
        '"100","0500",""',
        '"101","0501",""',
      ].join('\n'),
      food: [
        '"fdc_id","data_type","description","food_category_id","publication_date"',
        '"100","foundation_food","Chicken, broilers or fryers, breast, meat only, raw","5","2026-04-30"',
        '"101","foundation_food","Incomplete food","5","2026-04-30"',
        '"999","sample_food","Sample food","5","2026-04-30"',
      ].join('\n'),
      foodCategory: [
        '"id","code","description"',
        '"5","0500","Poultry Products"',
      ].join('\n'),
      foodNutrient: [
        '"id","fdc_id","nutrient_id","amount","data_points","derivation_id","min","max","median","footnote","min_year_acquired"',
        '"1","100","2048","120","1","1","","","","",""',
        '"2","100","1008","121","1","1","","","","",""',
        '"3","100","1003","22.5","1","1","","","","",""',
        '"4","100","1004","2.6","1","1","","","","",""',
        '"5","100","1005","0","1","1","","","","",""',
        '"6","100","1079","0","1","1","","","","",""',
        '"7","100","1093","50","1","1","","","","",""',
        '"8","101","1003","1","1","1","","","","",""',
      ].join('\n'),
    });

    expect(result.foundationFoodCount).toBe(2);
    expect(result.skippedMissingRequiredNutrients).toBe(1);
    expect(result.foods).toEqual([
      expect.objectContaining({
        nameEn: 'Chicken, broilers or fryers, breast, meat only, raw',
        nameVi: 'Chicken, broilers or fryers, breast, meat only, raw',
        source: 'USDA_FDC',
        sourceFoodId: '100',
        aliases: ['chicken broilers or fryers breast meat only raw', 'chicken'],
        category: 'Poultry Products',
        state: 'raw',
        calories100g: 121,
        protein100g: 22.5,
        carbs100g: 0,
        fat100g: 2.6,
        fiber100g: 0,
        sodium100g: 50,
      }),
    ]);
  });

  it('streams nutrition food batches without building one full output array', async () => {
    const csvDir = mkdtempSync(join(tmpdir(), 'usda-foundation-foods-'));
    const batches: unknown[][] = [];

    try {
      writeFileSync(
        join(csvDir, 'foundation_food.csv'),
        ['"fdc_id","NDB_number","footnote"', '"100","0500",""'].join('\n'),
      );
      writeFileSync(
        join(csvDir, 'food.csv'),
        [
          '"fdc_id","data_type","description","food_category_id","publication_date"',
          '"100","foundation_food","Chicken, broilers or fryers, breast, meat only, raw","5","2026-04-30"',
        ].join('\n'),
      );
      writeFileSync(
        join(csvDir, 'food_category.csv'),
        ['"id","code","description"', '"5","0500","Poultry Products"'].join(
          '\n',
        ),
      );
      writeFileSync(
        join(csvDir, 'food_nutrient.csv'),
        [
          '"id","fdc_id","nutrient_id","amount","data_points","derivation_id","min","max","median","footnote","min_year_acquired"',
          '"1","100","1008","121","1","1","","","","",""',
          '"2","100","1003","22.5","1","1","","","","",""',
          '"3","100","1004","2.6","1","1","","","","",""',
          '"4","100","1005","0","1","1","","","","",""',
        ].join('\n'),
      );

      const result = await streamUsdaFoundationNutritionFoodBatches(csvDir, {
        batchSize: 1,
        onBatch: (batch) => {
          batches.push(batch);
        },
      });

      expect(result).toMatchObject({
        importedFoodCount: 1,
        foundationFoodCount: 1,
        skippedMissingFoodRows: 0,
        skippedMissingRequiredNutrients: 0,
      });
      expect(batches).toEqual([
        [
          expect.objectContaining({
            nameEn: 'Chicken, broilers or fryers, breast, meat only, raw',
            source: 'USDA_FDC',
            sourceFoodId: '100',
            calories100g: 121,
            protein100g: 22.5,
            carbs100g: 0,
            fat100g: 2.6,
          }),
        ],
      ]);
    } finally {
      rmSync(csvDir, { recursive: true, force: true });
    }
  });

  it('builds English localization rows for imported USDA foods', () => {
    expect(
      buildUsdaEnglishLocalization({
        nutritionFoodId: 'food-1',
        nameEn: 'Chicken, broilers or fryers, breast, meat only, raw',
        aliases: ['chicken broilers or fryers breast meat only raw', 'chicken'],
      }),
    ).toEqual({
      nutritionFoodId: 'food-1',
      locale: 'en',
      name: 'Chicken, broilers or fryers, breast, meat only, raw',
      aliases: ['chicken broilers or fryers breast meat only raw', 'chicken'],
    });
  });
});
