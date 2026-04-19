import { useRef, useEffect, useState, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GRAB_CONFIG } from "../../lib/grabConfig";
import { useEntityStore } from "../../stores/useEntityStore";

interface CrosshairHUDProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function CrosshairHUD({ trainPositionRef }: CrosshairHUDProps) {
  const { camera, scene } = useThree();
  const mousePos = useRef(new THREE.Vector2(0, 0));
  const raycaster = useRef(new THREE.Raycaster());
  const [isActive, setIsActive] = useState(false);
  const [mouseXY, setMouseXY] = useState({ x: 0, y: 0 });
  const hoveredClusterId = useRef<string | null>(null);
  const hoveredRubyIndex = useRef<0 | 1 | 2 | null>(null);

  const rubyClusters = useEntityStore((s) => s.rubyClusters);
  const grabRuby = useEntityStore((s) => s.grabRuby);

  // track mouse position
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      setMouseXY({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // handle click -- grab if hovering a ruby
  const handleClick = useCallback(() => {
    if (!hoveredClusterId.current || hoveredRubyIndex.current === null) return;

    const cluster = rubyClusters.find((c) => c.id === hoveredClusterId.current);
    if (!cluster || cluster.isExpired) return;

    const dist = trainPositionRef.current.distanceTo(cluster.position);
    if (dist > GRAB_CONFIG.GRAB_DISTANCE) return;

    grabRuby(cluster.id, hoveredRubyIndex.current);
  }, [rubyClusters, grabRuby, trainPositionRef]);

  useEffect(() => {
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [handleClick]);

  // raycast each frame
  useFrame(() => {
    raycaster.current.setFromCamera(mousePos.current, camera);

    // collect all ruby meshes from scene
    const rubyMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isRuby) {
        rubyMeshes.push(obj);
      }
    });

    const intersects = raycaster.current.intersectObjects(rubyMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const dist = trainPositionRef.current.distanceTo(hit.object.position);

      if (dist < GRAB_CONFIG.GRAB_DISTANCE) {
        // find which cluster this ruby belongs to
        // walk up the scene graph to find the cluster group
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData.clusterId) {
          obj = obj.parent;
        }

        if (obj?.userData.clusterId) {
          hoveredClusterId.current = obj.userData.clusterId;
          hoveredRubyIndex.current = hit.object.userData.rubyIndex;
          setIsActive(true);
          return;
        }
      }
    }

    hoveredClusterId.current = null;
    hoveredRubyIndex.current = null;
    setIsActive(false);
  });

  const size = GRAB_CONFIG.CROSSHAIR_SIZE;
  const half = size / 2;
  const color = isActive
    ? GRAB_CONFIG.CROSSHAIR_COLOR_ACTIVE
    : GRAB_CONFIG.CROSSHAIR_COLOR_DEFAULT;

  return (
    <div
      style={{
        position: "fixed",
        left: mouseXY.x - half,
        top: mouseXY.y - half,
        width: size,
        height: size,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* outer circle */}
        <circle
          cx={half}
          cy={half}
          r={half - 2}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />

        {/* vertical center line */}
        <line
          x1={half}
          y1={8}
          x2={half}
          y2={size - 8}
          stroke={color}
          strokeWidth={1}
        />

        {/* altimeter tick marks on vertical line */}
        {/* short ticks near top and bottom */}
        <line
          x1={half - 4}
          y1={14}
          x2={half + 4}
          y2={14}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={half - 4}
          y1={size - 14}
          x2={half + 4}
          y2={size - 14}
          stroke={color}
          strokeWidth={1}
        />

        {/* medium ticks */}
        <line
          x1={half - 7}
          y1={22}
          x2={half + 7}
          y2={22}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={half - 7}
          y1={size - 22}
          x2={half + 7}
          y2={size - 22}
          stroke={color}
          strokeWidth={1}
        />

        {/* longer ticks toward center */}
        <line
          x1={half - 10}
          y1={30}
          x2={half + 10}
          y2={30}
          stroke={color}
          strokeWidth={1.5}
        />
        <line
          x1={half - 10}
          y1={size - 30}
          x2={half + 10}
          y2={size - 30}
          stroke={color}
          strokeWidth={1.5}
        />

        {/* center dot */}
        <circle cx={half} cy={half} r={2} fill={color} />
      </svg>
    </div>
  );
}
