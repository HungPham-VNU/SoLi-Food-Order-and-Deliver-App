import { useState, useMemo } from 'react';
import {
  useRestaurants,
  useApproveRestaurant,
  useUnapproveRestaurant,
  useDeleteRestaurant,
} from '@/features/restaurants/hooks/useRestaurants';
import type { Restaurant } from '@/features/restaurants/api/restaurants.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Download,
  Store,
  LayoutGrid,
  MoreVertical,
  CheckCircle,
  XCircle,
  X,
  MapPin,
  Phone,
  Calendar,
} from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';

const PAGE_SIZE = 20;

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function StatusBadge({ isApproved }: { isApproved: boolean }) {
  if (isApproved) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        Active
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
      Pending Approval
    </Badge>
  );
}

interface DetailSheetProps {
  restaurant: Restaurant | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onUnapprove: (id: string) => void;
  isApproving: boolean;
  isUnapproving: boolean;
}

function RestaurantDetailSheet({
  restaurant,
  onClose,
  onApprove,
  onUnapprove,
  isApproving,
  isUnapproving,
}: DetailSheetProps) {
  return (
    <Sheet open={!!restaurant} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto p-0">
        {restaurant && (
          <>
            <div className="relative h-32 bg-gradient-to-br from-primary-200 to-primary-100 flex-shrink-0">
              {restaurant.coverImageUrl && (
                <img
                  src={restaurant.coverImageUrl}
                  alt="Cover"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 rounded-full bg-black/20 p-1 text-white hover:bg-black/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-0 -mt-8 flex items-end gap-4">
              <Avatar className="h-16 w-16 border-4 border-background shadow-md">
                <AvatarImage src={restaurant.logoUrl ?? undefined} />
                <AvatarFallback className="bg-primary-200 text-primary text-xl font-bold">
                  {getInitials(restaurant.name)}
                </AvatarFallback>
              </Avatar>
              <div className="pb-2 min-w-0">
                <h2 className="text-lg font-bold text-on-surface truncate">
                  {restaurant.name}
                </h2>
                <StatusBadge isApproved={restaurant.isApproved} />
              </div>
            </div>

            <div className="px-6 py-4 space-y-5">
              <div className="space-y-3">
                {restaurant.cuisineType && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-muted-foreground text-base mt-0.5">
                      restaurant
                    </span>
                    <span className="text-on-surface-variant">
                      {restaurant.cuisineType}
                    </span>
                  </div>
                )}
                {restaurant.description && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-muted-foreground text-base mt-0.5">
                      description
                    </span>
                    <span className="text-on-surface-variant leading-relaxed">
                      {restaurant.description}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-on-surface-variant">
                    {restaurant.address}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-on-surface-variant">
                    {restaurant.phone}
                  </span>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ownership
                </h3>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-surface-container text-on-surface-variant text-sm font-medium">
                      OW
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      Owner ID
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {restaurant.ownerId}
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Timeline
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-on-surface-variant">
                    Submitted{' '}
                    <span className="font-medium text-on-surface">
                      {formatRelativeDate(restaurant.createdAt)}
                    </span>{' '}
                    —{' '}
                    {new Date(restaurant.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t bg-background px-6 py-4 flex flex-col gap-2">
              {!restaurant.isApproved ? (
                <Button
                  className="w-full gap-2"
                  onClick={() => onApprove(restaurant.id)}
                  disabled={isApproving}
                >
                  <CheckCircle className="h-4 w-4" />
                  {isApproving ? 'Approving…' : 'Approve Application'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => onUnapprove(restaurant.id)}
                  disabled={isUnapproving}
                >
                  <XCircle className="h-4 w-4" />
                  {isUnapproving ? 'Suspending…' : 'Suspend Restaurant'}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function RestaurantsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const { data, isLoading } = useRestaurants({ limit: PAGE_SIZE });
  const approveMutation = useApproveRestaurant();
  const unapproveMutation = useUnapproveRestaurant();
  const deleteMutation = useDeleteRestaurant();

  const restaurants = useMemo(() => data?.data ?? [], [data?.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return restaurants;
    const q = search.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q) ||
        r.cuisineType?.toLowerCase().includes(q),
    );
  }, [restaurants, search]);

  const stats = useMemo(
    () => ({
      pending: restaurants.filter((r) => !r.isApproved).length,
      active: restaurants.filter((r) => r.isApproved && r.isOpen).length,
      suspended: restaurants.filter((r) => r.isApproved && !r.isOpen).length,
      total: restaurants.length,
    }),
    [restaurants],
  );

  async function handleApprove(id: string) {
    await approveMutation.mutateAsync(id);
    setSelected((prev) => (prev?.id === id ? { ...prev, isApproved: true } : prev));
  }

  async function handleUnapprove(id: string) {
    await unapproveMutation.mutateAsync(id);
    setSelected((prev) => (prev?.id === id ? { ...prev, isApproved: false } : prev));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Catalog"
        title="Restaurants"
        subtitle="Approve new businesses joining the platform and keep the catalog healthy."
        icon={<Store className="h-6 w-6" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={
            <span className="material-symbols-outlined text-amber-600">
              hourglass_empty
            </span>
          }
          label="Pending Approval"
          value={stats.pending}
          color="amber"
        />
        <StatCard
          icon={<Store className="h-5 w-5 text-green-600" />}
          label="Active"
          value={stats.active}
          color="green"
        />
        <StatCard
          icon={
            <span className="material-symbols-outlined text-red-500">
              pause_circle
            </span>
          }
          label="Suspended"
          value={stats.suspended}
          color="red"
        />
        <StatCard
          icon={<LayoutGrid className="h-5 w-5 text-blue-600" />}
          label="Total"
          value={stats.total}
          color="blue"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search restaurants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2 ml-auto">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-container/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Restaurant
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">
                Submitted
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">
                Cuisine
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Actions
              </th>
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
                  No restaurants found
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-b-0 hover:bg-surface-container/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={r.logoUrl ?? undefined} />
                        <AvatarFallback className="bg-primary-200 text-primary text-sm font-bold">
                          {getInitials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-on-surface truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isApproved={r.isApproved} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatRelativeDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {r.cuisineType ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(r)}
                      >
                        Review
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            {!r.isApproved ? (
                              <DropdownMenuItem
                                onClick={() => approveMutation.mutate(r.id)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                Approve
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => unapproveMutation.mutate(r.id)}
                              >
                                <XCircle className="mr-2 h-4 w-4 text-amber-600" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete "${r.name}"? This cannot be undone.`,
                                  )
                                ) {
                                  deleteMutation.mutate(r.id);
                                }
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {data.total} restaurants
          </div>
        )}
      </div>

      <RestaurantDetailSheet
        restaurant={selected}
        onClose={() => setSelected(null)}
        onApprove={handleApprove}
        onUnapprove={handleUnapprove}
        isApproving={approveMutation.isPending}
        isUnapproving={unapproveMutation.isPending}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'amber' | 'green' | 'red' | 'blue';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const bg: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${bg[color]}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-on-surface">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
