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

  // Remove `modifierSnapshots.push({ ... });`
  content = content.replace(/modifierSnapshots\.push\(\{[\s\S]*?\}\);/g, '');
  
  // Remove `optionSnapshots.push({ ... });`
  content = content.replace(/optionSnapshots\.push\(\{[\s\S]*?\}\);/g, '');
  
  // Remove `const optionSnapshots: any\[\] = \[\];`
  content = content.replace(/const optionSnapshots: any\[\] = \[\];\n?/g, '');
  content = content.replace(/const modifierSnapshots: any\[\] = \[\];\n?/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${file} again 5`);
}
