/* eslint-disable @typescript-eslint/no-unused-vars */
import { Canvas } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
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
//import { TreeManager } from "./components/environment/TreeManager";
import { TreeManager } from "./components/environment/TreeManager2";
import type { ChunkTreeData } from "./lib/placementUtils";
import { Signals } from "./components/entities/Signals";
import { IntroScreen } from "./components/hud/IntroScreen";
import { useDayNight } from "./hooks/useDayNight";
import { Terrain2 } from "./components/environment/Terrain2";
//import { Terrain3 } from "./components/environment/Terrain3";
import { useTerrainCycle } from "./hooks/useTerrainCycle";
import { Stats } from "@react-three/drei";
import { GameTimer } from "./components/hud/GameTimer";
import { SummaryScreen } from "./components/hud/SummaryScreen";
import { useTexture } from "@react-three/drei";
import { LEVEL_CONFIGS } from "./lib/levelConfig";

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
        backgroundColor: "transparent",
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
  const dayNight = useDayNight();
  const terrainCycle = useTerrainCycle();

  const handleReady = useCallback((segments: Map<string, LoadedSegment>) => {
    setLoadedSegments(segments);
  }, []);

  return (
    <>
      <Stats />
      <Environment trainPositionRef={trainPositionRef} dayNight={dayNight} />
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
            cycleValue={dayNight.cycleValue}
          />
          <Train
            masterCurveRef={masterCurveRef}
            trainPositionRef={trainPositionRef}
            trainTRef={trainTRef}
            cycleValue={dayNight.cycleValue}
          />
          <CameraRig
            trainPositionRef={trainPositionRef}
            masterCurveRef={masterCurveRef}
            trainTRef={trainTRef}
          />
          {/* <Terrain
            trainPositionRef={trainPositionRef}
            cycleValue={dayNight.cycleValue}
          /> */}
          {/* <Terrain3
            trainPositionRef={trainPositionRef}
            cycleValue={dayNight.cycleValue}
            terrainCycle={terrainCycle}
          /> */}
          <Terrain2 trainPositionRef={trainPositionRef} />
          <SpawnManager
            masterCurveRef={masterCurveRef}
            trainPositionRef={trainPositionRef}
            trainTRef={trainTRef}
          />
          <RubyClusters trainPositionRef={trainPositionRef} />
          <Mailbags trainPositionRef={trainPositionRef} />
          <Signals trainPositionRef={trainPositionRef} />
          <GrabSystem
            trainPositionRef={trainPositionRef}
            isActiveRef={isActiveRef}
            mouseScreenRef={mouseScreenRef}
          />
        </>
      )}

      {/* spline visualizer -- uncomment to debug */}
      {/* <SplineVisualizer masterCurveRef={masterCurveRef} /> */}
      <GrassManager chunksGrassRef={chunksGrassRef} />
      <TreeManager
        /*key={terrainCycle.activeSet.name}*/ // remount when terrain set changes
        chunksTreeRef={chunksTreeRef}
        /*activeTreeGlbs={terrainCycle.activeSet.treeGlbs}*/
      />
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
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#1a1a2e",
        left: event.x,
        top: event.y,
        transform: "translate(-50%, -50%)",
        backgroundColor: "transparent",
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
      MAILBAG PICKUP!
    </div>
  );
}

//if you run a red signal without changing it to green first
function PenaltyText() {
  const event = useEntityStore((s) => s.penaltyTextEvent);
  if (!event) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: event.x,
        top: event.y,
        transform: "translate(-50%, -50%)",
        color: "#ff2222",
        fontSize: 42,
        backgroundColor: "transparent",
        fontWeight: "bold",
        fontFamily: "monospace",
        textShadow: "0 0 10px #ff0000, 0 0 20px #ff0000",
        pointerEvents: "none",
        animation: `floatUp ${GRAB_CONFIG.SIGNAL_PENALTY_DURATION}ms ease-out forwards`,
        zIndex: 100,
      }}
    >
      RAN A RED!
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
      <GameTimer />
      <SummaryScreen />
      <BonusText />
      <DeliveredText />
      <PenaltyText />
      <CrosshairVisual
        isActiveRef={isActiveRef}
        mouseScreenRef={mouseScreenRef}
      />
      <IntroScreen />
    </div>
  );
}

LEVEL_CONFIGS.forEach((config) => {
  useTexture.preload(config.terrainTextures.map);
  useTexture.preload(config.terrainTextures.normalMap);
  useTexture.preload(config.terrainTextures.aoMap);
});
LEVEL_CONFIGS.forEach((config) => {
  config.treeGlbs.forEach((url) => useGLTF.preload(url));
});
