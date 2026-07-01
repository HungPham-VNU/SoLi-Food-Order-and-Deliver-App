import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../auth/auth.schema';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://uitfood_identity:identity_secret@localhost:5432/uitfood_identity';

const adminEmail = process.env.IDENTITY_ADMIN_EMAIL || 'admin@soli.dev';
const adminPassword = process.env.IDENTITY_ADMIN_PASSWORD || 'admin1234';
const adminName = process.env.IDENTITY_ADMIN_NAME || 'Soli Admin';

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

async function seedAdminAccount() {
  const now = new Date();
  const passwordHash = await hashPassword(adminPassword);

  const existingUser = await db.query.user.findFirst({
    where: eq(schema.user.email, adminEmail),
  });

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;

    await db
      .update(schema.user)
      .set({
        name: existingUser.name || adminName,
        role: 'admin',
        emailVerified: true,
        updatedAt: now,
      })
      .where(eq(schema.user.id, userId));

    console.log(`Updated existing admin user: ${adminEmail}`);
  } else {
    const [createdUser] = await db
      .insert(schema.user)
      .values({
        name: adminName,
        email: adminEmail,
        role: 'admin',
        emailVerified: true,
        updatedAt: now,
      })
      .returning({ id: schema.user.id });

    if (!createdUser) {
      throw new Error('Failed to create admin user');
    }

    userId = createdUser.id;
    console.log(`Created admin user: ${adminEmail}`);
  }

  const credentialAccount = await db.query.account.findFirst({
    where: and(
      eq(schema.account.userId, userId),
      eq(schema.account.providerId, 'credential'),
    ),
  });

  if (credentialAccount) {
    await db
      .update(schema.account)
      .set({
        accountId: userId,
        password: passwordHash,
        updatedAt: now,
      })
      .where(eq(schema.account.id, credentialAccount.id));

    console.log('Updated admin credential account password.');
  } else {
    await db.insert(schema.account).values({
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
      updatedAt: now,
    });

    console.log('Created admin credential account.');
  }
}

void seedAdminAccount()
  .then(async () => {
    console.log('Admin account seed completed.');
    await pool.end();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('Admin account seed failed:', error);
    await pool.end();
    process.exit(1);
  });
