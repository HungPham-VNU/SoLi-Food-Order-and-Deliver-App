/**
 * Custom Restaurant Orders Seed
 * Creates sample orders for a specific restaurant
 *
 * Run: pnpm ts-node apps/api/src/drizzle/seeds/custom-restaurant-orders.seed.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { orders, orderItems, orderStatusLogs } from '../../module/ordering/order/order.schema';
import type { OrderModifier } from '../../module/ordering/order/order.schema';

const db = drizzle(process.env.DATABASE_URL!);

// Target restaurant ID
const RESTAURANT_ID = '722b1275-7f60-418c-8f06-03caa3d891a5';
const CUSTOMER_ID = crypto.randomUUID();

async function seedCustomRestaurantOrders() {
  try {
    console.log('🍽️  Creating test orders for restaurant...\n');
    console.log(`Restaurant ID: ${RESTAURANT_ID}\n`);

    const menuItems = [
      { id: 'a470096d-fbe5-4497-9b1f-ac5f805778f8', name: 'Spring Rolls', price: 45000 },
      { id: 'c796b96f-9edd-48bc-aaea-74d9844e3d87', name: 'Fresh Lemonade', price: 20000 },
      { id: 'a1f57dff-4f9f-48fc-97fa-24d2be5824c1', name: 'Iced Coffee (Cà Phê Đá)', price: 25000 },
      { id: 'ddbfc807-a65a-4ea6-92eb-369c1bfc4f5a', name: 'Bánh Mì Thịt', price: 40000 },
      { id: '3e07a028-c6fb-478e-b665-fe27dc7ae62d', name: 'Phở Bò', price: 65000 },
      { id: '8690decd-4a1b-4b97-bb11-0bdcbd063fe3', name: 'Pizza 4Ps first class', price: 60000 },
    ];

    const testOrders = [
      {
        status: 'pending' as const,
        label: 'Pending Order',
        menuItem: menuItems[4], // Phở Bò
        createdMinutesAgo: 2,
      },
      {
        status: 'paid' as const,
        label: 'Paid Order',
        menuItem: menuItems[0], // Spring Rolls
        createdMinutesAgo: 5,
      },
      {
        status: 'confirmed' as const,
        label: 'Confirmed Order',
        menuItem: menuItems[3], // Bánh Mì Thịt
        createdMinutesAgo: 8,
      },
      {
        status: 'preparing' as const,
        label: 'Preparing Order',
        menuItem: menuItems[2], // Iced Coffee
        createdMinutesAgo: 15,
      },
      {
        status: 'ready_for_pickup' as const,
        label: 'Ready for Pickup Order',
        menuItem: menuItems[1], // Fresh Lemonade
        createdMinutesAgo: 25,
      },
    ];

    for (const testOrder of testOrders) {
      const orderId = crypto.randomUUID();
      const cartId = crypto.randomUUID();
      const { menuItem } = testOrder;

      const modifiers: OrderModifier[] = [
        {
          groupId: crypto.randomUUID(),
          groupName: 'Size',
          optionId: crypto.randomUUID(),
          optionName: 'Large',
          price: 10000,
        },
      ];

      const createdAt = new Date(Date.now() - testOrder.createdMinutesAgo * 60 * 1000);
      const subtotal = menuItem.price + 10000; // price + modifier

      // Insert order
      await db.insert(orders).values({
        id: orderId,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        restaurantName: 'Test Restaurant',
        cartId,
        status: testOrder.status,
        totalAmount: subtotal + 25000, // subtotal + shipping
        shippingFee: 25000,  // 25k shipping
        discountAmount: 0,
        paymentMethod: 'cod',
        deliveryAddress: {
          street: '456 Le Duan',
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
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        modifiersPrice: 10000, // modifier price
        quantity: 1,
        subtotal,
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
      console.log(`   Item: ${testOrder.menuItem.name}`);
      console.log(`   Created: ${createdAt.toLocaleString()}\n`);
    }

    console.log('✅ All orders created successfully!');
    console.log(`📋 Customer ID: ${CUSTOMER_ID}`);
    console.log(`🍽️  Restaurant ID: ${RESTAURANT_ID}`);
  } catch (err) {
    console.error('❌ Error creating orders:', err);
    process.exit(1);
  }
}

seedCustomRestaurantOrders().then(() => process.exit(0));
