import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const db = drizzle(pool, { schema });

const catalogDatabaseUrl =
  process.env.CATALOG_DATABASE_URL ||
  'postgresql://uitfood_catalog:catalog_secret@localhost:5432/uitfood_catalog';
const catalogPool = new Pool({
  connectionString: catalogDatabaseUrl,
});

const comments = [
  'Amazing food, highly recommended!',
  'The delivery was fast and the food was hot.',
  'Good portion size but a bit too salty for my taste.',
  'Will definitely order again.',
  'Average experience, nothing special.',
  'The packaging was excellent.',
  'Tastes exactly like how my mom used to make it.',
  'Not worth the price.',
  'Absolutely delicious!',
  'Best meal I have had in a while.',
];

const tagsList = [
  'Fast Delivery',
  'Great Taste',
  'Good Portion',
  'Hot Food',
  'Well Packaged',
  'Value for Money',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateReviewsForRestaurant(
  restaurantId: string,
  count: number,
): {
  generatedReviews: schema.NewReview[];
  ratingSum: number;
  reviewCount: number;
} {
  const generatedReviews: schema.NewReview[] = [];
  let ratingSum = 0;

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let stars = 5;
    if (r < 0.1) stars = 1;
    else if (r < 0.2) stars = 2;
    else if (r < 0.4) stars = 3;
    else if (r < 0.7) stars = 4;

    ratingSum += stars;

    const orderId = crypto.randomUUID();
    const customerId = crypto.randomUUID();

    const selectedTags: string[] = [];
    const numTags = randomInt(0, 3);
    for (let j = 0; j < numTags; j++) {
      const tag = randomItem(tagsList);
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    }

    generatedReviews.push({
      id: crypto.randomUUID(),
      orderId,
      customerId,
      restaurantId,
      stars,
      comment: Math.random() > 0.3 ? randomItem(comments) : null,
      tags: selectedTags.length > 0 ? selectedTags : null,
      createdAt: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000),
    });
  }

  return { generatedReviews, ratingSum, reviewCount: count };
}

async function seedReviews() {
  try {
    console.log('⭐ Seeding reviews for all restaurants...');

    const { rows: allRestaurants } = (await catalogPool.query(
      'SELECT id FROM restaurants',
    )) as { rows: { id: string }[] };

    if (allRestaurants.length === 0) {
      console.log('No restaurants found to seed reviews.');
      return;
    }

    let totalReviews = 0;

    for (const restaurant of allRestaurants) {
      const numReviews = randomInt(5, 20);
      const { generatedReviews, reviewCount } = generateReviewsForRestaurant(
        restaurant.id,
        numReviews,
      );

      await db.insert(schema.reviews).values(generatedReviews);

      totalReviews += reviewCount;
    }

    console.log(
      `\n✅ Successfully seeded ${totalReviews} reviews across ${allRestaurants.length} restaurants!`,
    );
  } catch (err) {
    console.error('❌ Error:', err);
    await catalogPool.end();
    await pool.end();
    process.exit(1);
  }
}

void seedReviews().then(async () => {
  await catalogPool.end();
  await pool.end();
  process.exit(0);
});
