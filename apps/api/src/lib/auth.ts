import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, openAPI, phoneNumber } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { db } from '../drizzle/db';
import * as schema from '../drizzle/schema';

export const APP_ROLES = ['admin', 'restaurant', 'shipper', 'user'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    'http://localhost:5173',
    'uitfood://',
    'exp://**',
  ],
  plugins: [
    openAPI(),
    bearer(),
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    phoneNumber({
      sendOTP: ({ phoneNumber, code }, _request) => {
        // TODO: Implement real SMS provider (Twilio, Vonage, etc.)
        console.log(`[AUTH] Sending OTP ${code} to ${phoneNumber}`);
      },
    }),
    expo(),
  ],
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
