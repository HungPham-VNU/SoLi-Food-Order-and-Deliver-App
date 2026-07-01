import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://uitfood_reporting:reporting_secret@localhost:5432/uitfood_reporting';
const db = drizzle({
  connection: {
    connectionString: databaseUrl,
  },
});

const catalogDatabaseUrl =
  process.env.CATALOG_DATABASE_URL ||
  'postgresql://uitfood_catalog:catalog_secret@localhost:5432/uitfood_catalog';
const catalogPool = new Pool({ connectionString: catalogDatabaseUrl });

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedAnalyticsOrdersFreshBowlVnu() {
  try {
    console.log('🍽️  Fetching Fresh Bowl VNU restaurant from Catalog...');
    const { rows: restaurants } = (await catalogPool.query(
      "SELECT id, name FROM restaurants WHERE name = 'Fresh Bowl VNU'",
    )) as { rows: { id: string; name: string }[] };

    if (restaurants.length === 0) {
      console.log(
        '❌ Fresh Bowl VNU restaurant not found. Please run catalog seeds first.',
      );
      return;
    }
    const targetRestaurant = restaurants[0];

    const { rows: menuItems } = (await catalogPool.query(
      'SELECT id, name, price FROM menu_items WHERE restaurant_id = $1',
      [targetRestaurant.id],
    )) as { rows: { id: string; name: string; price: string }[] };
    if (menuItems.length === 0) {
      console.log('❌ No menu items found for Fresh Bowl VNU.');
      return;
    }

    console.log(
      `🍽️  Found Fresh Bowl VNU with ${menuItems.length} menu items. Creating analytics orders...`,
    );
    const totalOrders = 150;

    // Seed restaurant facts first
    await db
      .insert(schema.reportingRestaurantFacts)
      .values({
        restaurantId: targetRestaurant.id,
        name: targetRestaurant.name,
      })
      .onConflictDoNothing();

    const orderFacts: schema.NewReportingOrderFact[] = [];
    const itemFacts: schema.NewReportingOrderItemFact[] = [];

    for (let i = 0; i < totalOrders; i++) {
      const orderId = crypto.randomUUID();

      const daysAgo = Math.random() * 30;
      const placedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      // Much lower fail rate for a specific good restaurant!
      const isFailed = Math.random() < 0.05;
      const status = isFailed
        ? Math.random() > 0.5
          ? 'cancelled'
          : 'refunded'
        : 'delivered';

      const numItems = randomInt(1, 4);
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const currentItem = randomItem(menuItems);
        const quantity = randomInt(1, 3);
        const itemSubtotal = parseFloat(currentItem.price) * quantity;
        subtotal += itemSubtotal;

        itemFacts.push({
          id: crypto.randomUUID(),
          orderId,
          menuItemId: currentItem.id,
          itemName: currentItem.name,
          quantity,
          revenue: itemSubtotal,
          createdAt: placedAt,
        });
      }

      const shippingFee = randomInt(15, 30) * 1000;

      const acceptSeconds = randomInt(10, 120);
      const confirmedAt = new Date(placedAt.getTime() + acceptSeconds * 1000);

      let deliveredAt: Date | undefined;

      if (isFailed) {
        // unused failedAt
      } else {
        const prepSeconds = randomInt(300, 900);
        const readyAt = new Date(confirmedAt.getTime() + prepSeconds * 1000);
        deliveredAt = new Date(readyAt.getTime() + randomInt(600, 1500) * 1000);
      }

      orderFacts.push({
        orderId,
        restaurantId: targetRestaurant.id,
        restaurantName: targetRestaurant.name,
        status,
        totalAmount: subtotal + shippingFee,
        shippingFee,
        district: 'VNU Test District',
        placedAt,
        confirmedAt,
        readyAt: deliveredAt ? new Date(deliveredAt.getTime() - 10000) : null,
        createdAt: placedAt,
      });
    }

    await db.insert(schema.reportingOrderFacts).values(orderFacts);
    for (let i = 0; i < itemFacts.length; i += 50) {
      await db
        .insert(schema.reportingOrderItemFacts)
        .values(itemFacts.slice(i, i + 50));
    }

    console.log(
      `\n✅ ${totalOrders} analytics orders created successfully for Fresh Bowl VNU!`,
    );
  } catch (err) {
    console.error('❌ Error:', err);
    await catalogPool.end();
    process.exit(1);
  }
}

void seedAnalyticsOrdersFreshBowlVnu().then(async () => {
  await catalogPool.end();
  process.exit(0);
});
