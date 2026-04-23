// trainlight.frag.glsl
uniform float uCycleValue;  // 0 = day, 1 = dusk
uniform float uTime;        // for subtle flicker

varying vec2 vUv;
varying vec3 vLocalPos;

void main() {
  // vUv.y = 0 at tip of pyramid, 1 at base
  // bright at tip, fading to transparent at edges and base
  
  // distance from center line
  //float distFromCenter = abs(vUv.x - 0.5) * 2.0;  // 0 at center, 1 at edge
    // distance from the cone's center axis (Y axis for a vertical cone)
  // or Z axis depending on cone orientation in Blender
  float distFromAxis = length(vLocalPos.xz);  // try xz, xy, or yz
  float MAX_RADIUS = 18.0;
  // normalize by max radius -- need to know your cone's max radius
  float distFromCenter = distFromAxis / MAX_RADIUS;
  
  // cone shape -- bright in center, fading at edges
  float coneShape = 1.0 - distFromCenter;
  coneShape = pow(coneShape, 2.0);  // sharpen the falloff
  
  // fade along length -- bright near train, fading toward far end
  float lengthFade = 1.0 - vUv.y;  // bright at tip (y=0), dark at base (y=1)
  lengthFade = pow(lengthFade, 1.5);
  lengthFade=1.0;
  
  // combine
  float intensity = coneShape * lengthFade * uCycleValue;
  
  // subtle flicker
  float flicker = sin(uTime * 8.0) * 0.03 + 0.97;
  intensity *= flicker;
 //intensity =1.0;
  
  // warm white light color
  vec3 color = vec3(1.0, 0.95, 0.8);
  
  gl_FragColor = vec4(color, intensity * 0.3);
}