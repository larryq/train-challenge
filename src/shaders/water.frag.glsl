#include <fog_pars_fragment>

uniform float uTime;
uniform float uLakeRadius;
uniform float uOpacity;
uniform float uWaveStrength;
uniform float uWaveSpeed;
uniform float uWaveScale;
uniform vec3  uDeepColor;
uniform vec3  uShallowColor;

varying vec3  vWorldPos;
varying float vDistFromCenter;

void main() {
  // depth factor -- 1 at center, 0 at edge
  float depthFactor = 1.0 - clamp(vDistFromCenter / uLakeRadius, 0.0, 1.0);

  // smooth the edge falloff
  depthFactor = depthFactor * depthFactor * (3.0 - 2.0 * depthFactor);

  // two wave layers moving in different directions at different speeds
  float wave1 = sin(
    vWorldPos.x * uWaveScale +
    vWorldPos.z * uWaveScale * 0.5 +
    uTime * uWaveSpeed
  ) * 0.5 + 0.5;

  float wave2 = sin(
    vWorldPos.x * uWaveScale * 0.4 +
    vWorldPos.z * uWaveScale +
    uTime * uWaveSpeed * 0.75 + 1.3
  ) * 0.5 + 0.5;

  // combine waves -- interference pattern
  float waves = (wave1 * 0.6 + wave2 * 0.4);

  // depth-based color -- shallow at edges, deep at center
  vec3 color = mix(uShallowColor, uDeepColor, depthFactor);

  // apply wave brightness modulation -- subtle
  color *= 1.0 + (waves - 0.5) * uWaveStrength;

  // slight sparkle at wave peaks near surface
  float sparkle = pow(wave1 * wave2, 3.0) * 0.15 * depthFactor;
  color += vec3(sparkle);

  // alpha -- edges more transparent than center
  float alpha = mix(0.3, uOpacity, depthFactor)  ;

  gl_FragColor = vec4(color, alpha);

  #include <fog_fragment>
}