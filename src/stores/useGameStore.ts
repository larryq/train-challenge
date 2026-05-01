import { create } from "zustand";
import { getLevelConfig } from "../lib/levelConfig";

interface GameStore {
  phase: "menu" | "playing" | "summary";
  currentLevel: number;
  sessionScore: number;
  levelScore: number;

  // timer
  timeRemaining: number;

  // level stats -- grabbed
  levelRubies: number;
  levelMailbags: number;
  levelSignals: number;

  // level stats -- total spawned
  totalRubies: number;
  totalMailbags: number;
  totalSignals: number;

  // actions
  startGame: () => void;
  endLevel: () => void;
  startNextLevel: () => void;
  tickTimer: () => void;

  // score
  addScore: (amount: number) => void;
  deductScore: (amount: number) => void;

  // grabbed counters
  incrementLevelRubies: () => void;
  incrementLevelMailbags: () => void;
  incrementLevelSignals: () => void;

  // spawned counters
  incrementTotalRubies: () => void;
  incrementTotalMailbags: () => void;
  incrementTotalSignals: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: "menu",
  currentLevel: 1,
  sessionScore: 0,
  levelScore: 0,
  timeRemaining: getLevelConfig(1).duration,

  levelRubies: 0,
  levelMailbags: 0,
  levelSignals: 0,
  totalRubies: 0,
  totalMailbags: 0,
  totalSignals: 0,

  startGame: () =>
    set({
      phase: "playing",
      currentLevel: 1,
      sessionScore: 0,
      levelScore: 0,
      timeRemaining: getLevelConfig(1).duration,
      levelRubies: 0,
      levelMailbags: 0,
      levelSignals: 0,
      totalRubies: 0,
      totalMailbags: 0,
      totalSignals: 0,
    }),

  endLevel: () => set({ phase: "summary" }),

  startNextLevel: () => {
    const current = get().currentLevel;
    const nextLevel = current >= 4 ? 1 : current + 1;
    const config = getLevelConfig(nextLevel);
    set({
      phase: "playing",
      currentLevel: nextLevel,
      levelScore: 0,
      timeRemaining: config.duration,
      levelRubies: 0,
      levelMailbags: 0,
      levelSignals: 0,
      totalRubies: 0,
      totalMailbags: 0,
      totalSignals: 0,
    });
  },

  tickTimer: () => {
    const t = get().timeRemaining;
    if (t <= 0) return;
    set({ timeRemaining: t - 1 });
  },

  addScore: (amount) =>
    set((state) => ({
      sessionScore: state.sessionScore + amount,
      levelScore: state.levelScore + amount,
    })),

  deductScore: (amount) =>
    set((state) => ({
      sessionScore: Math.max(0, state.sessionScore - amount),
      levelScore: Math.max(0, state.levelScore - amount),
    })),

  incrementLevelRubies: () => set((s) => ({ levelRubies: s.levelRubies + 1 })),
  incrementLevelMailbags: () =>
    set((s) => ({ levelMailbags: s.levelMailbags + 1 })),
  incrementLevelSignals: () =>
    set((s) => ({ levelSignals: s.levelSignals + 1 })),

  incrementTotalRubies: () => set((s) => ({ totalRubies: s.totalRubies + 1 })),
  incrementTotalMailbags: () =>
    set((s) => ({ totalMailbags: s.totalMailbags + 1 })),
  incrementTotalSignals: () =>
    set((s) => ({ totalSignals: s.totalSignals + 1 })),
}));
