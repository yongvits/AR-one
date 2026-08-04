/**
 * 6DoF Kalman Filter Engine with Subpixel Deadzone Damping & Occlusion Prediction
 */

import * as THREE from 'three';

export interface PoseState {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  visible: boolean;
}

export class KalmanPoseFilter {
  private statePos = new THREE.Vector3();
  private velPos = new THREE.Vector3();
  private stateRot = new THREE.Quaternion();
  private stateScale = new THREE.Vector3(1, 1, 1);

  private initialized = false;
  private lostCount = 0;
  private readonly maxHoldFrames = 25; // Hold pose during brief occlusion (~0.8s)

  // Subpixel deadzone thresholds
  private posDeadzone = 0.0010; // 1.0mm deadzone
  private rotDeadzone = 0.0025; // ~0.14 degree deadzone
  private snapDist = 0.40;       // Fast re-localization snap threshold

  public reset(): void {
    this.initialized = false;
    this.lostCount = 0;
    this.velPos.set(0, 0, 0);
  }

  public update(
    rawPos: THREE.Vector3,
    rawRot: THREE.Quaternion,
    rawScale: THREE.Vector3,
    targetVisible: boolean,
    dt = 0.016
  ): PoseState {
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

        if (posDist > this.snapDist) {
          // Re-localization snap
          this.statePos.copy(rawPos);
          this.stateRot.copy(rawRot);
          this.stateScale.copy(rawScale);
          this.velPos.set(0, 0, 0);
        } else {
          // Velocity adaptive lerp
          const speed = posDist / Math.max(dt, 0.001);
          const alphaPos = Math.min(0.38, Math.max(0.12, 0.16 + speed * 0.12));
          const alphaRot = Math.min(0.32, Math.max(0.10, 0.14 + rotDist * 0.35));

          if (posDist > this.posDeadzone) {
            const measuredVel = new THREE.Vector3().subVectors(rawPos, this.statePos);
            this.velPos.lerp(measuredVel, 0.18);
            this.statePos.lerp(rawPos, alphaPos);
          } else {
            this.velPos.multiplyScalar(0.82); // Damped momentum
          }

          if (rotDist > this.rotDeadzone) {
            this.stateRot.slerp(rawRot, alphaRot);
          }

          this.stateScale.lerp(rawScale, 0.22);
        }
      }

      return {
        position: this.statePos.clone(),
        quaternion: this.stateRot.clone(),
        scale: this.stateScale.clone(),
        visible: true
      };
    } else {
      // Occlusion hold & velocity prediction
      if (this.initialized && this.lostCount < this.maxHoldFrames) {
        this.lostCount++;

        this.statePos.addScaledVector(this.velPos, dt * 0.45);
        this.velPos.multiplyScalar(0.85);

        return {
          position: this.statePos.clone(),
          quaternion: this.stateRot.clone(),
          scale: this.stateScale.clone(),
          visible: true
        };
      }

      this.initialized = false;
      return {
        position: this.statePos.clone(),
        quaternion: this.stateRot.clone(),
        scale: this.stateScale.clone(),
        visible: false
      };
    }
  }
}
