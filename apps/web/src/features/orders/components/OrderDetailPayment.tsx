import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type OrderTotals = {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
};

type OrderDetailPaymentProps = {
  totals: OrderTotals;
  paymentMethod: string;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

export function OrderDetailPayment({
  totals,
  paymentMethod,
}: OrderDetailPaymentProps) {
  const total =
    totals.subtotal + totals.serviceFee + totals.deliveryFee + totals.tax;

  const lineItems = [
    { label: 'Subtotal', value: totals.subtotal },
    { label: 'Service Fee', value: totals.serviceFee },
    { label: 'Delivery Fee', value: totals.deliveryFee },
    { label: 'Estimated Taxes', value: totals.tax },
  ];

  return (
    <Card className="rounded-2xl ring-0 shadow-none bg-surface-container-lowest gap-0 py-0 flex flex-col">
      <CardHeader className="px-6 pt-6 pb-0">
        <CardTitle className="font-headline font-bold text-lg text-on-surface">
          Payment Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="px-6 pt-4 pb-0 flex-1 space-y-3">
        {lineItems.map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-stone-500 font-body">{label}</span>
            <span className="text-on-surface font-medium font-body">
              {formatPrice(value)}
            </span>
          </div>
        ))}
      </CardContent>

      <CardFooter className="mt-6 px-6 pb-6 pt-4 bg-transparent border-t border-surface-container flex-col items-stretch gap-1 rounded-b-2xl">
        <div className="flex justify-between items-center">
          <span className="font-headline font-bold text-lg text-on-surface">
            Total
          </span>
          <span className="font-headline font-extrabold text-2xl text-secondary">
            {formatPrice(total)}
          </span>
        </div>
        <p className="text-[10px] text-stone-400 text-right font-body">
          Paid via {paymentMethod}
        </p>
      </CardFooter>
    </Card>
  );
}
