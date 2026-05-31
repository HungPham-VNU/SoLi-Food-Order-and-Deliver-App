import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';

export type AppRole = 'admin' | 'restaurant' | 'shipper' | 'user';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: AppRole | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListUsersParams {
  limit?: number;
  offset?: number;
  searchValue?: string;
  searchField?: 'name' | 'email';
  filterField?: 'role' | 'banned';
  filterValue?: string | boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'email';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Thin wrapper around better-auth's admin client plugin. Hides the
 * `authClient.admin.*` namespace and adapts return shapes so React Query
 * hooks can stay simple. All calls require the caller to be an admin —
 * the backend enforces that.
 */
export const usersApi = {
  list: async (params: ListUsersParams = {}): Promise<ListUsersResponse> => {
    const query: Record<string, unknown> = {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      sortBy: params.sortBy ?? 'createdAt',
      sortDirection: params.sortDirection ?? 'desc',
    };
    if (params.searchValue) {
      query.searchValue = params.searchValue;
      query.searchField = params.searchField ?? 'email';
      query.searchOperator = 'contains';
    }
    if (params.filterField && params.filterValue != null) {
      query.filterField = params.filterField;
      query.filterValue = params.filterValue;
      query.filterOperator = 'eq';
    }

    const { data, error } = await (authClient as any).admin.listUsers({ query });
    if (error) throw new Error(error.message ?? 'Failed to list users');
    return data as ListUsersResponse;
  },

  setRole: async (userId: string, role: AppRole): Promise<void> => {
    const { error } = await (authClient as any).admin.setRole({ userId, role });
    if (error) throw new Error(error.message ?? 'Failed to set role');
  },

  banUser: async (userId: string, banReason?: string, banExpiresIn?: number): Promise<void> => {
    const { error } = await (authClient as any).admin.banUser({
      userId,
      ...(banReason && { banReason }),
      ...(banExpiresIn != null && { banExpiresIn }),
    });
    if (error) throw new Error(error.message ?? 'Failed to ban user');
  },

  unbanUser: async (userId: string): Promise<void> => {
    const { error } = await (authClient as any).admin.unbanUser({ userId });
    if (error) throw new Error(error.message ?? 'Failed to unban user');
  },

  removeUser: async (userId: string): Promise<void> => {
    const { error } = await (authClient as any).admin.removeUser({ userId });
    if (error) throw new Error(error.message ?? 'Failed to remove user');
  },

  getUser: async (userId: string): Promise<AdminUser> => {
    const res = await apiClient.get<AdminUser>('/api/auth/admin/get-user', {
      params: { id: userId },
    });
    return res.data;
  },
};
