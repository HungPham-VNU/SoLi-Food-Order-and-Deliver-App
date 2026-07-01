import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi, OrderStatus } from '@/features/orders/api/orders.api';
import { OrderDetailSheet } from '@/features/orders/components/OrderDetailSheet';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationControls } from './PaginationControls';

const PAGE_SIZE = 25;

export function OrdersTab({ restaurantId }: { restaurantId: string }) {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['restaurant-orders', restaurantId, status, page],
    queryFn: () =>
      ordersApi.list({
        restaurantId,
        status: status === 'all' ? undefined : status,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const orders = ordersData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface-container p-4 rounded-lg">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as OrderStatus | 'all');
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="delivering">Delivering</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          Total Orders:{' '}
          <span className="font-semibold text-foreground">
            {ordersData?.total || 0}
          </span>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.orderId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedOrderId(order.orderId)}
                >
                  <TableCell className="font-medium text-xs">
                    {order.orderId.split('-')[0]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{order.itemCount} items</TableCell>
                  <TableCell className="uppercase">
                    {order.paymentMethod}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat('vi-VN', {
                      style: 'currency',
                      currency: 'VND',
                    }).format(order.totalAmount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          total={ordersData?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      {selectedOrderId ? (
        <OrderDetailSheet
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      ) : null}
    </div>
  );
}
