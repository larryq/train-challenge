import * as THREE from "three";
import { useEntityStore } from "../../stores/useEntityStore";
import { Signal } from "./Signal";

interface SignalsProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function Signals({ trainPositionRef }: SignalsProps) {
  const signals = useEntityStore((s) => s.signals);

  return (
    <>
      {signals.map((signal) => (
        <Signal
          key={signal.id}
          signal={signal}
          trainPositionRef={trainPositionRef}
        />
      ))}
    </>
  );
}
