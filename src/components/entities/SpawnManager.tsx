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

  //railroad signals
  const spawnSignal = useEntityStore((s) => s.spawnSignal);
  const expireSignal = useEntityStore((s) => s.expireSignal);
  const removeSignal = useEntityStore((s) => s.removeSignal);
  const setPenaltyText = useEntityStore((s) => s.setPenaltyText);
  const deductScore = useGameStore((s) => s.deductScore);
  const segmentLibrary = useTrackStore((s) => s.segmentLibrary);
  const signals = useEntityStore((s) => s.signals);

  const signalCounterRef = useRef(0);
  const nextSignalChunkRef = useRef<number | null>(null);

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

  const spawnSignalAtPoint = useCallback(
    (worldPoints: THREE.Vector3[], _segmentUrls: string[]) => {
      const curve = masterCurveRef.current;
      if (!curve) return;

      // find straight segment world points
      // pick a point from middle section of world points
      const midIndex = Math.floor(worldPoints.length * 0.5);
      const pos = worldPoints[midIndex].clone();
      const next = worldPoints[Math.min(midIndex + 1, worldPoints.length - 1)];

      const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const side = Math.random() > 0.5 ? 1 : -1;
      const sideLabel = side > 0 ? "right" : "left";

      const signalPos = pos
        .clone()
        .addScaledVector(right, side * GRAB_CONFIG.SIGNAL_LATERAL_OFFSET);
      signalPos.y = 0; // sits on ground

      spawnSignal({
        id: `signal_${signalCounterRef.current++}`,
        position: signalPos,
        side: sideLabel as "left" | "right",
        spawnedAt: Date.now(),
        isGreen: false,
        isExpired: false,
        isPenalized: false,
      });
    },
    [masterCurveRef, spawnSignal],
  );

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

    // in useFrame -- after ruby and mailbag spawning
    // check if we should spawn a signal
    if (nextSignalChunkRef.current === null) {
      nextSignalChunkRef.current = dist + 60; // first signal after 60 units
    }

    if (dist >= nextSignalChunkRef.current) {
      // check if current track section is straight
      // by sampling tangent consistency -- if tangent doesn't change much it's straight
      const curve = masterCurveRef.current;
      if (curve) {
        const t1 = trainTRef.current;
        const t2 = Math.min(t1 + 0.05, 0.9999);
        const tan1 = curve.getTangentAt(t1);
        const tan2 = curve.getTangentAt(t2);
        const dot = tan1.dot(tan2); // 1.0 = perfectly straight, less = curved

        if (dot > 0.18) {
          // only place on nearly straight sections
          // find a point ahead on the curve
          const aheadT = Math.min(t1 + 30 / curve.getLength(), 0.9999);
          const aheadPos = curve.getPointAt(aheadT);
          const tangent = curve.getTangentAt(aheadT).normalize();
          const up = new THREE.Vector3(0, 1, 0);
          const right = new THREE.Vector3()
            .crossVectors(tangent, up)
            .normalize();

          const side = Math.random() > 0.5 ? 1 : -1;
          const sideLabel = side > 0 ? "right" : "left";

          const signalPos = aheadPos
            .clone()
            .addScaledVector(right, side * GRAB_CONFIG.SIGNAL_LATERAL_OFFSET);
          signalPos.y = 0;

          spawnSignal({
            id: `signal_${signalCounterRef.current++}`,
            position: signalPos,
            side: sideLabel as "left" | "right",
            spawnedAt: Date.now(),
            isGreen: false,
            isExpired: false,
            isPenalized: false,
          });
        }

        // next signal regardless of whether we placed one
        nextSignalChunkRef.current = dist + 80 + Math.random() * 40;
      }
    }

    // expire signals and check for penalty
    //const trainPos = trainPositionRef.current;
    const curveTangent =
      masterCurveRef.current
        ?.getTangentAt(THREE.MathUtils.clamp(trainTRef.current, 0, 0.9999))
        .normalize() ?? new THREE.Vector3(0, 0, 1);

    signals.forEach((signal) => {
      if (signal.isExpired) return;

      const toSignal = signal.position.clone().sub(trainPos);

      if (toSignal.dot(curveTangent) < -GRAB_CONFIG.EXPIRY_BUFFER) {
        // train has passed signal
        if (!signal.isGreen && !signal.isPenalized) {
          // ran a red -- deduct score
          deductScore(GRAB_CONFIG.SIGNAL_PENALTY_POINTS);
          setPenaltyText({
            x: window.innerWidth / 2,
            y: window.innerHeight / 3,
          });
          setTimeout(
            () => setPenaltyText(null),
            GRAB_CONFIG.SIGNAL_PENALTY_DURATION,
          );
        }

        expireSignal(signal.id);
        setTimeout(() => removeSignal(signal.id), 1000);
      }
    });
  });

  return null;
}
