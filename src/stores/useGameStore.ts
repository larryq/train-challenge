import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

type GamePhase = "menu" | "playing" | "summary" | "gameover";

interface GameStore {
  phase: GamePhase;
  currentLevel: number;
  sessionScore: number;
  levelScore: number;
  multiplier: number;
  consecutiveGrabs: number;
  levelTimeRemaining: number;
  levelGrabs: number;
  levelGrabsAttempted: number;
  sessionGrabs: number;
  score: number;

  setPhase: (phase: GamePhase) => void;
  tickTimer: (delta: number) => void;
  addScore: (points: number) => void;
  deductScore: (amount: number) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  completeLevel: () => void;
  startNextLevel: () => void;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set) => ({
    phase: "playing",
    currentLevel: 1,
    sessionScore: 0,
    levelScore: 0,
    multiplier: 1,
    consecutiveGrabs: 0,
    levelTimeRemaining: 120,
    levelGrabs: 0,
    levelGrabsAttempted: 0,
    sessionGrabs: 0,
    score: 0,

    setPhase: (phase) => set({ phase }),

    tickTimer: (delta) =>
      set((state) => {
        if (state.phase !== "playing") return {};
        const remaining = state.levelTimeRemaining - delta;
        if (remaining <= 0) {
          return { levelTimeRemaining: 0, phase: "summary" };
        }
        return { levelTimeRemaining: remaining };
      }),

    addScore: (points) =>
      set((state) => ({
        levelScore: state.levelScore + points * state.multiplier,
        sessionScore: state.sessionScore + points * state.multiplier,
        score: state.score + points * state.multiplier,
      })),
    // in the store interface

    // in the store implementation
    deductScore: (amount) =>
      set((state) => ({
        score: Math.max(0, state.score - amount),
        levelScore: Math.max(0, state.levelScore - amount),
      })),

    incrementStreak: () =>
      set((state) => ({
        consecutiveGrabs: state.consecutiveGrabs + 1,
        multiplier: Math.min(state.consecutiveGrabs + 1, 4),
        levelGrabs: state.levelGrabs + 1,
        sessionGrabs: state.sessionGrabs + 1,
      })),

    resetStreak: () =>
      set({
        consecutiveGrabs: 0,
        multiplier: 1,
      }),

    completeLevel: () =>
      set((state) => ({
        phase: "summary",
        sessionScore: state.sessionScore + state.levelScore,
      })),

    startNextLevel: () =>
      set((state) => ({
        phase: "playing",
        currentLevel: state.currentLevel + 1,
        levelScore: 0,
        levelGrabs: 0,
        levelGrabsAttempted: 0,
        levelTimeRemaining: 120,
        multiplier: 1,
        consecutiveGrabs: 0,
      })),
  })),
);
