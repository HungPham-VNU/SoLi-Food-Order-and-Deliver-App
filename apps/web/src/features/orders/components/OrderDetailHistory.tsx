import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderStatusLogEntry } from "@/features/orders/types";
import { STATUS_LABEL } from "@/features/orders/types";

type OrderDetailHistoryProps = {
  timeline: OrderStatusLogEntry[];
};

export function OrderDetailHistory({ timeline }: OrderDetailHistoryProps) {
  return (
    <Card className="rounded-2xl ring-0 shadow-none bg-surface-container-lowest gap-0 py-0">
      <CardHeader className="px-6 pt-6 pb-0">
        <CardTitle className="font-headline font-bold text-lg text-on-surface">
          Order History
        </CardTitle>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-6">
        <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container">
          {timeline.map((entry, index) => {
            const isCurrent = index === timeline.length - 1;
            const label = STATUS_LABEL[entry.toStatus] ?? entry.toStatus;
            const time = new Date(entry.createdAt).toLocaleString("vi-VN", {
              day: "2-digit", month: "2-digit",
              hour: "2-digit", minute: "2-digit",
            });

            return (
              <div key={index} className="relative flex gap-4 pl-8">
                {isCurrent ? (
                  <div
                    className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10"
                    aria-hidden="true"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                ) : (
                  <div
                    className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center z-10"
                    aria-hidden="true"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  </div>
                )}

                <div>
                  <p className={cn(
                    "text-sm font-bold font-headline",
                    isCurrent ? "text-primary" : "text-on-surface",
                  )}>
                    {label}
                  </p>
                  <p className="text-xs text-stone-500 font-body">{time}</p>
                  {entry.note && (
                    <p className="text-xs text-stone-400 italic mt-0.5 font-body">{entry.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
