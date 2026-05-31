import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const REASON_CODES = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'kitchen_cancel', label: 'Kitchen Cannot Fulfill' },
  { value: 'customer_request', label: 'Customer Requested' },
  { value: 'other', label: 'Other Reason' },
];

export type CancelOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, reasonCode: string) => void;
  isPending?: boolean;
};

export function CancelOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: CancelOrderDialogProps) {
  const [reasonCode, setReasonCode] = useState<string>('out_of_stock');
  const [reasonText, setReasonText] = useState('');

  const handleConfirm = () => {
    if (!reasonText.trim()) return;
    onConfirm(reasonText.trim(), reasonCode);
  };

  // Reset state when opened
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setReasonCode('out_of_stock');
      setReasonText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            Please provide a reason for cancelling this order. This information helps us improve our service and is required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reasonCode">Cancellation Category</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger id="reasonCode" className="w-full">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((code) => (
                  <SelectItem key={code.value} value={code.value}>
                    {code.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reasonText">Detailed Note</Label>
            <Textarea
              id="reasonText"
              placeholder="E.g., We ran out of chicken for the Pho."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || !reasonText.trim()}
          >
            {isPending ? 'Cancelling...' : 'Confirm Cancellation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
