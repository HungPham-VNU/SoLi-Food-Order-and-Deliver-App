import { apiFetch } from '@/src/lib/api-client';

export interface CancelVNPayPaymentResponse {
  id: string;
  orderId: string;
  status: 'failed';
  updatedAt: string;
}

export const cancelVNPayPayment = (
  orderId: string,
): Promise<CancelVNPayPaymentResponse> =>
  apiFetch<CancelVNPayPaymentResponse>(
    `/api/payments/vnpay/orders/${orderId}/cancel`,
    {
      method: 'PATCH',
    },
  );
