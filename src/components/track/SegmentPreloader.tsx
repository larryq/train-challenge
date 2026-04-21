import { useGLTF } from "@react-three/drei";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { loadSegmentJSON, type SegmentData } from "../../lib/splineUtils";

export interface LoadedSegment {
  scene: THREE.Group;
  data: SegmentData;
}

interface Props {
  onReady: (segments: Map<string, LoadedSegment>) => void;
}

export function SegmentPreloader({ onReady }: Props): null {
  const t1 = useGLTF("/segments/traintest1.glb");
  const t2 = useGLTF("/segments/traintest2.glb");
  const t3 = useGLTF("/segments/traintest3.glb");
  const t4 = useGLTF("/segments/traintest4.glb");
  const ss = useGLTF("/segments/straight-shot.glb");
  const sr = useGLTF("/segments/straight-rise.glb");
  const lsc = useGLTF("/segments/left-s-curve.glb");
  const lsnc = useGLTF("/segments/left-snake-curve.glb");
  const lpc = useGLTF("/segments/left-pipe-curve.glb");

  const [jsonsLoaded, setJsonsLoaded] = useState(false);
  const [segmentData, setSegmentData] = useState<Map<string, SegmentData>>(
    new Map(),
  );

  useEffect(() => {
    const urls = [
      "/segments/traintest1.glb",
      "/segments/traintest2.glb",
      "/segments/traintest3.glb",
      "/segments/traintest4.glb",
      "/segments/straight-shot.glb",
      "/segments/straight-rise.glb",
      "/segments/left-s-curve.glb",
      "/segments/left-snake-curve.glb",
      "/segments/left-pipe-curve.glb",
    ];

    Promise.all(
      urls.map(async (url) => {
        const data = await loadSegmentJSON(url);
        return [url, data] as [string, SegmentData];
      }),
    )
      .then((entries) => {
        setSegmentData(new Map(entries));
        setJsonsLoaded(true);
        console.log("SegmentPreloader: all JSONs loaded");
      })
      .catch((err) => {
        console.error("SegmentPreloader: failed to load JSONs", err);
      });
  }, []);

  useEffect(() => {
    if (!jsonsLoaded) return;

    const segments = new Map<string, LoadedSegment>([
      [
        "/segments/traintest1.glb",
        {
          scene: t1.scene as THREE.Group,
          data: segmentData.get("/segments/traintest1.glb")!,
        },
      ],
      [
        "/segments/traintest2.glb",
        {
          scene: t2.scene as THREE.Group,
          data: segmentData.get("/segments/traintest2.glb")!,
        },
      ],
      [
        "/segments/traintest3.glb",
        {
          scene: t3.scene as THREE.Group,
          data: segmentData.get("/segments/traintest3.glb")!,
        },
      ],
      [
        "/segments/traintest4.glb",
        {
          scene: t4.scene as THREE.Group,
          data: segmentData.get("/segments/traintest4.glb")!,
        },
      ],
      [
        "/segments/straight-shot.glb",
        {
          scene: ss.scene as THREE.Group,
          data: segmentData.get("/segments/straight-shot.glb")!,
        },
      ],
      [
        "/segments/straight-rise.glb",
        {
          scene: sr.scene as THREE.Group,
          data: segmentData.get("/segments/straight-rise.glb")!,
        },
      ],
      [
        "/segments/left-s-curve.glb",
        {
          scene: lsc.scene as THREE.Group,
          data: segmentData.get("/segments/left-s-curve.glb")!,
        },
      ],
      [
        "/segments/left-snake-curve.glb",
        {
          scene: lsnc.scene as THREE.Group,
          data: segmentData.get("/segments/left-snake-curve.glb")!,
        },
      ],
      [
        "/segments/left-pipe-curve.glb",
        {
          scene: lpc.scene as THREE.Group,
          data: segmentData.get("/segments/left-pipe-curve.glb")!,
        },
      ],
    ]);

    onReady(segments);
  }, [jsonsLoaded, t1, t2, t3, t4, ss, sr, lsc, lsnc, lpc]);

  return null;
}

// preload GLBs immediately
useGLTF.preload("/segments/traintest1.glb");
useGLTF.preload("/segments/traintest2.glb");
useGLTF.preload("/segments/traintest3.glb");
useGLTF.preload("/segments/traintest4.glb");
useGLTF.preload("/segments/straight-shot.glb");
useGLTF.preload("/segments/straight-rise.glb");
useGLTF.preload("/segments/left-s-curve.glb");
useGLTF.preload("/segments/left-snake-curve.glb");
useGLTF.preload("/segments/left-pipe-curve.glb");
