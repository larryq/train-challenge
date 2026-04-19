import * as THREE from "three";
import { useEntityStore } from "../../stores/useEntityStore";
import { RubyCluster } from "./RubyCluster";

interface RubyClustersProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function RubyClusters({ trainPositionRef }: RubyClustersProps) {
  const rubyClusters = useEntityStore((s) => s.rubyClusters);

  return (
    <>
      {rubyClusters.map((cluster) => (
        <RubyCluster
          key={cluster.id}
          cluster={cluster}
          trainPositionRef={trainPositionRef}
        />
      ))}
    </>
  );
}
