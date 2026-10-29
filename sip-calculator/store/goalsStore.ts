import { create } from 'zustand';

export interface SavedGoal {
  id: string;
  name: string;
  icon: string;
  targetCost: number;
  alreadySaved: number;
  ratePct: number;
  years: number;
  startedAt: number; // year the goal was created, for "by {year}" display
  monthlySip: number;
  /** "YYYY-MM" keys of months marked done. In-memory only — resets on app restart. */
  doneMonths: string[];
}

interface GoalsState {
  goals: SavedGoal[];
  addGoal: (goal: Omit<SavedGoal, 'id' | 'doneMonths'>) => void;
  markMonthDone: (id: string, monthKey: string) => void;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: [],
  addGoal: (goal) =>
    set((state) => ({
      goals: [...state.goals, { ...goal, id: `${Date.now()}`, doneMonths: [] }],
    })),
  markMonthDone: (id, monthKey) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id && !g.doneMonths.includes(monthKey) ? { ...g, doneMonths: [...g.doneMonths, monthKey] } : g)),
    })),
}));
