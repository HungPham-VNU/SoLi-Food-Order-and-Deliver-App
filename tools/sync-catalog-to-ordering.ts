import { Pool } from 'pg';

async function sync() {
  const rootEnv = require('fs')
    .readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8')
    .split(/\r?\n/)
    .reduce((env: Record<string, string>, line: string) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;
      const assignment = trimmed.replace(/^export\s+/, '');
      const equalsIndex = assignment.indexOf('=');
      if (equalsIndex === -1) return env;
      env[assignment.slice(0, equalsIndex).trim()] = assignment.slice(equalsIndex + 1).trim();
      return env;
    }, {});

  const host = process.env.DB_PUSH_POSTGRES_HOST || rootEnv.DB_PUSH_POSTGRES_HOST || 'localhost';
  const port = process.env.DB_PUSH_POSTGRES_PORT || rootEnv.DB_PUSH_POSTGRES_PORT || '5432';

  const catalogPool = new Pool({
    connectionString: rootEnv.CATALOG_DATABASE_URL || `postgresql://uitfood_catalog:catalog_secret@${host}:${port}/uitfood_catalog`,
  });

  const orderingPool = new Pool({
    connectionString: rootEnv.ORDERING_DATABASE_URL || `postgresql://uitfood_ordering:ordering_secret@${host}:${port}/uitfood_ordering`,
  });

  const notifPool = new Pool({
    connectionString: rootEnv.NOTIFICATION_DATABASE_URL || `postgresql://uitfood_notification:notification_secret@${host}:${port}/uitfood_notification`,
  });

  try {
    console.log('Fetching restaurants from catalog...');
    const res = await catalogPool.query('SELECT * FROM restaurants');
    let orderingRestCount = 0;
    let notifRestCount = 0;

    for (const row of res.rows) {
      // Insert to ordering
      const orderingRes = await orderingPool.query(`
        INSERT INTO ordering_restaurant_snapshots (restaurant_id, name, is_open, is_approved, address, cuisine_type, latitude, longitude, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (restaurant_id) DO NOTHING
      `, [row.id, row.name, row.is_open, row.is_approved, row.address, row.cuisine_type, row.latitude, row.longitude, row.owner_id]);
      orderingRestCount += orderingRes.rowCount || 0;

      // Insert to notif
      const notifRes = await notifPool.query(`
        INSERT INTO notification_restaurant_snapshots (restaurant_id, name, logo_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (restaurant_id) DO NOTHING
      `, [row.id, row.name, row.logo_url]);
      notifRestCount += notifRes.rowCount || 0;
    }
    console.log(`Inserted ${orderingRestCount} restaurants to ordering DB, ${notifRestCount} to notification DB.`);

    console.log('Fetching delivery zones from catalog...');
    const zones = await catalogPool.query('SELECT * FROM delivery_zones');
    let zoneCount = 0;
    for (const row of zones.rows) {
      const zRes = await orderingPool.query(`
        INSERT INTO ordering_delivery_zone_snapshots (zone_id, restaurant_id, radius_km, base_fee, per_km_rate, avg_speed_kmh, prep_time_minutes, buffer_minutes, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (zone_id) DO NOTHING
      `, [row.id, row.restaurant_id, row.radius_km, row.base_fee, row.per_km_rate, row.avg_speed_kmh, row.prep_time_minutes, row.buffer_minutes, row.is_active]);
      zoneCount += zRes.rowCount || 0;
    }
    console.log(`Inserted ${zoneCount} delivery zones to ordering DB.`);

    console.log('Fetching menu items from catalog...');
    const items = await catalogPool.query('SELECT * FROM menu_items');
    let itemCount = 0;
    for (const row of items.rows) {
      const modifiersRes = await catalogPool.query('SELECT * FROM modifier_groups WHERE menu_item_id = $1 ORDER BY display_order ASC', [row.id]);
      const modifiers = [];
      for (const group of modifiersRes.rows) {
        const optionsRes = await catalogPool.query('SELECT * FROM modifier_options WHERE group_id = $1 ORDER BY display_order ASC', [group.id]);
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          minSelections: group.min_selections,
          maxSelections: group.max_selections,
          options: optionsRes.rows.map((o: any) => ({
            optionId: o.id,
            optionName: o.name,
            price: o.price,
            isAvailable: o.is_available,
            isDefault: o.is_default
          }))
        });
      }

      const mRes = await orderingPool.query(`
        INSERT INTO ordering_menu_item_snapshots (menu_item_id, restaurant_id, name, price, status, modifiers)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (menu_item_id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          status = EXCLUDED.status,
          modifiers = EXCLUDED.modifiers
      `, [row.id, row.restaurant_id, row.name, row.price, row.status || (row.is_available ? 'available' : 'unavailable'), JSON.stringify(modifiers)]);
      itemCount += mRes.rowCount || 0;
    }
    console.log(`Upserted ${items.rows.length} menu items to ordering DB.`);
  } catch (error) {
    console.error('Failed to sync snapshots:', error);
  } finally {
    await catalogPool.end();
    await orderingPool.end();
    await notifPool.end();
  }
}

sync().then(() => console.log('Done.')).catch(console.error);
