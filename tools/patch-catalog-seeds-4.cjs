const fs = require('fs');
const path = require('path');

const seedsDir = path.join(__dirname, '..', 'apps', 'services', 'catalog', 'src', 'drizzle', 'seeds');
const filesToPatch = [
  'vegan-nutrition.seed.ts',
  'beverage-restaurants.seed.ts',
  'food-and-beverage-restaurants.seed.ts',
  'nearby-vnu-nutrition.seed.ts',
  'dietary-tags.seed.ts'
];

for (const file of filesToPatch) {
  const filePath = path.join(seedsDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the missing async in `.catch((error) => {`
  content = content.replace(/\.catch\(\(error\) => \{/g, '.catch(async (error) => {');

  // Also remove the bad import (using a simple line remove)
  content = content.replace(/^.*menu-item-snapshot\.schema.*$/gm, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${file} again 4`);
}
