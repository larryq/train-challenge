import { useRef, useEffect, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEntityStore } from "../../stores/useEntityStore";
import { useGameStore } from "../../stores/useGameStore";
import { GRAB_CONFIG } from "../../lib/grabConfig";

interface GrabSystemProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  isActiveRef: React.MutableRefObject<boolean>;
  mouseScreenRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function GrabSystem({
  trainPositionRef,
  isActiveRef,
  mouseScreenRef,
}: GrabSystemProps) {
  const { camera, scene } = useThree();
  const pointerRef = useRef(new THREE.Vector2(0, 0));
  const raycaster = useRef(new THREE.Raycaster());

  const rubyClusters = useEntityStore((s) => s.rubyClusters);
  const grabRuby = useEntityStore((s) => s.grabRuby);
  const setLastGrabbed = useEntityStore((s) => s.setLastGrabbed);
  const setBonusText = useEntityStore((s) => s.setBonusText);
  const addScore = useGameStore((s) => s.addScore);
  //const incrementStreak = useGameStore((s) => s.incrementStreak);
  const grabMailbag = useEntityStore((s) => s.grabMailbag);
  const mailbags = useEntityStore((s) => s.mailbags);
  const setDeliveredText = useEntityStore((s) => s.setDeliveredText);
  const signals = useEntityStore((s) => s.signals);
  const setSignalGreen = useEntityStore((s) => s.setSignalGreen);
  const incrementLevelRubies = useGameStore((s) => s.incrementLevelRubies);
  const incrementLevelMailbags = useGameStore((s) => s.incrementLevelMailbags);
  const incrementLevelSignals = useGameStore((s) => s.incrementLevelSignals);

  // track mouse screen position for CrosshairVisual
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseScreenRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseScreenRef]);

  // collect ruby meshes from scene
  const getRubyMeshes = useCallback((): THREE.Mesh[] => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isRuby) {
        meshes.push(obj);
      }
    });
    return meshes;
  }, [scene]);

  const getMailbagMeshes = useCallback((): THREE.Mesh[] => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isMailbag) {
        meshes.push(obj);
      }
    });
    return meshes;
  }, [scene]);

  const getSignalMeshes = useCallback((): THREE.Mesh[] => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isSignal) {
        meshes.push(obj);
      }
    });
    return meshes;
  }, [scene]);

  const handleRubyGrab = useCallback(
    (hit: THREE.Mesh) => {
      const rubyIndex = hit.userData.rubyIndex as 0 | 1 | 2;

      let obj: THREE.Object3D | null = hit;
      let clusterId: string | null = null;
      let depth = 0;
      while (obj && depth < 5) {
        if (obj.userData.clusterId) {
          clusterId = obj.userData.clusterId;
          break;
        }
        obj = obj.parent;
        depth++;
      }
      if (!clusterId) return;

      const cluster = rubyClusters.find((c) => c.id === clusterId);
      if (!cluster || cluster.isExpired) return;
      if (cluster.rubiesGrabbed[rubyIndex]) return;

      grabRuby(clusterId, rubyIndex);
      incrementLevelRubies();
      addScore(GRAB_CONFIG.RUBY_POINTS);
      //incrementStreak();

      setLastGrabbed(clusterId);
      setTimeout(() => setLastGrabbed(null), 100);

      const newState = [...cluster.rubiesGrabbed] as [
        boolean,
        boolean,
        boolean,
      ];
      newState[rubyIndex] = true;
      if (newState.every(Boolean) && GRAB_CONFIG.ALL_THREE_BONUS_TEXT) {
        setBonusText({
          x: window.innerWidth / 2,
          y: window.innerHeight / 3,
        });
        setTimeout(() => setBonusText(null), GRAB_CONFIG.FLOAT_DURATION_MS);
      }
    },
    [
      rubyClusters,
      grabRuby,
      addScore,
      //incrementStreak,
      setLastGrabbed,
      setBonusText,
      incrementLevelRubies,
    ],
  );

  const handleMailbagGrab = useCallback(
    (hit: THREE.Mesh) => {
      const mailbagId = hit.userData.mailbagId as string;
      if (!mailbagId) return;

      const bag = mailbags.find((m) => m.id === mailbagId);
      if (!bag || bag.isExpired || bag.isGrabbed) return;

      grabMailbag(mailbagId);
      incrementLevelMailbags();
      addScore(GRAB_CONFIG.MAILBAG_POINTS);
      // incrementStreak();

      // show delivered text
      setDeliveredText({
        x: window.innerWidth / 2,
        y: window.innerHeight / 3,
      });
      setTimeout(
        () => setDeliveredText(null),
        GRAB_CONFIG.DELIVERED_TEXT_DURATION_MS,
      );

      console.log(`Grabbed mailbag ${mailbagId}`);
    },
    [
      mailbags,
      grabMailbag,
      addScore,
      // incrementStreak,
      setDeliveredText,
      incrementLevelMailbags,
    ],
  );

  const handleSignalGrab = useCallback(
    (hit: THREE.Mesh) => {
      const signalId = hit.userData.signalId as string;
      if (!signalId) return;

      const signal = signals.find((s) => s.id === signalId);
      if (!signal || signal.isExpired || signal.isGreen) return; // already green -- ignore

      const hitWorldPos = new THREE.Vector3();
      hit.getWorldPosition(hitWorldPos);
      const dist = trainPositionRef.current.distanceTo(hitWorldPos);
      if (dist > GRAB_CONFIG.SIGNAL_GRAB_DISTANCE) return;

      setSignalGreen(signalId);
      incrementLevelSignals();
      console.log(`Signal ${signalId} turned green`);
    },
    [signals, setSignalGreen, trainPositionRef, incrementLevelSignals],
  );

  const handleClick = useCallback(() => {
    raycaster.current.setFromCamera(pointerRef.current, camera);

    // check rubies first
    const rubyIntersects = raycaster.current.intersectObjects(getRubyMeshes());

    if (rubyIntersects.length > 0) {
      const hit = rubyIntersects[0].object as THREE.Mesh;
      const hitWorldPos = new THREE.Vector3();
      hit.getWorldPosition(hitWorldPos);
      const dist = trainPositionRef.current.distanceTo(hitWorldPos);
      if (dist <= GRAB_CONFIG.GRAB_DISTANCE) {
        handleRubyGrab(hit);
        return;
      }
    }

    // check mailbags
    const bagIntersects =
      raycaster.current.intersectObjects(getMailbagMeshes());

    if (bagIntersects.length > 0) {
      const hit = bagIntersects[0].object as THREE.Mesh;
      const hitWorldPos = new THREE.Vector3();
      hit.getWorldPosition(hitWorldPos);
      const dist = trainPositionRef.current.distanceTo(hitWorldPos);
      if (dist <= GRAB_CONFIG.GRAB_DISTANCE) {
        handleMailbagGrab(hit);
        return;
      }
    }

    // check signals
    const signalIntersects =
      raycaster.current.intersectObjects(getSignalMeshes());
    if (signalIntersects.length > 0) {
      const hit = signalIntersects[0].object as THREE.Mesh;
      handleSignalGrab(hit);
      return;
    }
  }, [
    camera,
    getRubyMeshes,
    getMailbagMeshes,
    getSignalMeshes,
    trainPositionRef,
    handleMailbagGrab,
    handleRubyGrab,
    handleSignalGrab,
  ]);

  useEffect(() => {
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [handleClick]);

  // raycast each frame -- update crosshair active state
  useFrame(({ pointer }) => {
    // store pointer for use in click handler
    pointerRef.current.copy(pointer);

    raycaster.current.setFromCamera(pointer, camera);

    const rubyIntersects = raycaster.current.intersectObjects(getRubyMeshes());

    // check mailbags
    const bagIntersects =
      raycaster.current.intersectObjects(getMailbagMeshes());

    const signalIntersects =
      raycaster.current.intersectObjects(getSignalMeshes());

    // find closest hit across both types
    const allIntersects = [
      ...rubyIntersects,
      ...bagIntersects,
      ...signalIntersects,
    ].sort((a, b) => a.distance - b.distance);

    if (allIntersects.length > 0) {
      const hitWorldPos = new THREE.Vector3();
      allIntersects[0].object.getWorldPosition(hitWorldPos);
      const dist = trainPositionRef.current.distanceTo(hitWorldPos);

      //signal stuff
      const isSignal = allIntersects[0].object.userData.isSignal;
      const threshold = isSignal
        ? GRAB_CONFIG.SIGNAL_GRAB_DISTANCE
        : GRAB_CONFIG.GRAB_DISTANCE;

      isActiveRef.current = dist < GRAB_CONFIG.GRAB_DISTANCE;
    } else {
      isActiveRef.current = false;
    }
  });

  return null;
}
