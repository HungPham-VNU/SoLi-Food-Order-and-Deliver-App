import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

type Direction = 'source-to-target' | 'target-to-source';

interface ImageRow {
  id: string;
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  created_at: string;
}

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
const direction = (process.env.MEDIA_SYNC_DIRECTION ??
  'source-to-target') as Direction;
const verifyOnly = process.env.MEDIA_SYNC_VERIFY_ONLY === 'true';
const batchSize = Number(process.env.MEDIA_SYNC_BATCH_SIZE ?? 500);

if (!sourceUrl || !targetUrl) {
  throw new Error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required.');
}
if (!['source-to-target', 'target-to-source'].includes(direction)) {
  throw new Error(`Unsupported MEDIA_SYNC_DIRECTION: ${direction}`);
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
  throw new Error('MEDIA_SYNC_BATCH_SIZE must be an integer from 1 to 5000.');
}

const source = new Pool({
  connectionString: sourceUrl,
  options: '-c timezone=UTC',
});
const target = new Pool({
  connectionString: targetUrl,
  options: '-c timezone=UTC',
});

async function readBatch(
  client: Pool | PoolClient,
  afterId: string,
): Promise<ImageRow[]> {
  const result = await client.query<ImageRow>(
    `select id::text, public_id, secure_url, width, height,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
       from images
      where id::text > $1
      order by id::text
      limit $2`,
    [afterId, batchSize],
  );
  return result.rows;
}

async function copyBatch(
  destination: PoolClient,
  rows: ImageRow[],
  includeIdempotencyKey: boolean,
): Promise<void> {
  for (const row of rows) {
    if (includeIdempotencyKey) {
      await destination.query(
        `insert into images
           (id, public_id, secure_url, width, height, idempotency_key, created_at)
         values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
         on conflict (id) do update set
           public_id = excluded.public_id,
           secure_url = excluded.secure_url,
           width = excluded.width,
           height = excluded.height,
           created_at = excluded.created_at`,
        [
          row.id,
          row.public_id,
          row.secure_url,
          row.width,
          row.height,
          `legacy:${row.id}`,
          row.created_at,
        ],
      );
      continue;
    }

    await destination.query(
      `insert into images (id, public_id, secure_url, width, height, created_at)
       values ($1, $2, $3, $4, $5, $6::timestamp)
       on conflict (id) do update set
         public_id = excluded.public_id,
         secure_url = excluded.secure_url,
         width = excluded.width,
         height = excluded.height,
         created_at = excluded.created_at`,
      [
        row.id,
        row.public_id,
        row.secure_url,
        row.width,
        row.height,
        row.created_at,
      ],
    );
  }
}

async function copyAll(
  from: Pool,
  to: Pool,
  toMedia: boolean,
): Promise<number> {
  let copied = 0;
  let afterId = '';
  while (true) {
    const rows = await readBatch(from, afterId);
    if (rows.length === 0) return copied;

    const destination = await to.connect();
    try {
      await destination.query('begin');
      await copyBatch(destination, rows, toMedia);
      await destination.query('commit');
    } catch (error) {
      await destination.query('rollback');
      throw error;
    } finally {
      destination.release();
    }

    copied += rows.length;
    afterId = rows.at(-1)!.id;
  }
}

async function fingerprint(database: Pool) {
  const hash = createHash('sha256');
  let count = 0;
  let afterId = '';
  while (true) {
    const rows = await readBatch(database, afterId);
    if (rows.length === 0) break;
    for (const row of rows) {
      hash.update(JSON.stringify(row));
      hash.update('\n');
      count += 1;
    }
    afterId = rows.at(-1)!.id;
  }
  return { count, sha256: hash.digest('hex') };
}

async function main(): Promise<void> {
  const from = direction === 'source-to-target' ? source : target;
  const to = direction === 'source-to-target' ? target : source;
  const copied = verifyOnly
    ? 0
    : await copyAll(from, to, direction === 'source-to-target');
  const [sourceFingerprint, targetFingerprint] = await Promise.all([
    fingerprint(source),
    fingerprint(target),
  ]);
  const matches =
    sourceFingerprint.count === targetFingerprint.count &&
    sourceFingerprint.sha256 === targetFingerprint.sha256;

  console.log(
    JSON.stringify(
      {
        direction,
        verifyOnly,
        copied,
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
