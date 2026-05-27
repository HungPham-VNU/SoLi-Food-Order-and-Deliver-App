import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { orders, orderItems, orderStatusLogs } from '../../module/ordering/order/order.schema';
import type { OrderModifier } from '../../module/ordering/order/order.schema';

const db = drizzle(process.env.DATABASE_URL!);

const RESTAURANT_ID = '722b1275-7f60-418c-8f06-03caa3d891a5';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

async function seedTestOrders() {
  try {
    console.log('🍽️  Creating test orders for The Green Bistro...\n');

    const testOrders = [
      { status: 'pending' as const, label: 'Pending', itemId: 'a470096d-fbe5-4497-9b1f-ac5f805778f8', itemName: 'Spring Rolls', price: 45000 },
      { status: 'confirmed' as const, label: 'Confirmed', itemId: '3e07a028-c6fb-478e-b665-fe27dc7ae62d', itemName: 'Phở Bò', price: 65000 },
      { status: 'preparing' as const, label: 'Preparing', itemId: 'ddbfc807-a65a-4ea6-92eb-369c1bfc4f5a', itemName: 'Bánh Mì Thịt', price: 40000 },
      { status: 'ready_for_pickup' as const, label: 'Ready', itemId: '8690decd-4a1b-4b97-bb11-0bdcbd063fe3', itemName: 'Pizza 4Ps', price: 60000 },
    ];

    for (const testOrder of testOrders) {
      const orderId = crypto.randomUUID();
      const cartId = crypto.randomUUID();

      const modifiers: OrderModifier[] = [
        {
          groupId: crypto.randomUUID(),
          groupName: 'Size',
          optionId: crypto.randomUUID(),
          optionName: 'Large',
          price: 5000,
        },
      ];

      await db.insert(orders).values({
        id: orderId,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        restaurantName: 'The Green Bistro',
        cartId,
        status: testOrder.status,
        totalAmount: testOrder.price + 5000 + 18000,
        shippingFee: 18000,
        discountAmount: 5000,
        paymentMethod: 'cod',
        deliveryAddress: {
          street: '456 Le Loi',
          district: 'District 1',
          city: 'Ho Chi Minh',
          latitude: 10.7769,
          longitude: 106.7009,
        },
        estimatedDeliveryMinutes: 35,
      });

      await db.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: testOrder.itemId,
        itemName: testOrder.itemName,
        unitPrice: testOrder.price,
        modifiersPrice: 5000,
        quantity: 1,
        subtotal: testOrder.price + 5000,
        modifiers,
      });

      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: null,
        toStatus: testOrder.status,
        triggeredByRole: 'system',
      });

      console.log(`✅ ${testOrder.label}: ${testOrder.itemName}`);
    }

    console.log('\n✅ All test orders created for The Green Bistro!');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

seedTestOrders().then(() => process.exit(0));
