/* eslint-disable @typescript-eslint/no-unused-vars */
import { Canvas } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Suspense, useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { ChunkManager } from "./components/track/ChunkManager";
import {
  type LoadedSegment,
  SegmentPreloader,
} from "./components/track/SegmentPreloader";
import { Train } from "./components/train/Train";
import { CameraRig } from "./components/train/CameraRig";
import { Terrain } from "./components/environment/Terrain";
import { Environment } from "./components/environment/Environment";
import { SpawnManager } from "./components/entities/SpawnManager";
import { RubyClusters } from "./components/entities/RubyClusters";
import { GrabSystem } from "./components/hud/GrabSystem";
import { ScoreHUD } from "./components/hud/ScoreHUD";
import { CrosshairVisual } from "./components/hud/CrosshairVisual";
import { useEntityStore } from "./stores/useEntityStore";
import { GRAB_CONFIG } from "./lib/grabConfig";
import { Mailbags } from "./components/entities/Mailbags";
import { GrassManager } from "./components/environment/GrassManager";
import type { ChunkGrassData } from "./components/track/ChunkManager";
import { TreeManager } from "./components/environment/TreeManager";
import type { ChunkTreeData } from "./lib/placementUtils";

// ---- Scene props ------------------------------------------

interface SceneProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
  trainTRef: React.MutableRefObject<number>;
  isActiveRef: React.MutableRefObject<boolean>;
  mouseScreenRef: React.MutableRefObject<{ x: number; y: number }>;
}

function BonusText() {
  const event = useEntityStore((s) => s.bonusTextEvent);
  if (!event) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: event.x,
        top: event.y,
        transform: "translate(-50%, -50%)",
        color: "#ffdd44",
        fontSize: 48,
        fontWeight: "bold",
        fontFamily: "monospace",
        textShadow: "0 0 10px #ff8800, 0 0 20px #ff4400",
        pointerEvents: "none",
        animation: `floatUp ${GRAB_CONFIG.FLOAT_DURATION_MS}ms ease-out forwards`,
        zIndex: 100,
      }}
    >
      3×
    </div>
  );
}
// ---- Scene ------------------------------------------------

function Scene({
  trainPositionRef,
  masterCurveRef,
  trainTRef,
  isActiveRef,
  mouseScreenRef,
}: SceneProps) {
  const [loadedSegments, setLoadedSegments] = useState<Map<
    string,
    LoadedSegment
  > | null>(null);
  const chunksGrassRef = useRef<ChunkGrassData[]>([]);
  const chunksTreeRef = useRef<ChunkTreeData[]>([]);

  const handleReady = useCallback((segments: Map<string, LoadedSegment>) => {
    setLoadedSegments(segments);
  }, []);

  return (
    <>
      <Environment trainPositionRef={trainPositionRef} />
      <SegmentPreloader onReady={handleReady} />

      {loadedSegments && (
        <>
          <ChunkManager
            loadedSegments={loadedSegments}
            trainPositionRef={trainPositionRef}
            masterCurveRef={masterCurveRef}
            trainTRef={trainTRef}
            chunksGrassRef={chunksGrassRef}
            chunksTreeRef={chunksTreeRef}
          />
          <Train
            masterCurveRef={masterCurveRef}
            trainPositionRef={trainPositionRef}
            trainTRef={trainTRef}
          />
          <CameraRig
            trainPositionRef={trainPositionRef}
            masterCurveRef={masterCurveRef}
            trainTRef={trainTRef}
          />
          <Terrain trainPositionRef={trainPositionRef} />
          <SpawnManager
            masterCurveRef={masterCurveRef}
            trainPositionRef={trainPositionRef}
            trainTRef={trainTRef}
          />
          <RubyClusters trainPositionRef={trainPositionRef} />
          <Mailbags trainPositionRef={trainPositionRef} />
          <GrabSystem
            trainPositionRef={trainPositionRef}
            isActiveRef={isActiveRef}
            mouseScreenRef={mouseScreenRef}
          />
        </>
      )}

      {/* spline visualizer -- uncomment to debug */}
      <SplineVisualizer masterCurveRef={masterCurveRef} />
      <GrassManager chunksGrassRef={chunksGrassRef} />
      <TreeManager chunksTreeRef={chunksTreeRef} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} />
    </>
  );
}

// ---- SplineVisualizer (debug) -----------------------------

function SplineVisualizer({
  masterCurveRef,
}: {
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (masterCurveRef.current) {
        setPoints(masterCurveRef.current.getPoints(300));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [masterCurveRef]);

  if (points.length < 2) return null;

  return <Line points={points} color="red" lineWidth={2} />;
}

function DeliveredText() {
  const event = useEntityStore((s) => s.deliveredTextEvent);
  if (!event) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: event.x,
        top: event.y,
        transform: "translate(-50%, -50%)",
        color: "#ffffff",
        fontSize: 36,
        fontWeight: "bold",
        fontFamily: "monospace",
        textShadow: "0 0 10px #44aa44, 0 0 20px #228822",
        pointerEvents: "none",
        animation: `floatUp ${GRAB_CONFIG.DELIVERED_TEXT_DURATION_MS}ms ease-out forwards`,
        zIndex: 100,
      }}
    >
      DELIVERED!
    </div>
  );
}

// ---- App --------------------------------------------------

export default function App() {
  // refs live here so they can be shared between
  // inside-Canvas (GrabSystem) and outside-Canvas (CrosshairVisual)
  const trainPositionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const masterCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const trainTRef = useRef(0);

  // shared between GrabSystem and CrosshairVisual
  const isActiveRef = useRef(false);
  const mouseScreenRef = useRef({ x: 0, y: 0 });

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#1a1a2e",
      }}
    >
      <Canvas camera={{ position: [0, 15, 30], fov: 60 }} shadows>
        <Suspense fallback={null}>
          <Scene
            trainPositionRef={trainPositionRef}
            masterCurveRef={masterCurveRef}
            trainTRef={trainTRef}
            isActiveRef={isActiveRef}
            mouseScreenRef={mouseScreenRef}
          />
        </Suspense>
      </Canvas>

      {/* DOM overlays -- outside Canvas */}
      <ScoreHUD />
      <BonusText />
      <DeliveredText />
      <CrosshairVisual
        isActiveRef={isActiveRef}
        mouseScreenRef={mouseScreenRef}
      />
    </div>
  );
}
