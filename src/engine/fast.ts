/**
 * FAST (Features from Accelerated Segment Test) Corner Detector & Subpixel Refinement
 */

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  angle: number; // Intensity Centroid Orientation
  octave: number;
}

export class FASTDetector {
  private threshold: number;

  constructor(threshold = 20) {
    this.threshold = threshold;
  }

  /**
   * FAST-9 Corner detection on Uint8ClampedArray image buffer
   */
  public detect(
    data: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    maxFeatures = 500
  ): Keypoint[] {
    const keypoints: Keypoint[] = [];
    const threshold = this.threshold;

    // Fast offset lookup table for radius 3 circle
    const offsets = [
      0 - 3 * width, 1 - 3 * width, 2 - 2 * width, 3 - 1 * width,
      3 + 0 * width, 3 + 1 * width, 2 + 2 * width, 1 + 3 * width,
      0 + 3 * width, -1 + 3 * width, -2 + 2 * width, -3 + 1 * width,
      -3 + 0 * width, -3 - 1 * width, -2 - 2 * width, -1 - 3 * width
    ];

    for (let y = 3; y < height - 3; y += 2) {
      const rowOffset = y * width;
      for (let x = 3; x < width - 3; x += 2) {
        const ptr = rowOffset + x;
        const p = data[ptr];

        // 1, 5, 9, 13 quick rejection test
        const p1 = data[ptr + offsets[0]];
        const p5 = data[ptr + offsets[4]];
        const p9 = data[ptr + offsets[8]];
        const p13 = data[ptr + offsets[12]];

        let b = 0, d = 0;
        if (p1 > p + threshold) b++; if (p1 < p - threshold) d++;
        if (p5 > p + threshold) b++; if (p5 < p - threshold) d++;
        if (p9 > p + threshold) b++; if (p9 < p - threshold) d++;
        if (p13 > p + threshold) b++; if (p13 < p - threshold) d++;

        if (b < 3 && d < 3) continue;

        // Score calculation (Harris/Corner response)
        let score = 0;
        for (let i = 0; i < 16; i++) {
          score += Math.abs(data[ptr + offsets[i]] - p);
        }

        if (score > 120) {
          // Subpixel refinement
          const subX = this.subpixelRefineX(data, width, ptr, p);
          const subY = this.subpixelRefineY(data, width, ptr, p);

          keypoints.push({
            x: x + subX,
            y: y + subY,
            score,
            angle: 0,
            octave: 0
          });
        }
      }
    }

    // Sort by feature score & limit to top maxFeatures
    keypoints.sort((a, b) => b.score - a.score);
    return keypoints.slice(0, maxFeatures);
  }

  private subpixelRefineX(data: Uint8Array | Uint8ClampedArray, width: number, ptr: number, center: number): number {
    const left = data[ptr - 1];
    const right = data[ptr + 1];
    const diff = right - left;
    const denom = 2 * (2 * center - left - right) + 0.0001;
    return Math.max(-0.5, Math.min(0.5, diff / denom));
  }

  private subpixelRefineY(data: Uint8Array | Uint8ClampedArray, width: number, ptr: number, center: number): number {
    const up = data[ptr - width];
    const down = data[ptr + width];
    const diff = down - up;
    const denom = 2 * (2 * center - up - down) + 0.0001;
    return Math.max(-0.5, Math.min(0.5, diff / denom));
  }
}
