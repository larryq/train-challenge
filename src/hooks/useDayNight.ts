import { useRef, useState, useEffect } from "react";
import * as THREE from "three";

// ---- config -----------------------------------------------

export const DAY_NIGHT_CONFIG = {
  DAY_DURATION: 20, // seconds of full day
  DUSK_DURATION: 10, // seconds of full dusk
  TRANSITION_TIME: 5, // seconds to transition each way

  // day values
  DAY_FOG_COLOR: "#c8a882",
  DAY_FOG_DENSITY: 0.012,
  DAY_AMBIENT_COLOR: "#ffcc88",
  DAY_AMBIENT_INTENSITY: 0.4,
  DAY_SUN_COLOR: "#ffb347", //'#ff9944',
  DAY_SUN_INTENSITY: 2.2,
  DAY_SUN_POSITION: [100, 50, -400] as [number, number, number],
  DAY_SKY_TURBIDITY: 8,
  DAY_SKY_RAYLEIGH: 2,
  DAY_HEMI_SKY: "#ffaa44",
  DAY_HEMI_GROUND: "#4a6644",
  DAY_HEMI_INTENSITY: 0.5,

  // dusk values
  DUSK_FOG_COLOR: "#1a1a3a",
  DUSK_FOG_DENSITY: 0.015,
  DUSK_AMBIENT_COLOR: "#2a3a5a",
  DUSK_AMBIENT_INTENSITY: 0.15,
  DUSK_SUN_COLOR: "#ff4400",
  DUSK_SUN_INTENSITY: 0.6,
  DUSK_SUN_POSITION: [100, 25, -400] as [number, number, number],
  DUSK_SKY_TURBIDITY: 14,
  DUSK_SKY_RAYLEIGH: 4,
  DUSK_HEMI_SKY: "#1a2a4a",
  DUSK_HEMI_GROUND: "#0a0a0a",
  DUSK_HEMI_INTENSITY: 0.1,
} as const;

// ---- types ------------------------------------------------

export interface DayNightValues {
  fogColor: string;
  fogDensity: number;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  skyTurbidity: number;
  skyRayleigh: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  cycleValue: number; // 0 = full day, 1 = full dusk
  isTransitioning: boolean;
}

// ---- helpers ----------------------------------------------

function lerpColor(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return `#${ca.getHexString()}`;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPos(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    lerpNum(a[0], b[0], t),
    lerpNum(a[1], b[1], t),
    lerpNum(a[2], b[2], t),
  ];
}

// smooth step for transition curve
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// ---- hook -------------------------------------------------

export function useDayNight(): DayNightValues {
  const c = DAY_NIGHT_CONFIG;

  // total cycle length
  const CYCLE_LENGTH =
    c.DAY_DURATION + c.TRANSITION_TIME + c.DUSK_DURATION + c.TRANSITION_TIME;

  // eslint-disable-next-line react-hooks/purity
  const startTimeRef = useRef(Date.now());
  const [values, setValues] = useState<DayNightValues>({
    fogColor: c.DAY_FOG_COLOR,
    fogDensity: c.DAY_FOG_DENSITY,
    ambientColor: c.DAY_AMBIENT_COLOR,
    ambientIntensity: c.DAY_AMBIENT_INTENSITY,
    sunColor: c.DAY_SUN_COLOR,
    sunIntensity: c.DAY_SUN_INTENSITY,
    sunPosition: c.DAY_SUN_POSITION,
    skyTurbidity: c.DAY_SKY_TURBIDITY,
    skyRayleigh: c.DAY_SKY_RAYLEIGH,
    hemiSkyColor: c.DAY_HEMI_SKY,
    hemiGroundColor: c.DAY_HEMI_GROUND,
    hemiIntensity: c.DAY_HEMI_INTENSITY,
    cycleValue: 0,
    isTransitioning: false,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const cyclePos = elapsed % CYCLE_LENGTH;

      // determine phase and cycle value (0=day, 1=dusk)
      let cycleValue = 0;
      let isTransitioning = false;

      if (cyclePos < c.DAY_DURATION) {
        // full day
        cycleValue = 0;
      } else if (cyclePos < c.DAY_DURATION + c.TRANSITION_TIME) {
        // transitioning day → dusk
        const t = (cyclePos - c.DAY_DURATION) / c.TRANSITION_TIME;
        cycleValue = smoothStep(t);
        isTransitioning = true;
      } else if (
        cyclePos <
        c.DAY_DURATION + c.TRANSITION_TIME + c.DUSK_DURATION
      ) {
        // full dusk
        cycleValue = 1;
      } else {
        // transitioning dusk → day
        const t =
          (cyclePos - c.DAY_DURATION - c.TRANSITION_TIME - c.DUSK_DURATION) /
          c.TRANSITION_TIME;
        cycleValue = 1 - smoothStep(t);
        isTransitioning = true;
      }

      // lerp all values
      setValues({
        fogColor: lerpColor(c.DAY_FOG_COLOR, c.DUSK_FOG_COLOR, cycleValue),
        fogDensity: lerpNum(c.DAY_FOG_DENSITY, c.DUSK_FOG_DENSITY, cycleValue),
        ambientColor: lerpColor(
          c.DAY_AMBIENT_COLOR,
          c.DUSK_AMBIENT_COLOR,
          cycleValue,
        ),
        ambientIntensity: lerpNum(
          c.DAY_AMBIENT_INTENSITY,
          c.DUSK_AMBIENT_INTENSITY,
          cycleValue,
        ),
        sunColor: lerpColor(c.DAY_SUN_COLOR, c.DUSK_SUN_COLOR, cycleValue),
        sunIntensity: lerpNum(
          c.DAY_SUN_INTENSITY,
          c.DUSK_SUN_INTENSITY,
          cycleValue,
        ),
        sunPosition: lerpPos(
          c.DAY_SUN_POSITION,
          c.DUSK_SUN_POSITION,
          cycleValue,
        ),
        skyTurbidity: lerpNum(
          c.DAY_SKY_TURBIDITY,
          c.DUSK_SKY_TURBIDITY,
          cycleValue,
        ),
        skyRayleigh: lerpNum(
          c.DAY_SKY_RAYLEIGH,
          c.DUSK_SKY_RAYLEIGH,
          cycleValue,
        ),
        hemiSkyColor: lerpColor(c.DAY_HEMI_SKY, c.DUSK_HEMI_SKY, cycleValue),
        hemiGroundColor: lerpColor(
          c.DAY_HEMI_GROUND,
          c.DUSK_HEMI_GROUND,
          cycleValue,
        ),
        hemiIntensity: lerpNum(
          c.DAY_HEMI_INTENSITY,
          c.DUSK_HEMI_INTENSITY,
          cycleValue,
        ),
        cycleValue,
        isTransitioning,
      });
    }, 100); // update 10 times per second -- smooth enough for 5 second transition

    return () => clearInterval(interval);
  }, [CYCLE_LENGTH, c]);

  return values;
}
