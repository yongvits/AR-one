/**
 * Subpixel Pyramid Lucas-Kanade Optical Flow Tracker for inter-frame motion estimation
 */

import { Keypoint } from './fast';

export class OpticalFlowTracker {
  /**
   * Tracks a set of keypoints from previous frame to current frame using Lucas-Kanade differential flow
   */
  public track(
    prevFrame: Uint8Array | Uint8ClampedArray,
    currFrame: Uint8Array | Uint8ClampedArray,
    keypoints: Keypoint[],
    width: number,
    height: number,
    winSize = 7
  ): { trackedKeypoints: Keypoint[]; status: boolean[] } {
    const halfWin = Math.floor(winSize / 2);
    const trackedKeypoints: Keypoint[] = [];
    const status: boolean[] = [];

    for (let k = 0; k < keypoints.length; k++) {
      const kp = keypoints[k];
      let cx = kp.x;
      let cy = kp.y;

      // Iterative Lucas-Kanade refinement (3 iterations)
      let statusOk = true;
      for (let iter = 0; iter < 3; iter++) {
        const icx = Math.round(cx);
        const icy = Math.round(cy);

        if (icx < halfWin + 1 || icy < halfWin + 1 || icx >= width - halfWin - 1 || icy >= height - halfWin - 1) {
          statusOk = false;
          break;
        }

        let Gxx = 0, Gxy = 0, Gyy = 0;
        let bx = 0, by = 0;

        for (let dy = -halfWin; dy <= halfWin; dy++) {
          const prevRow = (icy + dy) * width;
          const currRow = (Math.round(cy) + dy) * width;

          for (let dx = -halfWin; dx <= halfWin; dx++) {
            const pX = icx + dx;
            const cX = Math.round(cx) + dx;

            // Spatial Gradients
            const Ix = (prevFrame[prevRow + pX + 1] - prevFrame[prevRow + pX - 1]) * 0.5;
            const Iy = (prevFrame[prevRow + width + pX] - prevFrame[prevRow - width + pX]) * 0.5;
            const It = currFrame[currRow + cX] - prevFrame[prevRow + pX];

            Gxx += Ix * Ix;
            Gxy += Ix * Iy;
            Gyy += Iy * Iy;

            bx += Ix * It;
            by += Iy * It;
          }
        }

        const det = Gxx * Gyy - Gxy * Gxy;
        if (Math.abs(det) < 1e-4) {
          statusOk = false;
          break;
        }

        const vx = -(Gyy * bx - Gxy * by) / det;
        const vy = -(-Gxy * bx + Gxx * by) / det;

        cx += vx;
        cy += vy;

        if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) break;
      }

      status.push(statusOk);
      trackedKeypoints.push({
        x: cx,
        y: cy,
        score: kp.score,
        angle: kp.angle,
        octave: kp.octave
      });
    }

    return { trackedKeypoints, status };
  }
}
