import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
