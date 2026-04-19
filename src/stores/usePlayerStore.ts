import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface PlayerStore {
  distanceTraveled: number;
  currentSpeed: number;
  grabsAttempted: number;
  grabsSuccessful: number;

  addDistance: (delta: number) => void;
  setSpeed: (speed: number) => void;
  recordGrabAttempt: () => void;
  recordGrabSuccess: () => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set) => ({
    distanceTraveled: 0,
    currentSpeed: 0,
    grabsAttempted: 0,
    grabsSuccessful: 0,

    addDistance: (delta) =>
      set((state) => ({
        distanceTraveled: state.distanceTraveled + delta,
      })),

    setSpeed: (speed) => set({ currentSpeed: speed }),

    recordGrabAttempt: () =>
      set((state) => ({
        grabsAttempted: state.grabsAttempted + 1,
      })),

    recordGrabSuccess: () =>
      set((state) => ({
        grabsSuccessful: state.grabsSuccessful + 1,
      })),

    reset: () =>
      set({
        distanceTraveled: 0,
        currentSpeed: 0,
        grabsAttempted: 0,
        grabsSuccessful: 0,
      }),
  })),
);
