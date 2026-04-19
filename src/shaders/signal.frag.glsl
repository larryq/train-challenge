uniform float uTime;
uniform bool  uIsGreen;
uniform float uPulseSpeed;

void main() {
  if (uIsGreen) {
    // solid green -- no pulse
    gl_FragColor = vec4(0.0, 1.0, 0.2, 1.0);
  } else {
    // pulse red -- smooth sine wave between 0.4 and 1.0
    float pulse = sin(uTime * uPulseSpeed) * 0.3 + 0.7;
    gl_FragColor = vec4(pulse, 0.0, 0.0, 1.0);
  }
}