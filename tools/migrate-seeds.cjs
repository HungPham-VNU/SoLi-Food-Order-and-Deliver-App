const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const legacySeedsDir = path.join(rootDir, 'UITFood - Legacy', 'apps', 'api', 'src', 'drizzle', 'seeds');

const seedMappings = [
  { file: 'dietary-tags.data.ts', service: 'catalog' },
  { file: 'dietary-tags.seed.ts', service: 'catalog' },
  { file: 'vegan-nutrition.seed.ts', service: 'catalog' },
  { file: 'beverage-restaurants.seed.ts', service: 'catalog' },
  { file: 'food-and-beverage-restaurants.seed.ts', service: 'catalog' },
  { file: 'nearby-vnu-nutrition.seed.ts', service: 'catalog' },
  { file: 'cloudinary-uploader.ts', service: 'catalog' },
  
  { file: 'reviews.seed.ts', service: 'review' },
  
  { file: 'analytics-admin.seed.ts', service: 'reporting' },
  { file: 'analytics-orders-fresh-bowl-vnu.seed.ts', service: 'reporting' }
];

const connectionCode = `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
export const db = drizzle(pool, { schema });
`;

function migrateSeeds() {
  for (const mapping of seedMappings) {
    const src = path.join(legacySeedsDir, mapping.file);
    const destDir = path.join(rootDir, 'apps', 'services', mapping.service, 'src', 'drizzle', 'seeds');
    const dest = path.join(destDir, mapping.file);

    if (!fs.existsSync(src)) {
      console.warn(`Source file missing: ${src}`);
      continue;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    let content = fs.readFileSync(src, 'utf8');

    // Remove the old imports
    content = content.replace(/import\s+{\s*db\s*}\s+from\s+['"]\.\.\/db['"];?\n?/, '');
    content = content.replace(/import\s+\*\s+as\s+schema\s+from\s+['"]\.\.\/schema['"];?\n?/, '');

    // Inject the new DB initialization
    if (mapping.file !== 'dietary-tags.data.ts' && mapping.file !== 'cloudinary-uploader.ts') {
        content = connectionCode + '\n' + content;
        // Fix process.exit to also close pool
        content = content.replace(/process\.exit\(\s*0\s*\)/g, 'await pool.end(); process.exit(0)');
        content = content.replace(/process\.exit\(\s*1\s*\)/g, 'await pool.end(); process.exit(1)');
    }

    fs.writeFileSync(dest, content, 'utf8');
    console.log(`Migrated ${mapping.file} to ${mapping.service}`);
  }

  // Copy images for catalog
  const srcImages = path.join(legacySeedsDir, 'images');
  const destImages = path.join(rootDir, 'apps', 'services', 'catalog', 'src', 'drizzle', 'seeds', 'images');
  
  if (fs.existsSync(srcImages)) {
    if (!fs.existsSync(destImages)) {
      fs.mkdirSync(destImages, { recursive: true });
    }
    const images = fs.readdirSync(srcImages);
    for (const img of images) {
      fs.copyFileSync(path.join(srcImages, img), path.join(destImages, img));
    }
    console.log(`Migrated images to catalog`);
  }
}

migrateSeeds();
