import { create } from 'zustand';
import type { CustomerInfo } from 'react-native-purchases';
import { configurePurchases, fetchCustomerInfo, hasProEntitlement } from '@/lib/purchases';

interface ProState {
  isPro: boolean;
  /** False until the first customer-info fetch resolves, so UI can avoid flashing a locked state. */
  ready: boolean;
  setFromCustomerInfo: (info: CustomerInfo) => void;
  init: () => Promise<void>;
}

export const useProStore = create<ProState>((set) => ({
  isPro: false,
  ready: false,
  setFromCustomerInfo: (info) => set({ isPro: hasProEntitlement(info), ready: true }),
  init: async () => {
    configurePurchases();
    try {
      const info = await fetchCustomerInfo();
      set({ isPro: hasProEntitlement(info), ready: true });
    } catch {
      set({ ready: true });
    }
  },
}));
