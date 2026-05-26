const { Pool } = require('pg');

const pool = new Pool({
  user: 'food_order',
  password: 'foodordersecret',
  host: 'localhost',
  port: 5432,
  database: 'food_order_db',
});

async function findRestaurant() {
  try {
    const result = await pool.query(
      'SELECT id, name, owner_id FROM restaurants WHERE owner_id = $1',
      ['f7b932fa-ace3-4524-b3eb-b9a6e15891fd']
    );
    console.log('Restaurants owned by user f7b932fa-ace3-4524-b3eb-b9a6e15891fd:');
    console.log(JSON.stringify(result.rows, null, 2));

    if (result.rows.length === 0) {
      console.log('\n❌ No restaurants found for this user');
    } else {
      console.log(`\n✅ Found ${result.rows.length} restaurant(s)`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

findRestaurant();
