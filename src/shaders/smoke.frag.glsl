uniform float uTime;

varying vec2  vUv;
varying float vHeightT;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = noise(i);
  float b = noise(i + vec2(1.0, 0.0));
  float c = noise(i + vec2(0.0, 1.0));
  float d = noise(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  // edge fade -- sine based, no seam
  float edgeFade = sin(vUv.x * 3.14159);
  edgeFade       = pow(edgeFade, 0.6);  // softer than before

  // length fade
  float lengthFade = pow(1.0 - vHeightT, 1.0) *
                     smoothstep(0.0, 0.15, vHeightT);

  // scrolling noise -- creates puff-like density variation
  vec2 noiseCoord = vec2(vUv.x * 2.0, vUv.y * 1.5 - uTime * 0.35);
  float puffNoise = smoothNoise(noiseCoord);

  // second noise layer
  vec2 noiseCoord2 = vec2(vUv.x * 4.0 + 0.3, vUv.y * 3.0 - uTime * 0.5);
  float puffNoise2 = smoothNoise(noiseCoord2);

  float combinedNoise = puffNoise * 0.6 + puffNoise2 * 0.4;

  // use noise to erode the edges -- creates billowy irregular outline
  float alpha = edgeFade * lengthFade;

  // noise erodes alpha -- darker areas become transparent
  // this creates the puff effect
  alpha *= smoothstep(0.2, 0.7, combinedNoise + edgeFade * 0.5);

  // overall opacity
  alpha = clamp(alpha, 0.0, 0.7);

  // color
  vec3 darkSmoke  = vec3(0.15, 0.15, 0.15);
  vec3 lightSmoke = vec3(0.7,  0.7,  0.7);
  vec3 color      = mix(darkSmoke, lightSmoke, vHeightT);

  // noise also affects color -- darker in denser areas
  color *= 0.7 + combinedNoise * 0.5;

  // warm tip
  vec3 warmTip = vec3(0.3, 0.2, 0.15);
  color        = mix(warmTip, color, min(vHeightT * 3.0, 1.0));

  gl_FragColor = vec4(color, alpha);
}