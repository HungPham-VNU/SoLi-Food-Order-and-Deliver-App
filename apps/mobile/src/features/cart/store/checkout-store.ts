import { create } from 'zustand';
import { PaymentMethod } from '../types';

export interface SelectedCheckoutPromotion {
  id: string;
  restaurantId: string;
  name: string;
  description?: string | null;
}

interface CheckoutState {
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;
  appliedCouponCode: string | null;
  setAppliedCouponCode: (code: string | null) => void;
  selectedPromotion: SelectedCheckoutPromotion | null;
  setSelectedPromotion: (promotion: SelectedCheckoutPromotion | null) => void;
  checkoutIdempotencyKey: string | null;
  setCheckoutIdempotencyKey: (key: string) => void;
  clearCheckoutIdempotencyKey: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  selectedPaymentMethod: null,
  setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),
  appliedCouponCode: null,
  setAppliedCouponCode: (code) =>
    set({ appliedCouponCode: code, selectedPromotion: null }),
  selectedPromotion: null,
  setSelectedPromotion: (promotion) =>
    set({ selectedPromotion: promotion, appliedCouponCode: null }),
  checkoutIdempotencyKey: null,
  setCheckoutIdempotencyKey: (key) => set({ checkoutIdempotencyKey: key }),
  clearCheckoutIdempotencyKey: () => set({ checkoutIdempotencyKey: null }),
}));
