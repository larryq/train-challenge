import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CameraRigProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
  trainTRef: React.MutableRefObject<number>;
}

// tuning constants -- adjust these to taste
const CAMERA_HEIGHT = 4; // units above train
const CAMERA_BACK = 8; // units behind train
const LOOK_AHEAD_T = 0.015; // how far ahead on curve camera looks
const POSITION_LERP = 4; // higher = snappier camera position
const LOOKAT_LERP = 3; // higher = snappier camera rotation

export function CameraRig({
  trainPositionRef,
  masterCurveRef,
  trainTRef,
}: CameraRigProps) {
  // current smoothed camera position and lookat target
  const currentCamPos = useRef(
    new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_BACK),
  );
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // reusable vectors -- avoid allocating in useFrame
  const targetCamPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const backDir = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    const safeDelta = Math.min(delta, 0.05);
    const curve = masterCurveRef.current;
    if (!curve) return;

    const t = trainTRef.current;
    const trainPos = trainPositionRef.current;

    // get train's forward direction from tangent
    const tangent = curve
      .getTangentAt(THREE.MathUtils.clamp(t, 0, 0.9999))
      .normalize();

    // camera sits behind and above the train
    // "behind" means opposite of the forward tangent
    backDir.current.copy(tangent).negate();

    targetCamPos.current
      .copy(trainPos)
      .addScaledVector(backDir.current, CAMERA_BACK)
      .add(new THREE.Vector3(0, CAMERA_HEIGHT, 0));

    // look ahead of the train on the curve
    const lookAheadT = THREE.MathUtils.clamp(t + LOOK_AHEAD_T, 0, 0.9999);
    const lookAheadPos = curve.getPointAt(lookAheadT);
    targetLookAt.current.copy(lookAheadPos).add(new THREE.Vector3(0, 1, 0)); // slightly above track level

    // lerp camera position
    currentCamPos.current.lerp(
      targetCamPos.current,
      Math.min(POSITION_LERP * safeDelta, 1),
    );

    // lerp lookat target
    currentLookAt.current.lerp(
      targetLookAt.current,
      Math.min(LOOKAT_LERP * safeDelta, 1),
    );

    // apply to actual camera
    camera.position.copy(currentCamPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
