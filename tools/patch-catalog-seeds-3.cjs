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

  // Regex to remove all delete statements that target missing schemas
  content = content.replace(/await db\s*\.delete\(schema\.account\)[\s\S]*?\n\s*\);/g, '');
  content = content.replace(/await db\s*\.delete\(schema\.user\)[\s\S]*?\n\s*\);/g, '');
  content = content.replace(/await db\s*\.delete\(schema\.images\)[\s\S]*?\n\s*\);/g, '');
  content = content.replace(/await db\s*\.delete\(schema\.orderingMenuItemSnapshots\)[\s\S]*?\n\s*\);/g, '');
  content = content.replace(/await db\s*\.delete\(schema\.orderingDeliveryZoneSnapshots\)[\s\S]*?\n\s*\);/g, '');
  content = content.replace(/await db\s*\.delete\(schema\.orderingRestaurantSnapshots\)[\s\S]*?\n\s*\);/g, '');
  content = content.replace(/await db\s*\.delete\(schema\.notificationRestaurantSnapshots\)[\s\S]*?\n\s*\);/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${file} again 3`);
}
