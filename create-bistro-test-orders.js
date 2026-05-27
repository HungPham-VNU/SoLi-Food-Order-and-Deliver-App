const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  user: 'food_order',
  password: 'foodordersecret',
  host: 'localhost',
  port: 5432,
  database: 'food_order_db',
});

async function createTestOrders() {
  const client = await pool.connect();
  try {
    const restaurantId = '722b1275-7f60-418c-8f06-03caa3d891a5'; // The Green Bistro
    const customerId = '22222222-2222-4222-8222-222222222222'; // Test customer

    // Real menu items from The Green Bistro
    const testOrders = [
      {
        status: 'pending',
        label: 'Pending Order',
        itemId: 'a470096d-fbe5-4497-9b1f-ac5f805778f8',
        itemName: 'Spring Rolls',
        price: 45000,
      },
      {
        status: 'confirmed',
        label: 'Confirmed Order',
        itemId: '3e07a028-c6fb-478e-b665-fe27dc7ae62d',
        itemName: 'Phở Bò',
        price: 65000,
      },
      {
        status: 'preparing',
        label: 'Preparing Order',
        itemId: 'ddbfc807-a65a-4ea6-92eb-369c1bfc4f5a',
        itemName: 'Bánh Mì Thịt',
        price: 40000,
      },
      {
        status: 'ready_for_pickup',
        label: 'Ready Order',
        itemId: '8690decd-4a1b-4b97-bb11-0bdcbd063fe3',
        itemName: 'Pizza 4Ps first class',
        price: 60000,
      },
    ];

    console.log('🍽️  Creating test orders for The Green Bistro...\n');

    for (const testOrder of testOrders) {
      const orderId = uuidv4();
      const cartId = uuidv4();

      const modifiers = [
        {
          groupId: uuidv4(),
          groupName: 'Size',
          optionId: uuidv4(),
          optionName: 'Large',
          price: 5000,
        },
        {
          groupId: uuidv4(),
          groupName: 'Special Request',
          optionId: uuidv4(),
          optionName: 'Extra Toppings',
          price: 3000,
        },
      ];

      const totalPrice = testOrder.price + 5000 + 3000; // item price + modifiers

      // Insert order
      await client.query(
        `INSERT INTO orders
        (id, customer_id, restaurant_id, restaurant_name, cart_id, status, total_amount, shipping_fee,
         discount_amount, payment_method, delivery_address, created_at, version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          orderId,
          customerId,
          restaurantId,
          'The Green Bistro',
          cartId,
          testOrder.status,
          totalPrice + 18000, // total + shipping
          18000, // shipping
          5000, // discount
          'cod',
          JSON.stringify({
            street: '456 Le Loi',
            district: 'District 1',
            city: 'Ho Chi Minh',
            latitude: 10.7769,
            longitude: 106.7009,
          }),
          new Date(),
          0,
        ]
      );

      // Insert order item with real menu item ID
      await client.query(
        `INSERT INTO order_items
        (id, order_id, menu_item_id, item_name, unit_price, modifiers_price, quantity, subtotal, modifiers)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          orderId,
          testOrder.itemId,
          testOrder.itemName,
          testOrder.price,
          8000, // modifiers total (5000 + 3000)
          1,
          totalPrice,
          JSON.stringify(modifiers),
        ]
      );

      // Insert status log
      await client.query(
        `INSERT INTO order_status_logs
        (id, order_id, from_status, to_status, triggered_by_role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          orderId,
          null,
          testOrder.status,
          'system',
          new Date(),
        ]
      );

      console.log(`✅ Created ${testOrder.label} (${testOrder.status})`);
      console.log(`   Item: ${testOrder.itemName} (${testOrder.price.toLocaleString('vi-VN')}đ)`);
      console.log(`   Order ID: ${orderId}\n`);
    }

    console.log('✅ All test orders for The Green Bistro created successfully!');
    console.log('📋 You can now test the kitchen board with real menu items');
  } catch (err) {
    console.error('❌ Error creating test orders:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestOrders();
