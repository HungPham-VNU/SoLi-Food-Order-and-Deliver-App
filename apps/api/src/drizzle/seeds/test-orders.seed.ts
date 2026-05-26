/**
 * Test Orders Seed
 * Creates sample orders with different statuses for kitchen board testing
 *
 * Run: pnpm ts-node apps/api/src/drizzle/seeds/test-orders.seed.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { orders, orderItems, orderStatusLogs } from '../../module/ordering/order/order.schema';
import type { OrderModifier } from '../../module/ordering/order/order.schema';

const db = drizzle(process.env.DATABASE_URL!);

// Fixed test IDs from main seed
const RESTAURANT_ID = 'fe8b2648-2260-4bc5-9acd-d88972148c78'; // Phở Bắc
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'; // Test customer

async function seedTestOrders() {
  try {
    console.log('🍽️  Creating test orders for kitchen board...\n');

    const testOrders = [
      {
        status: 'pending' as const,
        label: 'Pending Order',
        itemName: 'Phở Bò Tái Nạm',
        createdMinutesAgo: 2,
      },
      {
        status: 'confirmed' as const,
        label: 'Confirmed Order',
        itemName: 'Cơm Tấm Sườn Nướng',
        createdMinutesAgo: 8,
      },
      {
        status: 'preparing' as const,
        label: 'Preparing Order',
        itemName: 'Bún Chả Hà Nội',
        createdMinutesAgo: 15,
      },
      {
        status: 'ready_for_pickup' as const,
        label: 'Ready Order',
        itemName: 'Bánh Mì Thịt Nướng',
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
          groupName: 'Size',
          optionId: crypto.randomUUID(),
          optionName: 'Large',
          price: 5000,
        },
        {
          groupId: crypto.randomUUID(),
          groupName: 'Spicy Level',
          optionId: crypto.randomUUID(),
          optionName: 'Extra Hot',
          price: 0,
        },
        {
          groupId: crypto.randomUUID(),
          groupName: 'Toppings',
          optionId: crypto.randomUUID(),
          optionName: 'Extra Sprouts',
          price: 3000,
        },
      ];

      const createdAt = new Date(Date.now() - testOrder.createdMinutesAgo * 60 * 1000);

      // Insert order
      await db.insert(orders).values({
        id: orderId,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        restaurantName: 'Phở Bắc',
        cartId,
        status: testOrder.status,
        totalAmount: 125000, // 125k VND
        shippingFee: 15000,  // 15k shipping
        discountAmount: 10000, // 10k discount
        paymentMethod: 'cod',
        deliveryAddress: {
          street: '123 Nguyễn Huệ',
          district: 'District 1',
          city: 'Ho Chi Minh',
          latitude: 10.7769,
          longitude: 106.7009,
        },
        estimatedDeliveryMinutes: 35,
        createdAt,
      });

      // Insert order item
      await db.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        menuItemId,
        itemName: testOrder.itemName,
        unitPrice: 105000, // 105k base price
        modifiersPrice: 8000, // modifiers total
        quantity: 1,
        subtotal: 113000,
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

    console.log('✅ All test orders created successfully!');
    console.log('📋 Ready for kitchen board testing');
  } catch (err) {
    console.error('❌ Error creating test orders:', err);
    process.exit(1);
  }
}

seedTestOrders().then(() => process.exit(0));
