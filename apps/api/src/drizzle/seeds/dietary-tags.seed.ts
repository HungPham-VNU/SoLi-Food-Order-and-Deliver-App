import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';

const tags = [
  {
    name: 'Vegan',
    slug: 'vegan',
    description:
      'Excludes all animal products, including meat, dairy, eggs, and honey.',
    category: 'dietary' as const,
  },
  {
    name: 'Vegetarian',
    slug: 'vegetarian',
    description:
      'Excludes meat, poultry, and seafood, but may include dairy and eggs.',
    category: 'dietary' as const,
  },
  {
    name: 'Pescatarian',
    slug: 'pescatarian',
    description: 'Excludes meat and poultry, but includes fish and seafood.',
    category: 'dietary' as const,
  },
  {
    name: 'Gluten-Free',
    slug: 'gluten-free',
    description: 'Excludes gluten, a protein found in wheat, barley, and rye.',
    category: 'dietary' as const,
  },
  {
    name: 'Dairy-Free',
    slug: 'dairy-free',
    description:
      'Excludes all dairy products, such as milk, cheese, and yogurt.',
    category: 'dietary' as const,
  },
  {
    name: 'Nut-Free',
    slug: 'nut-free',
    description: 'Excludes peanuts and tree nuts.',
    category: 'dietary' as const,
  },
  {
    name: 'Halal',
    slug: 'halal',
    description: 'Prepared according to Islamic dietary laws.',
    category: 'dietary' as const,
  },
  {
    name: 'Kosher',
    slug: 'kosher',
    description: 'Prepared according to Jewish dietary laws.',
    category: 'dietary' as const,
  },
  {
    name: 'Keto',
    slug: 'keto',
    description: 'A low-carb, high-fat diet designed to induce ketosis.',
    category: 'dietary' as const,
  },
  {
    name: 'Paleo',
    slug: 'paleo',
    description:
      'Focuses on whole foods presumed to be available to paleolithic humans.',
    category: 'dietary' as const,
  },
  {
    name: 'Organic',
    slug: 'organic',
    description:
      'Prepared with ingredients grown without synthetic pesticides or fertilizers.',
    category: 'lifestyle' as const,
  },
  {
    name: 'Sugar-Free',
    slug: 'sugar-free',
    description: 'Contains no added sugars.',
    category: 'dietary' as const,
  },
  {
    name: 'Low-Sodium',
    slug: 'low-sodium',
    description: 'Contains limited amounts of sodium.',
    category: 'dietary' as const,
  },
  {
    name: 'Whole30',
    slug: 'whole30',
    description:
      'A 30-day diet that emphasizes whole foods and eliminates sugar, alcohol, grains, legumes, soy, and dairy.',
    category: 'dietary' as const,
  },
];

async function seedDietaryTags() {
  console.log('Seeding dietary tags...');
  let count = 0;

  for (const tag of tags) {
    try {
      const existing = await db
        .select()
        .from(schema.dietaryTags)
        .where(eq(schema.dietaryTags.slug, tag.slug))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.dietaryTags)
          .set({
            name: tag.name,
            description: tag.description,
            category: tag.category,
            updatedAt: new Date(),
          })
          .where(eq(schema.dietaryTags.id, existing[0].id));
        console.log(`✅ Updated existing tag: ${tag.name}`);
      } else {
        await db.insert(schema.dietaryTags).values(tag);
        console.log(`✅ Inserted new tag: ${tag.name}`);
      }
      count++;
    } catch (error) {
      console.error(`❌ Error processing tag ${tag.name}:`, error);
    }
  }

  console.log(`\n✨ Successfully processed ${count} dietary tags!`);
}

seedDietaryTags()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Dietary tags seeding failed:', err);
    process.exit(1);
  });
