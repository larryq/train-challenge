#include <fog_pars_vertex>

uniform vec3 uLakeCenter;

varying vec3 vWorldPos;
varying float vDistFromCenter;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;

  // distance from lake center in XZ plane
  float dx = worldPosition.x - uLakeCenter.x;
  float dz = worldPosition.z - uLakeCenter.z;
  vDistFromCenter = sqrt(dx * dx + dz * dz);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}