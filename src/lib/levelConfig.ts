import type { GrabTargetType } from "../stores/useEntityStore";

export interface LevelConfig {
  level: number;
  duration: number;
  trainSpeed: number;
  grabTypes: GrabTargetType[];
  spawnFrequency: number;
  minSpawnDistance: number; // minimum meters between spawns
  fogDensity: number;
}

const DEFINED_LEVELS: LevelConfig[] = [
  {
    level: 1,
    duration: 120,
    trainSpeed: 5.5,
    grabTypes: ["ruby"],
    spawnFrequency: 1.0,
    minSpawnDistance: 30,
    fogDensity: 0.012,
  },
  {
    level: 2,
    duration: 120,
    trainSpeed: 20,
    grabTypes: ["ruby", "mailsack"],
    spawnFrequency: 1.2,
    minSpawnDistance: 25,
    fogDensity: 0.012,
  },
  {
    level: 3,
    duration: 120,
    trainSpeed: 23,
    grabTypes: ["ruby", "mailsack", "sign"],
    spawnFrequency: 1.4,
    minSpawnDistance: 20,
    fogDensity: 0.014,
  },
];

export function getLevelConfig(level: number): LevelConfig {
  if (level <= DEFINED_LEVELS.length) {
    return DEFINED_LEVELS[level - 1];
  }

  const base = DEFINED_LEVELS[DEFINED_LEVELS.length - 1];
  const excess = level - DEFINED_LEVELS.length;

  return {
    ...base,
    level,
    trainSpeed: Math.min(base.trainSpeed + excess * 0.005, 0.15),
    spawnFrequency: Math.min(base.spawnFrequency + excess * 0.1, 3.0),
    minSpawnDistance: Math.max(base.minSpawnDistance - excess * 1, 10),
  };
}
