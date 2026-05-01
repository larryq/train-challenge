export interface LevelConfig {
  terrainColor: string;
  level: number;
  duration: number;
  trainSpeed: number;
  label: string;
  terrainTextures: {
    map: string;
    normalMap: string;
    aoMap: string;
  };
  treeGlbs: [string, string, string];
  treeWeights: [number, number, number];
  aoStrength: number;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    duration: 120,
    trainSpeed: 6,
    label: "Rocky Plains",
    terrainTextures: {
      map: "/textures/rocky_terrain_02_diff_1k.jpg",
      normalMap: "/textures/rocky_terrain_02_nor_gl_1k.jpg",
      aoMap: "/textures/rocky_terrain_02_ao_1k.jpg",
    },
    treeGlbs: [
      "/models/tree9a.glb",
      "/models/tree2a.glb",
      "/models/tree3a.glb",
    ],
    treeWeights: [0.5, 0.35, 0.15],
    aoStrength: 1.0,
    terrainColor: "#ffffff",
  },
  {
    level: 2,
    duration: 120,
    trainSpeed: 6,
    label: "Grasslands",
    terrainTextures: {
      map: "/textures/Ground037_1K-JPG_Color.jpg",
      normalMap: "/textures/Ground037_1K-JPG_NormalGL.jpg",
      aoMap: "/textures/Ground037_1K-JPG_AmbientOcclusion.jpg",
    },
    treeGlbs: [
      "/models/tree3a.glb",
      "/models/tree2a.glb",
      "/models/tree4a.glb",
    ],
    treeWeights: [0.5, 0.35, 0.15],
    aoStrength: 0.7,
    terrainColor: "#282828",
  },
  {
    level: 3,
    duration: 120,
    trainSpeed: 6,
    label: "Coastal",
    terrainTextures: {
      map: "/textures/coast_sand_rocks_02_diff_1k.jpg",
      normalMap: "/textures/coast_sand_rocks_02_nor_gl_1k.jpg",
      aoMap: "/textures/coast_sand_rocks_02_ao_1k.jpg",
    },
    treeGlbs: [
      "/models/tree10a.glb",
      "/models/tree11a.glb",
      "/models/tree12a.glb",
    ],
    treeWeights: [0.4, 0.4, 0.2],
    aoStrength: 1.0,
    terrainColor: "#ffffff",
  },
  {
    level: 4,
    duration: 120,
    trainSpeed: 6,
    label: "Winter Pass",
    terrainTextures: {
      map: "/textures/snow_field_aerial_col_1k.jpg",
      normalMap: "/textures/snow_field_aerial_nor_gl_1k.jpg",
      aoMap: "/textures/snow_field_aerial_ao_1k.jpg",
    },
    treeGlbs: [
      "/models/tree6a.glb",
      "/models/tree7a.glb",
      "/models/tree8a.glb",
    ],
    treeWeights: [0.4, 0.4, 0.2],
    aoStrength: 1.0,
    terrainColor: "#ffffff",
  },
];

export function getLevelConfig(level: number): LevelConfig {
  const index = (level - 1) % LEVEL_CONFIGS.length;
  return LEVEL_CONFIGS[index];
}
