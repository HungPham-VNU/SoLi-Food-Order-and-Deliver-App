import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, openAPI, phoneNumber } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { db } from '../drizzle/db';
import * as schema from '../drizzle/schema';

export const APP_ROLES = ['admin', 'restaurant', 'shipper', 'user'] as const;
export type AppRole = (typeof APP_ROLES)[number];

const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Social providers. Each entry is enabled iff both env vars are set —
  // otherwise the plugin throws on boot. Set up in Google Cloud Console:
  //   Authorised redirect URI: http://localhost:3000/api/auth/callback/google
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'uitfood://',
    'exp://**',
    'https://uitfood-web.onrender.com',
    'https://uitfood-admin.onrender.com',
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
    ...(isProduction
      ? {
          defaultCookieAttributes: {
            sameSite: 'none',
            secure: true,
            partitioned: true,
          } as const,
          useSecureCookies: true,
        }
      : {}),
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
