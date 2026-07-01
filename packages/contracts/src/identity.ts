import { z } from 'zod';

export const IDENTITY_RPC_PATTERNS = {
  proxyAuthHttp: 'identity.auth.http.v1',
  introspectSession: 'identity.session.introspect.v1',
  getUserContact: 'identity.user.contact.get.v1',
  promoteUserToRestaurant: 'identity.user.role.promote-restaurant.v1',
} as const;

const headerValueSchema = z.union([z.string(), z.array(z.string())]);

export const identityHeaderMapSchema = z.record(
  z.string().min(1),
  headerValueSchema,
);

export const identityHttpRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
  url: z.string().min(1),
  headers: identityHeaderMapSchema.default({}),
  bodyBase64: z.string().optional(),
});

export const identityHttpResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  headers: identityHeaderMapSchema.default({}),
  bodyBase64: z.string().default(''),
});

export const identitySessionIntrospectRequestSchema = z.object({
  headers: identityHeaderMapSchema.default({}),
  correlationId: z.string().min(1).optional(),
});

export const identitySessionIntrospectResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.string().min(1),
      email: z.string().email().nullable().optional(),
      role: z.union([z.string(), z.array(z.string())]).nullable().optional(),
    })
    .nullable(),
  session: z
    .object({
      id: z.string().min(1).optional(),
      expiresAt: z.string().optional(),
    })
    .nullable(),
});

export const identityUserContactRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const identityUserContactResponseSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  phoneNumber: z.string().nullable(),
  role: z.string().nullable(),
});

export const identityPromoteToRestaurantRequestSchema = z.object({
  userId: z.string().uuid(),
  correlationId: z.string().min(1).optional(),
  causationId: z.string().min(1).nullable().optional(),
  traceparent: z.string().nullable().optional(),
});

export const identityPromoteToRestaurantResponseSchema = z.object({
  userId: z.string().uuid(),
  role: z.literal('restaurant'),
  changed: z.boolean(),
});

export const identityRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type IdentityHeaderMap = z.infer<typeof identityHeaderMapSchema>;
export type IdentityHttpRequest = z.infer<typeof identityHttpRequestSchema>;
export type IdentityHttpResponse = z.infer<typeof identityHttpResponseSchema>;
export type IdentitySessionIntrospectRequest = z.infer<
  typeof identitySessionIntrospectRequestSchema
>;
export type IdentitySessionIntrospectResponse = z.infer<
  typeof identitySessionIntrospectResponseSchema
>;
export type IdentityUserContactRequest = z.infer<
  typeof identityUserContactRequestSchema
>;
export type IdentityUserContactResponse = z.infer<
  typeof identityUserContactResponseSchema
>;
export type IdentityPromoteToRestaurantRequest = z.infer<
  typeof identityPromoteToRestaurantRequestSchema
>;
export type IdentityPromoteToRestaurantResponse = z.infer<
  typeof identityPromoteToRestaurantResponseSchema
>;
export type IdentityRpcError = z.infer<typeof identityRpcErrorSchema>;
