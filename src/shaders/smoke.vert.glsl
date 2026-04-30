uniform float uLeanAmount;
uniform float uTime;

varying vec2  vUv;
varying float vHeightT;

// simple noise function
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);  // smoothstep

  float a = noise(i);
  float b = noise(i + vec2(1.0, 0.0));
  float c = noise(i + vec2(0.0, 1.0));
  float d = noise(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vUv           = uv;
  float heightT = uv.y;
  vHeightT      = heightT;

  vec3 pos = position;

  // lean backward
  pos.z -= heightT * uLeanAmount;

  // widen as it rises
  float spreadFactor = 1.0 + heightT * 1.2;
  pos.x *= spreadFactor;
  pos.z *= spreadFactor;

  // strong billowing noise displacement
  // scrolls upward over time -- gives rising smoke feel
  vec2 noiseCoord = vec2(uv.x * 2.0, uv.y * 1.5 - uTime * 0.4);
  float billow    = smoothNoise(noiseCoord) * 2.0 - 1.0;  // -1 to 1

  // secondary noise layer at different scale and speed
  vec2 noiseCoord2 = vec2(uv.x * 3.5 + 0.5, uv.y * 2.0 - uTime * 0.6);
  float billow2    = smoothNoise(noiseCoord2) * 2.0 - 1.0;

  // combine noise layers
  float totalBillow = billow * 0.6 + billow2 * 0.4;

  // displacement increases with height -- more turbulent at top
  float dispStrength = heightT * 0.8;
  pos.x += totalBillow * dispStrength;
  pos.z += totalBillow * dispStrength * 0.5;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}