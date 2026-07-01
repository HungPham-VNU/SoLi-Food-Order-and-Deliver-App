const fs = require('fs');
const path = require('path');

const seedsDir = path.join(__dirname, '..', 'apps', 'services', 'catalog', 'src', 'drizzle', 'seeds');
const filesToPatch = [
  'vegan-nutrition.seed.ts',
  'beverage-restaurants.seed.ts',
  'food-and-beverage-restaurants.seed.ts',
  'nearby-vnu-nutrition.seed.ts'
];

for (const file of filesToPatch) {
  const filePath = path.join(seedsDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove seedOwnerAccounts and seedImageRecords calls from main()
  content = content.replace(/await seedOwnerAccounts\(\);/g, '');
  content = content.replace(/await seedImageRecords\(uploadedImagesMap\);/g, '');

  // 2. Remove the function definitions for seedOwnerAccounts and seedImageRecords
  // They usually start with `async function seedOwnerAccounts()` and end with `}`
  content = content.replace(/async function seedOwnerAccounts\(\) \{[\s\S]*?(?=\nasync function |\nfunction )/, '');
  content = content.replace(/async function seedImageRecords\([\s\S]*?(?=\nasync function |\nfunction )/, '');

  // 3. Clean up the `cleanupExistingSeedData` function internals
  const cleanupRegex = /if \(existingRestaurants\.length > 0\) \{[\s\S]*?await db\s*\n\s*\.delete\(schema\.restaurants\)[\s\S]*?\n\s*\}/;
  content = content.replace(cleanupRegex, `if (existingRestaurants.length > 0) {
    const restaurantIds = existingRestaurants.map((restaurant) => restaurant.id);
    await db.delete(schema.restaurants).where(inArray(schema.restaurants.id, restaurantIds));
  }`);

  // 4. In seedRestaurant, remove insertions to orderingRestaurantSnapshots and notificationRestaurantSnapshots
  content = content.replace(/await db\s*\.insert\(schema\.orderingRestaurantSnapshots\)[\s\S]*?\}\);/g, '');
  content = content.replace(/await db\s*\.insert\(schema\.notificationRestaurantSnapshots\)[\s\S]*?\}\);/g, '');

  // 5. In seedDeliveryZone, remove insertions to orderingDeliveryZoneSnapshots
  content = content.replace(/await db\s*\.insert\(schema\.orderingDeliveryZoneSnapshots\)[\s\S]*?\}\);/g, '');

  // 6. In seedMenuItem, remove insertions to orderingMenuItemSnapshots
  content = content.replace(/await db\s*\.insert\(schema\.orderingMenuItemSnapshots\)[\s\S]*?\}\);/g, '');

  // 7. Remove imports of better-auth/crypto if any, and other unused stuff
  content = content.replace(/import \{ hashPassword \} from 'better-auth\/crypto';\n?/g, '');
  
  // 8. Fix syntax error in dietary-tags if present
  // Wait, dietary tags is handled below.

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${file}`);
}

// Fix dietary-tags.seed.ts
const dietaryTagsPath = path.join(seedsDir, 'dietary-tags.seed.ts');
if (fs.existsSync(dietaryTagsPath)) {
  let content = fs.readFileSync(dietaryTagsPath, 'utf8');
  content = content.replace(/\.then\(\(\) => \{[\s\n]*await pool\.end\(\);\s*process\.exit\(0\);\s*\}\)/g, 
                            '.then(async () => { await pool.end(); process.exit(0); })');
  fs.writeFileSync(dietaryTagsPath, content, 'utf8');
  console.log(`Patched dietary-tags.seed.ts`);
}

// Fix missing imports in nearby-vnu
let nearby = fs.readFileSync(path.join(seedsDir, 'nearby-vnu-nutrition.seed.ts'), 'utf8');
nearby = nearby.replace(/import \{ dietaryTagSlugs.*?;/g, 'import { dietaryTagSlugs, type DietaryTagSlug } from \'./dietary-tags.data\';');
fs.writeFileSync(path.join(seedsDir, 'nearby-vnu-nutrition.seed.ts'), nearby, 'utf8');

