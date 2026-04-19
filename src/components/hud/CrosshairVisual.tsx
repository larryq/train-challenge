import { useEffect, useState, useRef } from "react";
import { GRAB_CONFIG } from "../../lib/grabConfig";

interface CrosshairVisualProps {
  isActiveRef: React.MutableRefObject<boolean>;
  mouseScreenRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function CrosshairVisual({
  isActiveRef,
  mouseScreenRef,
}: CrosshairVisualProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const frameRef = useRef<number>(0);

  // poll refs each animation frame to update DOM
  useEffect(() => {
    const tick = () => {
      setPos({ ...mouseScreenRef.current });
      setIsActive(isActiveRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isActiveRef, mouseScreenRef]);

  const size = GRAB_CONFIG.CROSSHAIR_SIZE;
  const half = size / 2;
  const color = isActive
    ? GRAB_CONFIG.CROSSHAIR_COLOR_ACTIVE
    : GRAB_CONFIG.CROSSHAIR_COLOR_DEFAULT;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x - half,
        top: pos.y - half,
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

        {/* altimeter ticks -- short near top/bottom, longer toward center */}
        {/* top ticks */}
        <line
          x1={half - 4}
          y1={14}
          x2={half + 4}
          y2={14}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={half - 7}
          y1={22}
          x2={half + 7}
          y2={22}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={half - 10}
          y1={30}
          x2={half + 10}
          y2={30}
          stroke={color}
          strokeWidth={1.5}
        />

        {/* bottom ticks -- mirrored */}
        <line
          x1={half - 4}
          y1={size - 14}
          x2={half + 4}
          y2={size - 14}
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
