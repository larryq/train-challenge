import * as THREE from "three";
import { useEntityStore } from "../../stores/useEntityStore";
import { Mailbag } from "./Mailbag";

interface MailbagsProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function Mailbags({ trainPositionRef }: MailbagsProps) {
  const mailbags = useEntityStore((s) => s.mailbags);

  return (
    <>
      {mailbags.map((bag) => (
        <Mailbag
          key={bag.id}
          mailbag={bag}
          trainPositionRef={trainPositionRef}
        />
      ))}
    </>
  );
}
