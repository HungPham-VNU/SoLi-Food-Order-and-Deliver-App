import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function seedAdmin() {
  const email = 'admin@soli.dev';
  const rawPassword = 'admin1234';
  const role = 'admin';
  const name = 'System Admin';

  console.log(`Checking if admin user ${email} exists...`);

  const existingUsers = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  const now = new Date();

  if (existingUsers.length > 0) {
    const existingUser = existingUsers[0];
    console.log(`User ${email} already exists. Updating name, role, and emailVerified status...`);

    // Update user role and status
    await db
      .update(schema.user)
      .set({
        name,
        role,
        emailVerified: true,
        updatedAt: now,
      })
      .where(eq(schema.user.id, existingUser.id));

    // Update password in account table
    const hashedPassword = await hashPassword(rawPassword);
    const existingAccounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, existingUser.id))
      .limit(1);

    if (existingAccounts.length > 0) {
      await db
        .update(schema.account)
        .set({
          password: hashedPassword,
          updatedAt: now,
        })
        .where(eq(schema.account.id, existingAccounts[0].id));
      console.log(`Updated existing credential password for admin.`);
    } else {
      await db.insert(schema.account).values({
        id: uuidv4(),
        accountId: existingUser.id,
        providerId: 'credential',
        userId: existingUser.id,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`Created credential record for existing user.`);
    }

    console.log(`✅ Admin account updated successfully!`);
  } else {
    // Create new admin
    const userId = uuidv4();
    const accountId = uuidv4();
    const hashedPassword = await hashPassword(rawPassword);

    console.log(`Creating new admin user: ${email}...`);

    await db.insert(schema.user).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      role,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.account).values({
      id: accountId,
      accountId: userId,
      providerId: 'credential',
      userId: userId,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅ Admin account created successfully!`);
  }
}

seedAdmin()
  .then(() => {
    console.log('✨ Admin seeding process finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Admin seeding failed:', err);
    process.exit(1);
  });
