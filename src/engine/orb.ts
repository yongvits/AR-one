/**
 * ORB Descriptor Extractor (Intensity Centroid Orientation + Rotated BRIEF 256-bit Binary Descriptors)
 */

import { Keypoint } from './fast';

export class ORBExtractor {
  // Precomputed 256 BRIEF test pattern pairs [-15..15]
  private static BRIEF_PATTERN: number[] = ORBExtractor.generateBriefPattern();

  /**
   * Calculates Intensity Centroid orientation angle for rotation invariance
   */
  public computeOrientations(
    keypoints: Keypoint[],
    data: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
  ): void {
    const halfPatch = 15;

    for (let k = 0; k < keypoints.length; k++) {
      const kp = keypoints[k];
      const cx = Math.round(kp.x);
      const cy = Math.round(kp.y);

      if (cx < halfPatch || cy < halfPatch || cx >= width - halfPatch || cy >= height - halfPatch) {
        kp.angle = 0;
        continue;
      }

      let m10 = 0;
      let m01 = 0;

      for (let dy = -halfPatch; dy <= halfPatch; dy++) {
        const rowPtr = (cy + dy) * width;
        for (let dx = -halfPatch; dx <= halfPatch; dx++) {
          const val = data[rowPtr + (cx + dx)];
          m10 += dx * val;
          m01 += dy * val;
        }
      }

      kp.angle = Math.atan2(m01, m10);
    }
  }

  /**
   * Computes 32-byte (256-bit) rBRIEF descriptor for each keypoint
   */
  public computeDescriptors(
    keypoints: Keypoint[],
    data: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8Array[] {
    this.computeOrientations(keypoints, data, width, height);

    const pattern = ORBExtractor.BRIEF_PATTERN;
    const descriptors: Uint8Array[] = [];

    for (let k = 0; k < keypoints.length; k++) {
      const kp = keypoints[k];
      const desc = new Uint8Array(32);
      const cosA = Math.cos(kp.angle);
      const sinA = Math.sin(kp.angle);

      const cx = kp.x;
      const cy = kp.y;

      let bitIdx = 0;
      for (let i = 0; i < 256; i++) {
        const x1 = pattern[i * 4];
        const y1 = pattern[i * 4 + 1];
        const x2 = pattern[i * 4 + 2];
        const y2 = pattern[i * 4 + 3];

        // Rotated sample coordinates
        const rx1 = Math.round(cx + (x1 * cosA - y1 * sinA));
        const ry1 = Math.round(cy + (x1 * sinA + y1 * cosA));
        const rx2 = Math.round(cx + (x2 * cosA - y2 * sinA));
        const ry2 = Math.round(cy + (x2 * sinA + y2 * cosA));

        const val1 = this.getSample(data, width, height, rx1, ry1);
        const val2 = this.getSample(data, width, height, rx2, ry2);

        if (val1 < val2) {
          const byteIdx = Math.floor(bitIdx / 8);
          const bitPos = bitIdx % 8;
          desc[byteIdx] |= (1 << bitPos);
        }
        bitIdx++;
      }

      descriptors.push(desc);
    }

    return descriptors;
  }

  private getSample(data: Uint8Array | Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return data[y * w + x];
  }

  private static generateBriefPattern(): number[] {
    const arr: number[] = [];
    // Standard BRIEF sampling grid
    for (let i = 0; i < 256; i++) {
      const x1 = Math.round((Math.sin(i * 1.7) * 14));
      const y1 = Math.round((Math.cos(i * 2.3) * 14));
      const x2 = Math.round((Math.sin(i * 3.1 + 1) * 14));
      const y2 = Math.round((Math.cos(i * 4.1 + 1) * 14));
      arr.push(x1, y1, x2, y2);
    }
    return arr;
  }
}
