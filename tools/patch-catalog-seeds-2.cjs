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

  // Fix the "await pool.end()" syntax error at the bottom
  content = content.replace(/void main\(\)\.then\(\(\) => \{\n\s*await pool\.end\(\);\s*process\.exit\(0\);\s*\}\);/g, 
    'void main().then(async () => { await pool.end(); process.exit(0); });');

  // Completely remove seedOwnerAccounts function
  content = content.replace(/async function seedOwnerAccounts\(\) \{[\s\S]*?\}\n/g, '');
  
  // Completely remove seedImageRecords function
  content = content.replace(/async function seedImageRecords\([\s\S]*?\}\n/g, '');

  // Remove the imports
  content = content.replace(/import type \{ MenuItemSnapshot \} from '\.\.\/\.\.\/module\/ordering\/acl\/schemas\/menu-item-snapshot\.schema';\n?/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${file} again`);
}

// Fix nutrition-rpc.controller.ts error
const rpcControllerPath = path.join(__dirname, '..', 'apps', 'services', 'catalog', 'src', 'rpc', 'nutrition-rpc.controller.ts');
if (fs.existsSync(rpcControllerPath)) {
  let content = fs.readFileSync(rpcControllerPath, 'utf8');
  content = content.replace(/@MessagePattern\(CATALOG_RPC_PATTERNS\.startManualNutrition\)/g, 
    '// @MessagePattern(CATALOG_RPC_PATTERNS.startManualNutrition)');
  fs.writeFileSync(rpcControllerPath, content, 'utf8');
}
