import { create } from 'zustand';
import { PaymentMethod } from '../types';

interface CheckoutState {
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;
  appliedCouponCode: string | null;
  setAppliedCouponCode: (code: string | null) => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  selectedPaymentMethod: null,
  setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),
  appliedCouponCode: null,
  setAppliedCouponCode: (code) => set({ appliedCouponCode: code }),
}));
