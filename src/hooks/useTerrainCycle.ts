/* eslint-disable react-hooks/purity */
import { useState, useEffect, useRef } from "react";

export const TERRAIN_SETS = [
  {
    name: "coast_rocks",
    textures: {
      map: "/textures/coast_sand_rocks_02_diff_1k.jpg",
      normalMap: "/textures/coast_sand_rocks_02_nor_gl_1k.jpg",
      aoMap: "/textures/coast_sand_rocks_02_ao_1k.jpg",
    },
    treeGlbs: [
      "/models/tree5.glb",
      "/models/tree4.glb",
      "/models/tree3.glb",
    ] as [string, string, string],
    treeWeights: [0.5, 0.35, 0.15] as [number, number, number],
  },
  {
    name: "rocky",
    textures: {
      map: "/textures/rocky_terrain_02_diff_1k.jpg",
      normalMap: "/textures/rocky_terrain_02_nor_gl_1k.jpg",
      aoMap: "/textures/rocky_terrain_02_ao_1k.jpg",
    },
    treeGlbs: [
      "/models/tree3.glb",
      "/models/tree2.glb",
      "/models/tree1.glb",
    ] as [string, string, string],
    treeWeights: [0.5, 0.35, 0.15] as [number, number, number],
  },
  {
    name: "winter",
    textures: {
      map: "/textures/snow_03_diff_1k.jpg",
      normalMap: "/textures/snow_03_nor_gl_1k.jpg",
      aoMap: "/textures/snow_03_ao_1k.jpg",
    },
    treeGlbs: [
      "/models/tree5.glb",
      "/models/tree3.glb",
      "/models/tree2.glb",
    ] as [string, string, string],
    treeWeights: [0.4, 0.4, 0.2] as [number, number, number],
  },
];

export type TerrainSet = (typeof TERRAIN_SETS)[number];

// ---- config -----------------------------------------------
const HOLD_DURATION = 10; // seconds on each terrain
const TRANSITION_DURATION = 3; // seconds to crossfade

export interface TerrainCycleState {
  currentSet: TerrainSet;
  nextSet: TerrainSet;
  blendFactor: number; // 0 = all current, 1 = all next
  isTransitioning: boolean;
  activeSet: TerrainSet; // whichever is dominant right now
}

export function useTerrainCycle(): TerrainCycleState {
  const startTimeRef = useRef(Date.now());
  const [state, setState] = useState<TerrainCycleState>({
    currentSet: TERRAIN_SETS[0],
    nextSet: TERRAIN_SETS[1],
    blendFactor: 0,
    isTransitioning: false,
    activeSet: TERRAIN_SETS[0],
  });

  useEffect(() => {
    const CYCLE_LENGTH = HOLD_DURATION + TRANSITION_DURATION;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const cyclePos = elapsed % (CYCLE_LENGTH * TERRAIN_SETS.length);

      // which terrain set are we on
      const setIndex =
        Math.floor(cyclePos / CYCLE_LENGTH) % TERRAIN_SETS.length;
      const posInCycle = cyclePos % CYCLE_LENGTH;
      const nextSetIndex = (setIndex + 1) % TERRAIN_SETS.length;

      const currentSet = TERRAIN_SETS[setIndex];
      const nextSet = TERRAIN_SETS[nextSetIndex];

      let blendFactor = 0;
      let isTransitioning = false;

      if (posInCycle >= HOLD_DURATION) {
        // in transition
        const transitionPos = posInCycle - HOLD_DURATION;
        blendFactor = transitionPos / TRANSITION_DURATION;
        // smooth step
        blendFactor = blendFactor * blendFactor * (3 - 2 * blendFactor);
        isTransitioning = true;
      }

      // active set is next when more than halfway through transition
      const activeSet = blendFactor > 0.5 ? nextSet : currentSet;

      setState((prev) => {
        // avoid unnecessary updates
        if (
          Math.abs(prev.blendFactor - blendFactor) < 0.005 &&
          prev.isTransitioning === isTransitioning &&
          prev.currentSet === currentSet
        )
          return prev;

        return {
          currentSet,
          nextSet,
          blendFactor,
          isTransitioning,
          activeSet,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return state;
}
