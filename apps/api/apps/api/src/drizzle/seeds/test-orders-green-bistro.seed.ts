/**
 * Test Orders for The Green Bistro
 * Creates sample orders for the specified user's restaurant
 *
 * Run: pnpm ts-node apps/api/src/drizzle/seeds/test-orders-green-bistro.seed.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { orders, orderItems, orderStatusLogs } from '../../module/ordering/order/order.schema';
import type { OrderModifier } from '../../module/ordering/order/order.schema';

const db = drizzle(process.env.DATABASE_URL!);

// The Green Bistro restaurant
const RESTAURANT_ID = '722b1275-7f60-418c-8f06-03caa3d891a5';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'; // Test customer

async function seedTestOrders() {
  try {
    console.log('🍽️  Creating test orders for The Green Bistro...\n');

    const testOrders = [
      {
        status: 'pending' as const,
        label: 'Pending Order',
        itemName: 'Green Salad Bowl',
        createdMinutesAgo: 2,
      },
      {
        status: 'confirmed' as const,
        label: 'Confirmed Order',
        itemName: 'Vegan Buddha Bowl',
        createdMinutesAgo: 8,
      },
      {
        status: 'preparing' as const,
        label: 'Preparing Order',
        itemName: 'Organic Vegetable Stir-fry',
        createdMinutesAgo: 15,
      },
      {
        status: 'ready_for_pickup' as const,
        label: 'Ready Order',
        itemName: 'Green Smoothie Bowl',
        createdMinutesAgo: 25,
      },
    ];

    for (const testOrder of testOrders) {
      const orderId = crypto.randomUUID();
      const cartId = crypto.randomUUID();
      const menuItemId = crypto.randomUUID();

      const modifiers: OrderModifier[] = [
        {
          groupId: crypto.randomUUID(),
          groupName: 'Dressing',
          optionId: crypto.randomUUID(),
          optionName: 'Vinaigrette',
          price: 0,
        },
        {
          groupId: crypto.randomUUID(),
          groupName: 'Protein',
          optionId: crypto.randomUUID(),
          optionName: 'Tofu',
          price: 8000,
        },
        {
          groupId: crypto.randomUUID(),
          groupName: 'Add-ons',
          optionId: crypto.randomUUID(),
          optionName: 'Nuts Mix',
          price: 5000,
        },
      ];

      const createdAt = new Date(Date.now() - testOrder.createdMinutesAgo * 60 * 1000);

      // Insert order
      await db.insert(orders).values({
        id: orderId,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        restaurantName: 'The Green Bistro',
        cartId,
        status: testOrder.status,
        totalAmount: 145000, // 145k VND
        shippingFee: 18000,  // 18k shipping
        discountAmount: 12000, // 12k discount
        paymentMethod: 'cod',
        deliveryAddress: {
          street: '456 Le Loi',
          district: 'District 1',
          city: 'Ho Chi Minh',
          latitude: 10.7769,
          longitude: 106.7009,
        },
        estimatedDeliveryMinutes: 40,
        createdAt,
      });

      // Insert order item
      await db.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        menuItemId,
        itemName: testOrder.itemName,
        unitPrice: 128000, // 128k base price
        modifiersPrice: 13000, // modifiers total
        quantity: 1,
        subtotal: 141000,
        modifiers,
      });

      // Insert status log (initial creation)
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: null,
        toStatus: testOrder.status,
        triggeredByRole: 'system',
        createdAt,
      });

      console.log(`✅ Created ${testOrder.label} (${testOrder.status})`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Item: ${testOrder.itemName}`);
      console.log(`   Created: ${createdAt.toLocaleString()}\n`);
    }

    console.log('✅ All test orders for The Green Bistro created successfully!');
    console.log('📋 Ready for kitchen board testing');
  } catch (err) {
    console.error('❌ Error creating test orders:', err);
    process.exit(1);
  }
}

seedTestOrders().then(() => process.exit(0));
