const { Pool } = require('pg');
const crypto = require('crypto');

function uuidv4() {
  return crypto.randomUUID();
}

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
    // The Green Bistro restaurant
    const restaurantId = '722b1275-7f60-418c-8f06-03caa3d891a5';
    const customerId = '22222222-2222-4222-8222-222222222222'; // Test customer

    // Create 4 test orders with different statuses
    const testOrders = [
      { status: 'pending', label: 'Pending Order', name: 'Green Salad Bowl' },
      { status: 'confirmed', label: 'Confirmed Order', name: 'Vegan Buddha Bowl' },
      { status: 'preparing', label: 'Preparing Order', name: 'Organic Vegetable Stir-fry' },
      { status: 'ready_for_pickup', label: 'Ready Order', name: 'Green Smoothie Bowl' },
    ];

    console.log('🍽️  Creating test orders for The Green Bistro...\n');

    for (const testOrder of testOrders) {
      const orderId = uuidv4();
      const cartId = uuidv4();
      const menuItemId = uuidv4();

      const modifiers = [
        { groupId: uuidv4(), groupName: 'Dressing', optionId: uuidv4(), optionName: 'Vinaigrette', price: 0 },
        { groupId: uuidv4(), groupName: 'Protein', optionId: uuidv4(), optionName: 'Tofu', price: 8000 },
        { groupId: uuidv4(), groupName: 'Add-ons', optionId: uuidv4(), optionName: 'Nuts Mix', price: 5000 },
      ];

      // Insert order
      await client.query(
        `INSERT INTO orders (id, customer_id, restaurant_id, restaurant_name, cart_id, status, total_amount,
         shipping_fee, discount_amount, payment_method, delivery_address, created_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [orderId, customerId, restaurantId, 'The Green Bistro', cartId, testOrder.status, 145000, 18000, 12000,
         'cod', JSON.stringify({ street: '456 Le Loi', district: 'District 1', city: 'Ho Chi Minh', latitude: 10.7769, longitude: 106.7009 }),
         new Date(), 0]
      );

      // Insert order item
      await client.query(
        `INSERT INTO order_items (id, order_id, menu_item_id, item_name, unit_price, modifiers_price, quantity, subtotal, modifiers)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), orderId, menuItemId, testOrder.name, 128000, 13000, 1, 141000, JSON.stringify(modifiers)]
      );

      // Insert status log
      await client.query(
        `INSERT INTO order_status_logs (id, order_id, from_status, to_status, triggered_by_role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), orderId, null, testOrder.status, 'system', new Date()]
      );

      console.log(`✅ Created ${testOrder.label} (${testOrder.status}): ${orderId}`);
    }

    console.log('\n✅ All test orders for The Green Bistro created successfully!');
  } catch (err) {
    console.error('❌ Error creating test orders:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestOrders();
