varying vec2 vUv;
varying vec2 vPos;  // local XY position

void main() {
  vUv = uv;
  vPos = position.xy;  // local space position
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}