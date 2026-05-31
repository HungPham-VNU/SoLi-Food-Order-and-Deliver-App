import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useOrderDetail, useOrderTimeline } from "@/features/orders/hooks/useOrders";
import {
  useConfirmOrder,
  useStartPreparing,
  useMarkReady,
  useCancelOrder,
} from "@/features/orders/hooks/useOrderMutations";
import { OrderDetailHeader } from "@/features/orders/components/OrderDetailHeader";
import { OrderDetailItems } from "@/features/orders/components/OrderDetailItems";
import { OrderDetailCustomer } from "@/features/orders/components/OrderDetailCustomer";
import { OrderDetailPayment } from "@/features/orders/components/OrderDetailPayment";
import { OrderDetailHistory } from "@/features/orders/components/OrderDetailHistory";
import { OrderDetailMap } from "@/features/orders/components/OrderDetailMap";
import { OrderDetailNotes } from "@/features/orders/components/OrderDetailNotes";
import { CancelOrderDialog } from "@/features/orders/components/CancelOrderDialog";

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();

  const { data: order, isLoading, isError } = useOrderDetail(orderId);
  const { data: timeline = [] } = useOrderTimeline(orderId);

  const confirm      = useConfirmOrder();
  const startPrepare = useStartPreparing();
  const markReady    = useMarkReady();
  const cancelOrder  = useCancelOrder();

  const isPending =
    confirm.isPending ||
    startPrepare.isPending ||
    markReady.isPending ||
    cancelOrder.isPending;

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground font-body">
        Loading order…
      </div>
    );
  }

  if (isError || !order) {
    return <Navigate to="/orders" replace />;
  }

  const deliveryAddress = order.deliveryAddress || { street: '', district: '', city: '' };
  const { street, district, city } = deliveryAddress;
  const addressStr = [street, district, city].filter(Boolean).join(", ");
  const itemsTotal = order.totalAmount - order.shippingFee;

  const handleCancel = (reason: string, reasonCode: string) => {
    cancelOrder.mutate(
      { id: order.orderId, reason, reasonCode },
      {
        onSuccess: () => {
          setIsCancelDialogOpen(false);
        },
      }
    );
  };

  return (
    <>
      <OrderDetailHeader
        order={order}
        onConfirm={() => confirm.mutate(order.orderId)}
        onStartPreparing={() => startPrepare.mutate(order.orderId)}
        onMarkReady={() => markReady.mutate(order.orderId)}
        onCancel={() => setIsCancelDialogOpen(true)}
        isPending={isPending}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3): items + customer/payment */}
        <div className="lg:col-span-2 space-y-6">
          {order.items.length > 0 && <OrderDetailItems items={order.items} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OrderDetailCustomer
              customer={{
                name: "Customer",
                phone: "—",
                address: addressStr,
              }}
            />
            <OrderDetailPayment
              totals={{
                subtotal:    itemsTotal,
                serviceFee:  0,
                deliveryFee: order.shippingFee,
                tax:         0,
              }}
              paymentMethod={order.paymentMethod === "cod" ? "Cash on Delivery" : "VNPay"}
            />
          </div>
        </div>

        {/* Right column (1/3): timeline + map + notes */}
        <div className="space-y-6">
          {timeline.length > 0 && <OrderDetailHistory timeline={timeline} />}

          <OrderDetailMap location={addressStr} />

          {order.note && <OrderDetailNotes notes={order.note} />}
        </div>
      </div>

      <CancelOrderDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        onConfirm={handleCancel}
        isPending={cancelOrder.isPending}
      />
    </>
  );
}
