import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface SegmentConfig {
  url: string;
  weight: number;
  tags: string[]; // 'straight' | 'curve' | 's-curve' etc
}

interface TrackStore {
  currentChunkId: number;
  totalChunksBuilt: number;
  segmentLibrary: SegmentConfig[];
  isReady: boolean; // true once first chunks are built
  segmentsPerChunk: number;
  chunksToPreload: number;
  advanceChunk: () => void;
  setReady: (ready: boolean) => void;
  setSegmentLibrary: (library: SegmentConfig[]) => void;
}

export const useTrackStore = create<TrackStore>()(
  subscribeWithSelector((set) => ({
    currentChunkId: 0,
    totalChunksBuilt: 0,
    segmentsPerChunk: 6,
    chunksToPreload: 4,
    isReady: false,
    segmentLibrary: [
      { url: "/segments/traintest1.glb", weight: 2 /*2*/, tags: ["curve"] },
      { url: "/segments/traintest2.glb", weight: 2 /*2*/, tags: ["curve"] },
      { url: "/segments/traintest3.glb", weight: 2 /*2*/, tags: ["curve"] },
      { url: "/segments/traintest4.glb", weight: 2 /*2*/, tags: ["curve"] },
      { url: "/segments/straight-shot.glb", weight: 3, tags: ["straight"] },
      { url: "/segments/left-s-curve.glb", weight: 2 /*2*/, tags: ["curve"] },
      {
        url: "/segments/left-pipe-curve.glb",
        weight: 2,
        tags: ["curve"],
      },
      {
        url: "/segments/left-snake-curve.glb",
        weight: 2,
        tags: ["curve"],
      },
      {
        url: "/segments/straight-rise2.glb",
        weight: 3,
        tags: ["straight", "slope"],
      },
    ],

    advanceChunk: () =>
      set((state) => ({
        currentChunkId: state.currentChunkId + 1,
        totalChunksBuilt: state.totalChunksBuilt + 1,
      })),

    setReady: (ready) => set({ isReady: ready }),

    setSegmentLibrary: (library) => set({ segmentLibrary: library }),
  })),
);
