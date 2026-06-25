import { z } from 'zod';
import { EVENT_NAMES } from '../event-names';

export const IDENTITY_USER_CONTACT_CHANGED_V1 = {
  eventType: EVENT_NAMES.IdentityUserContactChanged,
  version: 1,
  schema: z.object({
    userId: z.string().uuid(),
    email: z.string().email().nullable(),
    phoneNumber: z.string().nullable(),
    emailVerified: z.boolean(),
    phoneNumberVerified: z.boolean(),
  }),
} as const;

export const IDENTITY_USER_ROLE_CHANGED_V1 = {
  eventType: EVENT_NAMES.IdentityUserRoleChanged,
  version: 1,
  schema: z.object({
    userId: z.string().uuid(),
    role: z.string().nullable(),
  }),
} as const;

export type IdentityUserContactChangedV1 = z.infer<
  typeof IDENTITY_USER_CONTACT_CHANGED_V1.schema
>;
export type IdentityUserRoleChangedV1 = z.infer<
  typeof IDENTITY_USER_ROLE_CHANGED_V1.schema
>;
