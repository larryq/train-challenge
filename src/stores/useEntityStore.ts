import { create } from "zustand";
import * as THREE from "three";

export type RubyGrabState = [boolean, boolean, boolean];
export type GrabTargetType = "ruby" | "mailsack" | "sign";

export interface RubyClusterData {
  id: string;
  position: THREE.Vector3;
  side: "left" | "right";
  spawnedAt: number;
  rubiesGrabbed: RubyGrabState;
  isExpired: boolean;
}

export interface MailbagData {
  id: string;
  position: THREE.Vector3;
  side: "left" | "right";
  spawnedAt: number;
  isGrabbed: boolean;
  isExpired: boolean;
}

export interface POIData {
  id: string;
  type: string;
  position: THREE.Vector3;
  spawnedAt: number;
}

interface BonusTextEvent {
  x: number;
  y: number;
  show: boolean;
}

export interface SignalData {
  id: string;
  position: THREE.Vector3;
  side: "left" | "right";
  spawnedAt: number;
  isGreen: boolean;
  isExpired: boolean;
  isPenalized: boolean;
}

interface EntityStore {
  rubyClusters: RubyClusterData[];
  mailbags: MailbagData[];
  pois: POIData[];
  lastGrabbedClusterId: string | null;
  bonusTextEvent: BonusTextEvent | null;
  deliveredTextEvent: { x: number; y: number } | null;

  // ruby actions
  spawnRubyCluster: (cluster: RubyClusterData) => void;
  grabRuby: (clusterId: string, rubyIndex: 0 | 1 | 2) => void;
  expireCluster: (clusterId: string) => void;
  removeCluster: (clusterId: string) => void;

  // mailbag actions
  spawnMailbag: (mailbag: MailbagData) => void;
  grabMailbag: (id: string) => void;
  expireMailbag: (id: string) => void;
  removeMailbag: (id: string) => void;

  //signal actions and data
  signals: SignalData[];
  penaltyTextEvent: { x: number; y: number } | null;

  spawnSignal: (signal: SignalData) => void;
  setSignalGreen: (id: string) => void;
  expireSignal: (id: string) => void;
  removeSignal: (id: string) => void;
  setPenaltyText: (event: { x: number; y: number } | null) => void;

  // shared
  clearAll: () => void;
  setLastGrabbed: (id: string | null) => void;
  setBonusText: (event: { x: number; y: number } | null) => void;
  setDeliveredText: (event: { x: number; y: number } | null) => void;
}

export const useEntityStore = create<EntityStore>((set) => ({
  rubyClusters: [],
  mailbags: [],
  pois: [],
  lastGrabbedClusterId: null,
  bonusTextEvent: null,
  deliveredTextEvent: null,
  signals: [],
  penaltyTextEvent: null,

  // ruby actions
  spawnRubyCluster: (cluster) =>
    set((state) => ({
      rubyClusters: [...state.rubyClusters, cluster],
    })),

  grabRuby: (clusterId, rubyIndex) =>
    set((state) => ({
      rubyClusters: state.rubyClusters.map((cluster) => {
        if (cluster.id !== clusterId) return cluster;
        const newGrabState = [...cluster.rubiesGrabbed] as RubyGrabState;
        newGrabState[rubyIndex] = true;
        return { ...cluster, rubiesGrabbed: newGrabState };
      }),
    })),

  expireCluster: (clusterId) =>
    set((state) => ({
      rubyClusters: state.rubyClusters.map((c) =>
        c.id === clusterId ? { ...c, isExpired: true } : c,
      ),
    })),

  removeCluster: (clusterId) =>
    set((state) => ({
      rubyClusters: state.rubyClusters.filter((c) => c.id !== clusterId),
    })),

  // mailbag actions
  spawnMailbag: (mailbag) =>
    set((state) => ({
      mailbags: [...state.mailbags, mailbag],
    })),

  grabMailbag: (id) =>
    set((state) => ({
      mailbags: state.mailbags.map((m) =>
        m.id === id ? { ...m, isGrabbed: true } : m,
      ),
    })),

  expireMailbag: (id) =>
    set((state) => ({
      mailbags: state.mailbags.map((m) =>
        m.id === id ? { ...m, isExpired: true } : m,
      ),
    })),

  removeMailbag: (id) =>
    set((state) => ({
      mailbags: state.mailbags.filter((m) => m.id !== id),
    })),

  // shared actions
  clearAll: () =>
    set({
      rubyClusters: [],
      mailbags: [],
      pois: [],
    }),

  setLastGrabbed: (id) => set({ lastGrabbedClusterId: id }),

  setBonusText: (event) =>
    set({
      bonusTextEvent: event ? { ...event, show: true } : null,
    }),

  setDeliveredText: (event) =>
    set({
      deliveredTextEvent: event,
    }),

  spawnSignal: (signal) =>
    set((state) => ({
      signals: [...state.signals, signal],
    })),

  setSignalGreen: (id) =>
    set((state) => ({
      signals: state.signals.map((s) =>
        s.id === id ? { ...s, isGreen: true } : s,
      ),
    })),

  expireSignal: (id) =>
    set((state) => ({
      signals: state.signals.map((s) =>
        s.id === id ? { ...s, isExpired: true } : s,
      ),
    })),

  removeSignal: (id) =>
    set((state) => ({
      signals: state.signals.filter((s) => s.id !== id),
    })),

  setPenaltyText: (event) => set({ penaltyTextEvent: event }),
}));
