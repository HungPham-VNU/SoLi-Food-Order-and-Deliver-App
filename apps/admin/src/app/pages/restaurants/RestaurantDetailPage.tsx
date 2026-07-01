import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Loader2,
  MapPin,
  Phone,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuTab } from '@/features/restaurants/components/MenuTab';
import { OrdersTab } from '@/features/restaurants/components/OrdersTab';
import { OverviewTab } from '@/features/restaurants/components/OverviewTab';
import { ReviewsTab } from '@/features/restaurants/components/ReviewsTab';
import { useRestaurantDetail } from '@/features/restaurants/hooks/useRestaurantDetail';
import {
  useApproveRestaurant,
  useUnapproveRestaurant,
} from '@/features/restaurants/hooks/useRestaurants';
import { useUser } from '@/features/users/hooks/useUsers';

export function RestaurantDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: restaurant, isLoading, error } = useRestaurantDetail(id);
  const { data: owner, isLoading: isOwnerLoading } = useUser(
    restaurant?.ownerId,
  );
  const approveMutation = useApproveRestaurant();
  const unapproveMutation = useUnapproveRestaurant();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <p className="font-medium text-destructive">
          Failed to load restaurant details.
        </p>
        <Button asChild variant="outline">
          <Link to="/restaurants">Back to Restaurants</Link>
        </Button>
      </div>
    );
  }

  const isUpdatingApproval =
    approveMutation.isPending || unapproveMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/restaurants" aria-label="Back to restaurants">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Restaurant Details
        </h1>
      </div>

      <section className="overflow-hidden rounded-lg border bg-surface-container shadow-sm">
        <div className="relative h-36 bg-gradient-to-br from-primary-200 to-primary-100">
          {restaurant.coverImageUrl ? (
            <img
              src={restaurant.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-6 p-6 md:flex-row">
          {restaurant.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={`${restaurant.name} logo`}
              className="h-24 w-24 rounded-lg border bg-background object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
              No logo
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold">{restaurant.name}</h2>
              <Badge
                variant={
                  restaurant.isApproved
                    ? restaurant.isOpen
                      ? 'default'
                      : 'secondary'
                    : 'destructive'
                }
              >
                {restaurant.isApproved
                  ? restaurant.isOpen
                    ? 'Open'
                    : 'Closed'
                  : 'Pending'}
              </Badge>
              {restaurant.cuisineType ? (
                <Badge variant="outline">{restaurant.cuisineType}</Badge>
              ) : null}
            </div>
            {restaurant.description ? (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {restaurant.description}
              </p>
            ) : null}
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{restaurant.address}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{restaurant.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Submitted {new Date(restaurant.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="rounded-md border bg-background/60 p-3 text-sm">
              <p className="font-medium">
                {isOwnerLoading
                  ? 'Loading owner…'
                  : owner?.name || 'Unknown owner'}
              </p>
              <p className="text-muted-foreground">
                {owner?.email || restaurant.ownerId}
              </p>
            </div>
            <div className="pt-2">
              {restaurant.isApproved ? (
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={isUpdatingApproval}
                  onClick={() => unapproveMutation.mutate(restaurant.id)}
                >
                  <XCircle className="h-4 w-4" />
                  {unapproveMutation.isPending ? 'Suspending…' : 'Suspend'}
                </Button>
              ) : (
                <Button
                  className="gap-2"
                  disabled={isUpdatingApproval}
                  onClick={() => approveMutation.mutate(restaurant.id)}
                >
                  <CheckCircle className="h-4 w-4" />
                  {approveMutation.isPending ? 'Approving…' : 'Approve'}
                </Button>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              ID: {restaurant.id} • Owner ID: {restaurant.ownerId}
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 h-auto border bg-surface-container p-1">
          <TabsTrigger value="overview" className="px-6 py-2">
            Overview
          </TabsTrigger>
          <TabsTrigger value="menu" className="px-6 py-2">
            Menu
          </TabsTrigger>
          <TabsTrigger value="orders" className="px-6 py-2">
            Orders
          </TabsTrigger>
          <TabsTrigger value="reviews" className="px-6 py-2">
            Reviews
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-0 outline-none">
          <OverviewTab restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="menu" className="mt-0 outline-none">
          <MenuTab restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="orders" className="mt-0 outline-none">
          <OrdersTab restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="reviews" className="mt-0 outline-none">
          <ReviewsTab restaurantId={restaurant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
