import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

type Direction = 'source-to-target' | 'target-to-source';

interface TableSpec {
  table: string;
  columns: string[];
  conflictColumns: string[];
  orderColumn: string;
}

type Row = Record<string, unknown>;

const tables: TableSpec[] = [
  {
    table: 'notifications',
    columns: [
      'id',
      'recipient_id',
      'recipient_role',
      'type',
      'channel',
      'title',
      'body',
      'data',
      'status',
      'is_read',
      'read_at',
      'order_id',
      'idempotency_key',
      'delivery_attempts',
      'last_attempt_at',
      'next_retry_at',
      'created_at',
      'sent_at',
      'expires_at',
    ],
    conflictColumns: ['id'],
    orderColumn: 'id',
  },
  {
    table: 'notification_preferences',
    columns: [
      'id',
      'user_id',
      'push_enabled',
      'in_app_enabled',
      'email_enabled',
      'sms_enabled',
      'quiet_hours_start',
      'quiet_hours_end',
      'muted_types',
      'email',
      'timezone',
      'created_at',
      'updated_at',
    ],
    conflictColumns: ['user_id'],
    orderColumn: 'user_id',
  },
  {
    table: 'notification_delivery_logs',
    columns: [
      'id',
      'notification_id',
      'channel',
      'status',
      'attempt_number',
      'error_code',
      'error_message',
      'attempted_at',
    ],
    conflictColumns: ['id'],
    orderColumn: 'id',
  },
  {
    table: 'device_tokens',
    columns: [
      'id',
      'user_id',
      'token',
      'platform',
      'is_active',
      'last_seen_at',
      'created_at',
    ],
    conflictColumns: ['user_id', 'token'],
    orderColumn: 'id',
  },
  {
    table: 'notification_restaurant_snapshots',
    columns: ['restaurant_id', 'owner_id', 'name', 'last_synced_at'],
    conflictColumns: ['restaurant_id'],
    orderColumn: 'restaurant_id',
  },
];

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
const direction = (process.env.NOTIFICATION_SYNC_DIRECTION ??
  'source-to-target') as Direction;
const verifyOnly = process.env.NOTIFICATION_SYNC_VERIFY_ONLY === 'true';
const syncContactProjection =
  process.env.NOTIFICATION_SYNC_CONTACT_PROJECTION === 'true';
const batchSize = Number(process.env.NOTIFICATION_SYNC_BATCH_SIZE ?? 500);

if (!sourceUrl || !targetUrl) {
  throw new Error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required.');
}
if (!['source-to-target', 'target-to-source'].includes(direction)) {
  throw new Error(`Unsupported NOTIFICATION_SYNC_DIRECTION: ${direction}`);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
  throw new Error(
    'NOTIFICATION_SYNC_BATCH_SIZE must be an integer from 1 to 5000.',
  );
}

const source = new Pool({
  connectionString: sourceUrl,
  options: '-c timezone=UTC',
});
const target = new Pool({
  connectionString: targetUrl,
  options: '-c timezone=UTC',
});

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function columnList(columns: string[]): string {
  return columns.map(quoteIdentifier).join(', ');
}

async function readBatch(
  client: Pool | PoolClient,
  spec: TableSpec,
  afterValue: string,
): Promise<Row[]> {
  const columns = columnList(spec.columns);
  const orderColumn = quoteIdentifier(spec.orderColumn);
  const result = await client.query<Row>(
    `select ${columns}
       from ${quoteIdentifier(spec.table)}
      where ${orderColumn}::text > $1
      order by ${orderColumn}::text
      limit $2`,
    [afterValue, batchSize],
  );
  return result.rows;
}

async function copyBatch(
  destination: PoolClient,
  spec: TableSpec,
  rows: Row[],
): Promise<void> {
  if (rows.length === 0) return;

  const insertColumns = columnList(spec.columns);
  const placeholders = spec.columns
    .map((_, index) => `$${index + 1}`)
    .join(', ');
  const conflictTarget = spec.conflictColumns.map(quoteIdentifier).join(', ');
  const updateColumns = spec.columns.filter(
    (column) => !spec.conflictColumns.includes(column) && column !== 'id',
  );
  const updateSet = updateColumns
    .map(
      (column) =>
        `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`,
    )
    .join(', ');

  const sql =
    updateSet.length === 0
      ? `insert into ${quoteIdentifier(spec.table)} (${insertColumns})
         values (${placeholders})
         on conflict (${conflictTarget}) do nothing`
      : `insert into ${quoteIdentifier(spec.table)} (${insertColumns})
         values (${placeholders})
         on conflict (${conflictTarget}) do update set ${updateSet}`;

  for (const row of rows) {
    await destination.query(
      sql,
      spec.columns.map((column) => row[column]),
    );
  }
}

async function copyTable(
  from: Pool,
  to: Pool,
  spec: TableSpec,
): Promise<number> {
  let copied = 0;
  let afterValue = '';

  while (true) {
    const rows = await readBatch(from, spec, afterValue);
    if (rows.length === 0) return copied;

    const destination = await to.connect();
    try {
      await destination.query('begin');
      await copyBatch(destination, spec, rows);
      await destination.query('commit');
    } catch (error) {
      await destination.query('rollback');
      throw error;
    } finally {
      destination.release();
    }

    copied += rows.length;
    afterValue = String(rows.at(-1)![spec.orderColumn]);
  }
}

async function readContactBatch(
  client: Pool | PoolClient,
  afterUserId: string,
): Promise<Array<{ user_id: string; email: string }>> {
  const result = await client.query<{ user_id: string; email: string }>(
    `select id::text as user_id, email
       from "user"
      where id::text > $1
        and email is not null
      order by id::text
      limit $2`,
    [afterUserId, batchSize],
  );
  return result.rows;
}

async function seedContactProjection(from: Pool, to: Pool): Promise<number> {
  let seeded = 0;
  let afterUserId = '';

  while (true) {
    const rows = await readContactBatch(from, afterUserId);
    if (rows.length === 0) return seeded;

    const destination = await to.connect();
    try {
      await destination.query('begin');
      for (const row of rows) {
        await destination.query(
          `insert into notification_preferences
             (user_id, email, push_enabled, in_app_enabled, email_enabled,
              sms_enabled, muted_types, timezone, created_at, updated_at)
           values
             ($1, $2, true, true, true, false, '[]'::jsonb,
              'Asia/Ho_Chi_Minh', now(), now())
           on conflict (user_id) do update set
             email = excluded.email,
             updated_at = now()
           where notification_preferences.email is distinct from excluded.email`,
          [row.user_id, row.email],
        );
      }
      await destination.query('commit');
    } catch (error) {
      await destination.query('rollback');
      throw error;
    } finally {
      destination.release();
    }

    seeded += rows.length;
    afterUserId = rows.at(-1)!.user_id;
  }
}

async function fingerprintTable(database: Pool, spec: TableSpec) {
  const hash = createHash('sha256');
  let count = 0;
  let afterValue = '';

  while (true) {
    const rows = await readBatch(database, spec, afterValue);
    if (rows.length === 0) break;

    for (const row of rows) {
      hash.update(JSON.stringify(row));
      hash.update('\n');
      count += 1;
    }
    afterValue = String(rows.at(-1)![spec.orderColumn]);
  }

  return { count, sha256: hash.digest('hex') };
}

async function main(): Promise<void> {
  const from = direction === 'source-to-target' ? source : target;
  const to = direction === 'source-to-target' ? target : source;
  const copied: Record<string, number> = {};
  let contactProjectionSeeded = 0;

  if (!verifyOnly) {
    for (const spec of tables) {
      copied[spec.table] = await copyTable(from, to, spec);
    }
    if (direction === 'source-to-target' && syncContactProjection) {
      contactProjectionSeeded = await seedContactProjection(from, to);
    }
  }

  const sourceFingerprint: Record<string, { count: number; sha256: string }> =
    {};
  const targetFingerprint: Record<string, { count: number; sha256: string }> =
    {};

  for (const spec of tables) {
    sourceFingerprint[spec.table] = await fingerprintTable(source, spec);
    targetFingerprint[spec.table] = await fingerprintTable(target, spec);
  }

  const matchTables = syncContactProjection
    ? tables.filter((spec) => spec.table !== 'notification_preferences')
    : tables;
  const matches = matchTables.every((spec) => {
    const sourceTable = sourceFingerprint[spec.table];
    const targetTable = targetFingerprint[spec.table];
    return (
      sourceTable.count === targetTable.count &&
      sourceTable.sha256 === targetTable.sha256
    );
  });

  console.log(
    JSON.stringify(
      {
        direction,
        verifyOnly,
        syncContactProjection:
          direction === 'source-to-target' && syncContactProjection,
        matchScope: matchTables.map((spec) => spec.table),
        copied,
        contactProjectionSeeded,
        source: sourceFingerprint,
        target: targetFingerprint,
        matches,
      },
      null,
      2,
    ),
  );
  if (!matches) process.exitCode = 2;
}

void main().finally(async () => {
  await Promise.all([source.end(), target.end()]);
});
