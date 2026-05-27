import { useMemo, useState } from 'react';
import {
  Users as UsersIcon,
  Search,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Store,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useUsers,
  useBanUser,
  useUnbanUser,
  useRemoveUser,
} from '@/features/users/hooks/useUsers';
import type { AdminUser, AppRole } from '@/features/users/api/users.api';
import {
  ROLE_BADGE,
  ROLE_LABELS,
  STATUS_META,
  effectiveRole,
  formatJoinDate,
  getInitials,
  userStatus,
  type UserStatus,
} from '@/features/users/utils/format';
import { UserDetailSheet } from '@/features/users/components/UserDetailSheet';
import { PageHero } from '@/components/layout/PageHero';

const PAGE_SIZE = 20;

type RoleFilter = 'all' | AppRole;

const ROLE_PILLS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'user', label: 'Customer' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'shipper', label: 'Shipper' },
  { id: 'admin', label: 'Admin' },
];

export function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Fetch — server-side filters by role; status + search are client-side.
  const { data, isLoading } = useUsers({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(roleFilter !== 'all' && {
      filterField: 'role' as const,
      filterValue: roleFilter,
    }),
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const filtered = useMemo(() => {
    let result = users;
    if (statusFilter !== 'all') {
      result = result.filter((u) => userStatus(u) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, statusFilter, search]);

  // Summary cards derived from current page — accurate when no filter is set.
  const stats = useMemo(() => {
    const counts: Record<AppRole, number> = {
      user: 0,
      restaurant: 0,
      shipper: 0,
      admin: 0,
    };
    for (const u of users) {
      counts[effectiveRole(u)]++;
    }
    return counts;
  }, [users]);

  const fromIndex = page * PAGE_SIZE + 1;
  const toIndex = Math.min(fromIndex + filtered.length - 1, total);

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Identity"
        title="Users"
        subtitle="Manage accounts, roles, and access across the SoLi platform."
        icon={<UsersIcon className="h-6 w-6" />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard
          icon={<UsersIcon className="h-5 w-5 text-blue-600" />}
          label={roleFilter === 'all' ? 'Total (page)' : 'Filtered total'}
          value={total.toLocaleString()}
          tone="blue"
        />
        <SummaryCard
          icon={<UserIcon className="h-5 w-5 text-gray-600" />}
          label="Customers"
          value={String(stats.user)}
          tone="gray"
        />
        <SummaryCard
          icon={<Store className="h-5 w-5 text-green-600" />}
          label="Restaurants"
          value={String(stats.restaurant)}
          tone="green"
        />
        <SummaryCard
          icon={<Truck className="h-5 w-5 text-blue-600" />}
          label="Shippers"
          value={String(stats.shipper)}
          tone="blue"
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5 text-purple-600" />}
          label="Admins"
          value={String(stats.admin)}
          tone="purple"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          className="rounded-lg border bg-card px-3 py-2 text-sm font-medium text-on-surface"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="unverified">Unverified</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Role pills */}
      <div className="flex flex-wrap items-center gap-2">
        {ROLE_PILLS.map((pill) => {
          const active = roleFilter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => {
                setRoleFilter(pill.id);
                setPage(0);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-on-surface-variant border-border hover:bg-surface-container'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-container/40">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <span className="material-symbols-outlined animate-spin text-3xl">
                      progress_activity
                    </span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    No users match the current filters
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onSelect={() => setSelectedUser(u)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && total > 0 && (
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {fromIndex}–{toIndex} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <UserDetailSheet
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// User row
// ---------------------------------------------------------------------------

function UserRow({
  user,
  onSelect,
}: {
  user: AdminUser;
  onSelect: () => void;
}) {
  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();
  const removeMutation = useRemoveUser();

  const role = effectiveRole(user);
  const status = userStatus(user);

  return (
    <tr
      onClick={onSelect}
      className="border-b last:border-b-0 hover:bg-surface-container/30 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="bg-primary-200 text-primary text-sm font-bold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-on-surface truncate max-w-[200px]">
              {user.name}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge className={`${ROLE_BADGE[role]} hover:${ROLE_BADGE[role]}`}>
          {ROLE_LABELS[role]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge
          className={`${STATUS_META[status].badge} hover:${STATUS_META[status].badge} gap-1.5`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`} />
          {STATUS_META[status].label}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {formatJoinDate(user.createdAt)}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onSelect}>
            View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onSelect}>
                  <Eye className="mr-2 h-4 w-4" />
                  View details
                </DropdownMenuItem>
                {user.banned ? (
                  <DropdownMenuItem
                    onClick={() => unbanMutation.mutate(user.id)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                    Unban user
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      banMutation.mutate({
                        userId: user.id,
                        banExpiresIn: 7 * 24 * 60 * 60,
                      })
                    }
                  >
                    <Ban className="mr-2 h-4 w-4 text-amber-600" />
                    Suspend 7d
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete "${user.name}"? This permanently removes the user and all associated data.`,
                      )
                    ) {
                      removeMutation.mutate(user.id);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete user
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'gray' | 'green' | 'blue' | 'purple';
}

function SummaryCard({ icon, label, value, tone }: SummaryCardProps) {
  const bg: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${bg[tone]}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-on-surface truncate">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
