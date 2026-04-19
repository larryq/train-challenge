#include <fog_pars_fragment>

uniform vec3 uColorSoil;
uniform vec3 uColorGrassLow;
uniform vec3 uColorGrassMid;
uniform vec3 uColorGrassDry;

varying vec3 vWorldPos;
varying vec3 vNormal;

float hash(float x, float y) {
  float h = x * 127.1 + y * 311.7;
  return fract(sin(h) * 43758.5453123);
}

float noise2D(float x, float y) {
  float ix = floor(x);
  float iy = floor(y);
  float fx = fract(x);
  float fy = fract(y);
  float ux = fx * fx * (3.0 - 2.0 * fx);
  float uy = fy * fy * (3.0 - 2.0 * fy);
  float a = hash(ix,       iy);
  float b = hash(ix + 1.0, iy);
  float c = hash(ix,       iy + 1.0);
  float d = hash(ix + 1.0, iy + 1.0);
  return a + (b - a) * ux + (c - a) * uy +
    (b - a + a - b + d - c) * ux * uy;
}

void main() {


float largeNoise  = noise2D(vWorldPos.x * 0.03, vWorldPos.z * 0.03);
float medNoise    = noise2D(vWorldPos.x * 0.08, vWorldPos.z * 0.08) * 0.4;
float smallNoise  = noise2D(vWorldPos.x * 0.20, vWorldPos.z * 0.20) * 0.2;
float colorNoise  = clamp(largeNoise + medNoise + smallNoise, 0.0, 1.3);

//   vec3 color;
//   if (colorNoise < 0.5) {
//     color = mix(uColorSoil, uColorGrassLow, colorNoise / 0.5);
//   } else if (colorNoise < 0.9) {
//     color = mix(uColorGrassLow, uColorGrassMid, (colorNoise - 0.5) / 0.4);
//   } else {
//     color = mix(uColorGrassMid, uColorGrassDry, (colorNoise - 0.9) / 0.4);
//   }

vec3 color = uColorGrassLow;
color = mix(color, uColorSoil,     smoothstep(0.3, 0.5, colorNoise));
color = mix(color, uColorGrassMid, smoothstep(0.5, 0.8, colorNoise));
color = mix(color, uColorGrassDry, smoothstep(0.8, 1.1, colorNoise));



  // simple lighting
  vec3 sunDir = normalize(vec3(100.0, 30.0, -400.0));
  float diff = max(dot(normalize(vNormal), sunDir), 0.5);
  color *= diff;

  // sky fill
  float skyFill = max(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)), 0.0) * 0.3;
  color += color * skyFill;
//float noise = random(vUv * 100.0); // Simple random function
  gl_FragColor = vec4(color, 1.0);
  //gl_FragColor = vec4(color.rgb , 1.0);

  #include <fog_fragment>
}


// #include <fog_pars_fragment>

// uniform vec3 uColorSoil;
// uniform vec3 uColorGrassLow;
// uniform vec3 uColorGrassMid;
// uniform vec3 uColorGrassDry;

// varying vec3 vWorldPos;
// varying vec3 vNormal;

// vec2 gradientHash(vec2 p) {
//   p = vec2(
//     dot(p, vec2(127.1, 311.7)),
//     dot(p, vec2(269.5, 183.3))
//   );
//   return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
// }

// float gradientNoise(vec2 p) {
//   vec2 i = floor(p);
//   vec2 f = fract(p);

//   // quintic interpolation
//   vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

//   float a = dot(gradientHash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
//   float b = dot(gradientHash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
//   float c = dot(gradientHash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
//   float d = dot(gradientHash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

//   return a + (b - a) * u.x +
//              (c - a) * u.y +
//              (b - a + a - b + d - c) * u.x * u.y;
// }

// float fbm(vec2 p) {
//   float value     = 0.0;
//   float amplitude = 0.5;
//   float frequency = 1.0;

//   for (int i = 0; i < 4; i++) {
//     // remap from -1..1 to 0..1
//     value     += (gradientNoise(p * frequency) * 0.5 + 0.5) * amplitude;
//     amplitude *= 0.5;
//     frequency *= 2.1;
//   }

//   return value;
// }

// void main() {
//   vec2 worldXZ = vec2(vWorldPos.x, vWorldPos.z);

//   // multi-scale color variation
//   float largeScale = fbm(worldXZ * 0.03);        // large patches
//   float medScale   = fbm(worldXZ * 0.08) * 0.4;  // medium detail
//   float smallScale = fbm(worldXZ * 0.20) * 0.2;  // fine detail

//   float colorNoise = clamp(largeScale + medScale + smallScale, 0.0, 1.0);

//   // smooth color blending
//   vec3 color = uColorGrassLow;
//   color = mix(color, uColorSoil,     smoothstep(0.15, 0.30, colorNoise));
//   color = mix(color, uColorGrassMid, smoothstep(0.45, 0.65, colorNoise));
//   color = mix(color, uColorGrassDry, smoothstep(0.75, 0.95, colorNoise));

//   // lighting
//   vec3 sunDir = normalize(vec3(100.0, 30.0, -400.0));
//   float diff = max(dot(normalize(vNormal), sunDir), 0.5);
//   color *= diff;

//   // sky fill
//   float skyFill = max(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)), 0.0) * 0.3;
//   color += color * skyFill;

//   gl_FragColor = vec4(color, 1.0);

//   #include <fog_fragment>
// }