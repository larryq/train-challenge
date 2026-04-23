uniform float uTime;
uniform float uCurvature;
varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    // 1. Time-based "Burst" Gate
    // This creates a window that opens and closes rapidly
    // Higher curvature = faster, more frequent bursts
    float burstSpeed = 15.0 + (uCurvature * 20.0);
    float burstGate = sin(uTime * burstSpeed); 
    
    // We only want the peaks of the sine wave to "fire" the fireworks
    float burstTrigger = smoothstep(0.4, 0.9, burstGate);

    // 2. The Spray Mask
    vec2 contactPoint = vec2(0.5, 0.0);
    float distFromContact = distance(vUv, contactPoint);
    float angle = atan(vUv.x - 0.5, vUv.y + 0.1);
    float sprayShape = smoothstep(1.2, 0.2, abs(angle)); 

    // 3. Firework "Pellet" Logic
    vec2 stretchedUv = vUv;
    // We move the UVs very fast to simulate high-velocity ejection
    float velocity = 25.0 + (uCurvature * 20.0);
    stretchedUv.y += uTime * velocity;

    // A chaotic grid scale
    vec2 gridScale = vec2(40.0, 60.0); 
    vec2 gridId = floor(stretchedUv * gridScale);
    vec2 gridCoords = fract(stretchedUv * gridScale);

    float noise = hash(gridId + floor(uTime * 10.0)); // Shift noise over time
    
    // 4. Density logic
    float threshold = mix(0.99, 0.6, uCurvature);
    
    float sparkDisplay = 0.0;
    if (noise > threshold) {
        // Shapes the "pellet" - rounder and brighter than the previous streaks
        float pellet = smoothstep(0.8, 0.1, distance(gridCoords, vec2(0.5)));
        
        // Combine with our burst trigger
        sparkDisplay = pellet * burstTrigger;
    }

    // 5. Intense Color (White-hot core)
    vec3 coreColor = vec3(1.0, 1.0, 1.0);
    vec3 midColor = vec3(1.0, 0.8, 0.2); // Yellow/Gold
    vec3 edgeColor = vec3(1.0, 0.2, 0.0); // Red/Orange
    
    vec3 finalColor = mix(edgeColor, midColor, sparkDisplay);
    finalColor = mix(finalColor, coreColor, pow(sparkDisplay, 3.0));

    // 6. Final Alpha
    // Distance fade ensures they die out as they fly away from the wheel
    float lifeFade = smoothstep(1.0, 0.0, distFromContact);
    float alpha = sparkDisplay * sprayShape * lifeFade;

    gl_FragColor = vec4(finalColor * 2.0, alpha);
}