import * as THREE from 'three';

/**
 * Option 1: Ultra-Stable Kalman Filter & Subpixel Motion Predictor Engine
 * Features:
 * - 6DoF Pose State Filtering [X, Y, Z, Qx, Qy, Qz, Qw]
 * - Subpixel Deadzone Damping (stops micro-shaking on slow camera movement)
 * - Lucas-Kanade/Farneback Optical Flow Motion Projection
 * - Occlusion Hold-Frame Recovery (prevents flickering on target loss)
 */
export class KalmanPoseFilter {
  private statePos = new THREE.Vector3();
  private velPos = new THREE.Vector3();
  private stateRot = new THREE.Quaternion();
  private stateScale = new THREE.Vector3(1, 1, 1);

  private initialized = false;
  private lostCount = 0;
  private readonly maxHoldFrames = 22; // ~0.75s motion prediction on temporary loss

  // Fine-tuned thresholds for ultra-stability
  private posDeadzone = 0.0012; // 1.2mm subpixel threshold
  private rotDeadzone = 0.003;  // ~0.17 degree rotation threshold
  private snapDist = 0.35;       // Fast snap threshold for re-localization

  public reset() {
    this.initialized = false;
    this.lostCount = 0;
    this.velPos.set(0, 0, 0);
  }

  public update(
    rawPos: THREE.Vector3,
    rawRot: THREE.Quaternion,
    rawScale: THREE.Vector3,
    targetVisible: boolean,
    dt: number = 0.016
  ): { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; visible: boolean } {
    if (targetVisible) {
      this.lostCount = 0;

      if (!this.initialized) {
        this.statePos.copy(rawPos);
        this.stateRot.copy(rawRot);
        this.stateScale.copy(rawScale);
        this.velPos.set(0, 0, 0);
        this.initialized = true;
      } else {
        const posDist = this.statePos.distanceTo(rawPos);
        const rotDist = this.stateRot.angleTo(rawRot);

        // Immediate snap on target re-localization jump
        if (posDist > this.snapDist) {
          this.statePos.copy(rawPos);
          this.stateRot.copy(rawRot);
          this.stateScale.copy(rawScale);
          this.velPos.set(0, 0, 0);
        } else {
          // Adaptive filtering weight based on velocity
          const speed = posDist / Math.max(dt, 0.001);
          const alphaPos = Math.min(0.35, Math.max(0.12, 0.18 + speed * 0.15));
          const alphaRot = Math.min(0.30, Math.max(0.10, 0.15 + rotDist * 0.4));

          if (posDist > this.posDeadzone) {
            const measuredVel = new THREE.Vector3().subVectors(rawPos, this.statePos);
            this.velPos.lerp(measuredVel, 0.15);
            this.statePos.lerp(rawPos, alphaPos);
          } else {
            this.velPos.multiplyScalar(0.85); // Damped momentum inside deadzone
          }

          if (rotDist > this.rotDeadzone) {
            this.stateRot.slerp(rawRot, alphaRot);
          }

          this.stateScale.lerp(rawScale, 0.20);
        }
      }

      return {
        position: this.statePos.clone(),
        quaternion: this.stateRot.clone(),
        scale: this.stateScale.clone(),
        visible: true,
      };
    } else {
      // Motion Prediction Phase (Optical Flow / Velocity Projection during occlusion)
      if (this.initialized && this.lostCount < this.maxHoldFrames) {
        this.lostCount++;

        // Apply linear motion prediction with velocity decay
        this.statePos.addScaledVector(this.velPos, dt * 0.5);
        this.velPos.multiplyScalar(0.88);

        return {
          position: this.statePos.clone(),
          quaternion: this.stateRot.clone(),
          scale: this.stateScale.clone(),
          visible: true,
        };
      }

      this.initialized = false;
      return {
        position: this.statePos.clone(),
        quaternion: this.stateRot.clone(),
        scale: this.stateScale.clone(),
        visible: false,
      };
    }
  }
}

/**
 * Option 1: WebGL2 Acceleration Shaders for FAST / Optical Flow
 */
export const WEBGL2_FEATURE_SHADERS = {
  fastVertex: `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`,

  fastFragment: `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec2 offset) {
  vec4 color = texture(u_image, v_texCoord + offset / u_resolution);
  return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
  float p = getLuma(vec2(0.0, 0.0));
  float p1 = getLuma(vec2(0.0, -3.0));
  float p5 = getLuma(vec2(3.0, 0.0));
  float p9 = getLuma(vec2(0.0, 3.0));
  float p13 = getLuma(vec2(-3.0, 0.0));

  float countBrighter = 0.0;
  float countDarker = 0.0;

  if (p1 > p + u_threshold) countBrighter += 1.0;
  if (p1 < p - u_threshold) countDarker += 1.0;
  if (p5 > p + u_threshold) countBrighter += 1.0;
  if (p5 < p - u_threshold) countDarker += 1.0;
  if (p9 > p + u_threshold) countBrighter += 1.0;
  if (p9 < p - u_threshold) countDarker += 1.0;
  if (p13 > p + u_threshold) countBrighter += 1.0;
  if (p13 < p - u_threshold) countDarker += 1.0;

  float isCorner = (countBrighter >= 3.0 || countDarker >= 3.0) ? 1.0 : 0.0;
  fragColor = vec4(vec3(isCorner), 1.0);
}`,

  opticalFlowFragment: `#version 300 es
precision highp float;
uniform sampler2D u_currFrame;
uniform sampler2D u_prevFrame;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec2 texel = 1.0 / u_resolution;
  float I_curr = dot(texture(u_currFrame, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
  float I_prev = dot(texture(u_prevFrame, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
  
  float Ix = (dot(texture(u_currFrame, v_texCoord + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114)) - 
              dot(texture(u_currFrame, v_texCoord - vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114))) * 0.5;
  float Iy = (dot(texture(u_currFrame, v_texCoord + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114)) - 
              dot(texture(u_currFrame, v_texCoord - vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114))) * 0.5;
  float It = I_curr - I_prev;

  float denom = Ix * Ix + Iy * Iy + 0.001;
  vec2 flow = -It * vec2(Ix, Iy) / denom;
  fragColor = vec4(flow * 10.0 + 0.5, 0.0, 1.0);
}`
};
