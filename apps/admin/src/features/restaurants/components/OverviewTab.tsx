import { useState } from 'react';
import { useRestaurantAnalytics } from '../hooks/useRestaurantAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { RestaurantAnalyticsRange } from '../api/restaurants.api';

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

export function OverviewTab({ restaurantId }: { restaurantId: string }) {
  const [range, setRange] = useState<RestaurantAnalyticsRange>('30d');
  const {
    data: analytics,
    isLoading,
    error,
  } = useRestaurantAnalytics(restaurantId, range);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !analytics) {
    return <div className="text-destructive">Failed to load analytics</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select
          value={range}
          onValueChange={(value) => setRange(value as RestaurantAnalyticsRange)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Restaurant Sales"
          value={vndFormatter.format(analytics.totalRevenue)}
        />
        <StatCard
          title="Total Orders"
          value={analytics.orderCount.toString()}
        />
        <StatCard
          title="Avg Order Value"
          value={vndFormatter.format(analytics.avgOrderValue)}
        />
        <StatCard
          title="Success Rate"
          value={
            analytics.successRate === null ? 'N/A' : `${analytics.successRate}%`
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topItems.length === 0 ? (
              <p className="text-muted-foreground">
                No items sold in this period.
              </p>
            ) : (
              <ul className="space-y-4">
                {analytics.topItems.map((item, idx) => (
                  <li
                    key={`${item.menuItemId}-${item.name}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {idx + 1}. {item.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.quantity} sold
                      </span>
                    </div>
                    <span className="font-semibold">
                      {vndFormatter.format(item.revenue)} gross sales
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div>
                <p className="font-medium">Cancel Rate</p>
                <p className="text-sm text-muted-foreground">
                  Orders cancelled or refunded
                </p>
              </div>
              <span
                className={`text-xl font-bold ${analytics.cancelRate > 5 ? 'text-destructive' : 'text-primary'}`}
              >
                {analytics.cancelRate}%
              </span>
            </div>
            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div>
                <p className="font-medium">Avg Prep Time</p>
                <p className="text-sm text-muted-foreground">
                  Time from confirmed to ready
                </p>
              </div>
              <span className="text-xl font-bold">
                {analytics.avgPrepMinutes !== null
                  ? `${analytics.avgPrepMinutes} min`
                  : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
