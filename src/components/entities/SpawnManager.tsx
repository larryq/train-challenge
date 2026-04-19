/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useGameStore } from "../../stores/useGameStore";
import { useEntityStore } from "../../stores/useEntityStore";
import { GRAB_CONFIG } from "../../lib/grabConfig";
import { useTrackStore } from "../../stores/useTrackStore";

interface SpawnManagerProps {
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  trainTRef: React.MutableRefObject<number>;
}

function secondsToDistance(seconds: number, speed: number): number {
  return seconds * speed;
}

// shared spawn position helper
function getSpawnPosition(
  curve: THREE.CatmullRomCurve3,
  trainT: number,
  aheadDistance: number,
  lateralOffset: number,
  curveLength: number,
): { position: THREE.Vector3; side: "left" | "right" } {
  const aheadT = Math.min(trainT + aheadDistance / curveLength, 0.9999);
  const spawnPos = curve.getPointAt(aheadT);
  const tangent = curve.getTangentAt(aheadT).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
  const side = Math.random() > 0.5 ? 1 : -1;
  const sideLabel = side > 0 ? "right" : "left";
  const position = spawnPos
    .clone()
    .addScaledVector(right, side * lateralOffset);
  return { position, side: sideLabel as "left" | "right" };
}

export function SpawnManager({
  masterCurveRef,
  trainPositionRef,
  trainTRef,
}: SpawnManagerProps) {
  const distanceTraveled = usePlayerStore((s) => s.distanceTraveled);
  const currentSpeed = usePlayerStore((s) => s.currentSpeed);
  const phase = useGameStore((s) => s.phase);
  const isReady = useTrackStore((s) => s.isReady);

  // ruby store
  const spawnRubyCluster = useEntityStore((s) => s.spawnRubyCluster);
  const expireCluster = useEntityStore((s) => s.expireCluster);
  const removeCluster = useEntityStore((s) => s.removeCluster);
  const rubyClusters = useEntityStore((s) => s.rubyClusters);

  // mailbag store
  const spawnMailbag = useEntityStore((s) => s.spawnMailbag);
  const expireMailbag = useEntityStore((s) => s.expireMailbag);
  const removeMailbag = useEntityStore((s) => s.removeMailbag);
  const mailbags = useEntityStore((s) => s.mailbags);

  // refs
  const nextRubySpawnRef = useRef<number | null>(null);
  const nextMailbagSpawnRef = useRef<number | null>(null);
  const rubyCounterRef = useRef(0);
  const mailbagCounterRef = useRef(0);

  const pickNextSpawnDistance = useCallback(
    (currentDist: number, speed: number, minSecs: number, maxSecs: number) => {
      const effectiveSpeed = Math.max(speed, 10);
      const minDist = secondsToDistance(minSecs, effectiveSpeed);
      const maxDist = secondsToDistance(maxSecs, effectiveSpeed);
      const interval = minDist + Math.random() * (maxDist - minDist);
      return currentDist + interval;
    },
    [],
  );

  const spawnCluster = useCallback(() => {
    const curve = masterCurveRef.current;
    if (!curve) return;

    const { position, side } = getSpawnPosition(
      curve,
      trainTRef.current,
      GRAB_CONFIG.SPAWN_AHEAD_DISTANCE,
      GRAB_CONFIG.LATERAL_OFFSET,
      curve.getLength(),
    );

    position.y = GRAB_CONFIG.HEIGHT_ABOVE_GROUND;

    spawnRubyCluster({
      id: `ruby_${rubyCounterRef.current++}`,
      position,
      side,
      spawnedAt: Date.now(),
      rubiesGrabbed: [false, false, false] as [boolean, boolean, boolean],
      isExpired: false,
    });

    console.log("SpawnManager: spawned ruby cluster at", position);
  }, [masterCurveRef, trainTRef, spawnRubyCluster]);

  const spawnBag = useCallback(() => {
    const curve = masterCurveRef.current;
    if (!curve) return;

    const { position, side } = getSpawnPosition(
      curve,
      trainTRef.current,
      GRAB_CONFIG.SPAWN_AHEAD_DISTANCE,
      GRAB_CONFIG.MAILBAG_LATERAL_OFFSET,
      curve.getLength(),
    );

    position.y = GRAB_CONFIG.MAILBAG_HEIGHT_ABOVE_GROUND;

    spawnMailbag({
      id: `mailbag_${mailbagCounterRef.current++}`,
      position,
      side,
      spawnedAt: Date.now(),
      isGrabbed: false,
      isExpired: false,
    });

    console.log("SpawnManager: spawned mailbag at", position);
  }, [masterCurveRef, trainTRef, spawnMailbag]);

  useFrame(() => {
    if (phase !== "playing") return;
    if (!isReady) return;
    const curve = masterCurveRef.current;
    if (!curve) return;

    const dist = distanceTraveled;
    const speed = currentSpeed;

    // initialize both spawn distances together
    if (
      nextRubySpawnRef.current === null ||
      nextMailbagSpawnRef.current === null
    ) {
      const effectiveSpeed = Math.max(speed, 10);

      if (nextRubySpawnRef.current === null) {
        nextRubySpawnRef.current =
          pickNextSpawnDistance(
            dist,
            effectiveSpeed,
            GRAB_CONFIG.MIN_SPAWN_INTERVAL,
            GRAB_CONFIG.MAX_SPAWN_INTERVAL,
          ) + 20;
      }

      if (nextMailbagSpawnRef.current === null) {
        nextMailbagSpawnRef.current =
          pickNextSpawnDistance(
            dist,
            effectiveSpeed,
            GRAB_CONFIG.MAILBAG_MIN_SPAWN_INTERVAL,
            GRAB_CONFIG.MAILBAG_MAX_SPAWN_INTERVAL,
          ) + 30;
      }

      return; // single return after both initialized
    }

    // check ruby spawn
    if (dist >= nextRubySpawnRef.current) {
      spawnCluster();
      nextRubySpawnRef.current = pickNextSpawnDistance(
        dist,
        speed,
        GRAB_CONFIG.MIN_SPAWN_INTERVAL,
        GRAB_CONFIG.MAX_SPAWN_INTERVAL,
      );
    }

    // check mailbag spawn
    if (dist >= nextMailbagSpawnRef.current) {
      spawnBag();
      nextMailbagSpawnRef.current = pickNextSpawnDistance(
        dist,
        speed,
        GRAB_CONFIG.MAILBAG_MIN_SPAWN_INTERVAL,
        GRAB_CONFIG.MAILBAG_MAX_SPAWN_INTERVAL,
      );
    }

    // expire rubies and mailbags the train has passed
    const trainPos = trainPositionRef.current;
    const tangent = curve
      .getTangentAt(THREE.MathUtils.clamp(trainTRef.current, 0, 0.9999))
      .normalize();

    rubyClusters.forEach((cluster) => {
      if (cluster.isExpired) return;
      const toCluster = cluster.position.clone().sub(trainPos);
      if (toCluster.dot(tangent) < -GRAB_CONFIG.EXPIRY_BUFFER) {
        expireCluster(cluster.id);
        setTimeout(() => removeCluster(cluster.id), 1000);
      }
    });

    mailbags.forEach((bag) => {
      if (bag.isExpired) return;
      const toBag = bag.position.clone().sub(trainPos);
      if (toBag.dot(tangent) < -GRAB_CONFIG.EXPIRY_BUFFER) {
        expireMailbag(bag.id);
        setTimeout(() => removeMailbag(bag.id), 1000);
      }
    });
  });

  return null;
}
