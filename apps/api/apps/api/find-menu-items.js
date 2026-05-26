const { Pool } = require('pg');

const pool = new Pool({
  user: 'food_order',
  password: 'foodordersecret',
  host: 'localhost',
  port: 5432,
  database: 'food_order_db',
});

async function findMenuItems() {
  try {
    const result = await pool.query(
      `SELECT id, name, "basePrice" FROM menu_items WHERE restaurant_id = $1 LIMIT 4`,
      ['722b1275-7f60-418c-8f06-03caa3d891a5']
    );

    console.log('Menu items for The Green Bistro:');
    if (result.rows.length === 0) {
      console.log('No menu items found');
    } else {
      result.rows.forEach((item, i) => {
        console.log(`${i + 1}. ${item.name} (ID: ${item.id}, Price: ${item.basePrice})`);
      });
    }

    console.log('\nJSON:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

findMenuItems();
