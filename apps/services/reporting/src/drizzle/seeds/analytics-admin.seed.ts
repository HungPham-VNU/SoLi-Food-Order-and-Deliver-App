import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://uitfood_reporting:reporting_secret@localhost:5432/uitfood_reporting';
const db = drizzle({
  connection: {
    connectionString: databaseUrl,
  },
});

const catalogDatabaseUrl = process.env.CATALOG_DATABASE_URL || 'postgresql://uitfood_catalog:catalog_secret@localhost:5432/uitfood_catalog';
const catalogPool = new Pool({ connectionString: catalogDatabaseUrl });

type CancellationReason = 'kitchen_cancel' | 'driver_no_show' | 'out_of_stock' | 'customer_request' | 'payment_failed' | 'timeout' | 'other';
const cancellationReasons: CancellationReason[] = ['kitchen_cancel', 'driver_no_show', 'out_of_stock', 'customer_request', 'payment_failed', 'timeout', 'other'];

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seedAnalyticsOrdersAdmin() {
  try {
    console.log('🍽️  Fetching restaurants and menu items from Catalog...');
    const { rows: allRestaurants } = await catalogPool.query('SELECT id, name FROM restaurants');
    if (allRestaurants.length === 0) {
      console.log('❌ No restaurants found. Please seed restaurants first.');
      return;
    }
    const { rows: allMenuItems } = await catalogPool.query('SELECT id, restaurant_id as "restaurantId", name, price FROM menu_items');
    if (allMenuItems.length === 0) {
      console.log('❌ No menu items found. Please seed restaurants first.');
      return;
    }

    const menuItemsByRestaurant = new Map<string, typeof allMenuItems>();
    for (const item of allMenuItems) {
      if (!menuItemsByRestaurant.has(item.restaurantId)) menuItemsByRestaurant.set(item.restaurantId, []);
      menuItemsByRestaurant.get(item.restaurantId)!.push(item);
    }

    const validRestaurants = allRestaurants.filter(r => menuItemsByRestaurant.has(r.id) && menuItemsByRestaurant.get(r.id)!.length > 0);
    if (validRestaurants.length === 0) {
      console.log('❌ No valid restaurants with menu items found.');
      return;
    }

    console.log(`🍽️  Found ${validRestaurants.length} valid restaurants. Creating analytics...`);
    const totalOrders = 300;
    
    // Seed restaurant facts first
    const restaurantFacts: schema.NewReportingRestaurantFact[] = validRestaurants.map(r => ({
      restaurantId: r.id,
      name: r.name,
    }));
    await db.insert(schema.reportingRestaurantFacts).values(restaurantFacts).onConflictDoNothing();

    const orderFacts: schema.NewReportingOrderFact[] = [];
    const itemFacts: schema.NewReportingOrderItemFact[] = [];

    for (let i = 0; i < totalOrders; i++) {
      const orderId = crypto.randomUUID();
      const customerId = crypto.randomUUID();
      const restaurant = randomItem(validRestaurants);
      const restaurantMenuItems = menuItemsByRestaurant.get(restaurant.id)!;

      const daysAgo = Math.random() * 30;
      const placedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const isFailed = Math.random() < 0.2;
      const status = isFailed ? (Math.random() > 0.5 ? 'cancelled' : 'refunded') : 'delivered';
      const reasonCode = isFailed ? randomItem(cancellationReasons) : null;

      const numItems = randomInt(1, 3);
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const currentItem = randomItem(restaurantMenuItems);
        const quantity = randomInt(1, 2);
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
      
      const acceptSeconds = randomInt(10, 240);
      const confirmedAt = new Date(placedAt.getTime() + acceptSeconds * 1000);
      
      let failedAt: Date | undefined;
      let deliveredAt: Date | undefined;
      
      if (isFailed) {
        failedAt = new Date(confirmedAt.getTime() + randomInt(60, 600) * 1000);
      } else {
        const prepSeconds = randomInt(300, 1200);
        const readyAt = new Date(confirmedAt.getTime() + prepSeconds * 1000);
        deliveredAt = new Date(readyAt.getTime() + randomInt(600, 1800) * 1000);
      }

      orderFacts.push({
        orderId,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        status,
        totalAmount: subtotal + shippingFee,
        shippingFee,
        district: 'Admin Test District',
        placedAt,
        confirmedAt,
        readyAt: deliveredAt ? new Date(deliveredAt.getTime() - 10000) : null,
        createdAt: placedAt,
      });
    }

    await db.insert(schema.reportingOrderFacts).values(orderFacts);
    for (let i = 0; i < itemFacts.length; i += 50) {
      await db.insert(schema.reportingOrderItemFacts).values(itemFacts.slice(i, i + 50));
    }
    
    console.log(`\n✅ ${totalOrders} analytics orders created successfully!`);
  } catch (err) {
    console.error('❌ Error:', err);
    await catalogPool.end(); process.exit(1);
  }
}

void seedAnalyticsOrdersAdmin().then(async () => { await catalogPool.end(); process.exit(0); });
