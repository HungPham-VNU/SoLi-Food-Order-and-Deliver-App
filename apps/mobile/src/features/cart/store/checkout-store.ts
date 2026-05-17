import { create } from 'zustand';
import { PaymentMethod } from '../types';

interface CheckoutState {
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod) => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  selectedPaymentMethod: null,
  setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),
}));
