import { create } from 'zustand';

interface SipState {
  monthly: number;
  ratePct: number;
  years: number;
  stepUpPct: number;
  inflationOn: boolean;
  setMonthly: (v: number) => void;
  setRatePct: (v: number) => void;
  setYears: (v: number) => void;
  setStepUpPct: (v: number) => void;
  setInflationOn: (v: boolean) => void;
}

export const useSipStore = create<SipState>((set) => ({
  monthly: 5000,
  ratePct: 11,
  years: 10,
  stepUpPct: 0,
  inflationOn: false,
  setMonthly: (v) => set({ monthly: v }),
  setRatePct: (v) => set({ ratePct: v }),
  setYears: (v) => set({ years: v }),
  setStepUpPct: (v) => set({ stepUpPct: v }),
  setInflationOn: (v) => set({ inflationOn: v }),
}));
