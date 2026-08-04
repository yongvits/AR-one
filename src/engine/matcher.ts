/**
 * Hamming Distance Feature Matcher + Lowe's Ratio Test + RANSAC Normalized DLT Homography
 */

import { Keypoint } from './fast';

export interface MatchPair {
  queryIdx: number;
  trainIdx: number;
  distance: number;
  queryKp: Keypoint;
  trainKp: Keypoint;
}

export class FeatureMatcher {
  /**
   * Fast Hamming distance using bitwise XOR and lookup table
   */
  public static hammingDistance(a: Uint8Array, b: Uint8Array): number {
    let dist = 0;
    for (let i = 0; i < 32; i++) {
      let x = a[i] ^ b[i];
      // Hamming weight (popcount)
      x = x - ((x >> 1) & 0x55);
      x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
      dist += (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
    }
    return dist;
  }

  /**
   * KNN (k=2) Matching with Lowe's Ratio Test thresholding (e.g. 0.75)
   */
  public matchKNN(
    queryKeypoints: Keypoint[],
    queryDescriptors: Uint8Array[],
    trainKeypoints: Keypoint[],
    trainDescriptors: Uint8Array[],
    ratioThreshold = 0.75
  ): MatchPair[] {
    const matches: MatchPair[] = [];

    for (let i = 0; i < queryDescriptors.length; i++) {
      const qDesc = queryDescriptors[i];
      let bestDist = Infinity;
      let secondBestDist = Infinity;
      let bestIdx = -1;

      for (let j = 0; j < trainDescriptors.length; j++) {
        const dist = FeatureMatcher.hammingDistance(qDesc, trainDescriptors[j]);
        if (dist < bestDist) {
          secondBestDist = bestDist;
          bestDist = dist;
          bestIdx = j;
        } else if (dist < secondBestDist) {
          secondBestDist = dist;
        }
      }

      // Lowe's Ratio Test
      if (bestIdx >= 0 && bestDist < ratioThreshold * secondBestDist && bestDist < 64) {
        matches.push({
          queryIdx: i,
          trainIdx: bestIdx,
          distance: bestDist,
          queryKp: queryKeypoints[i],
          trainKp: trainKeypoints[bestIdx]
        });
      }
    }

    return matches;
  }

  /**
   * RANSAC Normalized Direct Linear Transform (DLT) 3x3 Homography Matrix Solver
   */
  public findHomographyRANSAC(
    matches: MatchPair[],
    maxIterations = 100,
    inlierThresholdPx = 4.0
  ): { H: number[] | null; inliers: MatchPair[] } {
    if (matches.length < 4) return { H: null, inliers: [] };

    let bestH: number[] | null = null;
    let bestInliers: MatchPair[] = [];

    for (let iter = 0; iter < maxIterations; iter++) {
      // Randomly pick 4 non-collinear matches
      const sample = this.getRandomSample(matches, 4);
      const H = this.computeDLTHomography(sample);
      if (!H) continue;

      // Count inliers
      const currentInliers: MatchPair[] = [];
      for (const m of matches) {
        const error = this.calcReprojectionError(H, m.queryKp, m.trainKp);
        if (error < inlierThresholdPx) {
          currentInliers.push(m);
        }
      }

      if (currentInliers.length > bestInliers.length) {
        bestInliers = currentInliers;
        bestH = H;
      }
    }

    // Refine Homography using all inliers
    if (bestInliers.length >= 4) {
      bestH = this.computeDLTHomography(bestInliers) || bestH;
    }

    return { H: bestH, inliers: bestInliers };
  }

  private calcReprojectionError(H: number[], src: Keypoint, dst: Keypoint): number {
    const x = src.x;
    const y = src.y;

    const hx = H[0] * x + H[1] * y + H[2];
    const hy = H[3] * x + H[4] * y + H[5];
    const hz = H[6] * x + H[7] * y + H[8];

    if (Math.abs(hz) < 1e-6) return Infinity;

    const projX = hx / hz;
    const projY = hy / hz;

    const dx = projX - dst.x;
    const dy = projY - dst.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  private computeDLTHomography(matches: MatchPair[]): number[] | null {
    if (matches.length < 4) return null;

    // Build 2N x 9 matrix equations A * h = 0
    // Simplified 4-point exact linear system for sample
    const srcPts = matches.slice(0, 4).map(m => [m.queryKp.x, m.queryKp.y]);
    const dstPts = matches.slice(0, 4).map(m => [m.trainKp.x, m.trainKp.y]);

    // Construct 8x8 matrix A and b vector
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
      const [u, v] = srcPts[i];
      const [x, y] = dstPts[i];

      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
      b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
      b.push(y);
    }

    const h = this.solve8x8(A, b);
    if (!h) return null;

    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
  }

  private solve8x8(A: number[][], b: number[]): number[] | null {
    // Gaussian elimination with partial pivoting for 8x8 matrix
    const n = 8;
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
      }

      // Swap rows
      const tmpRow = A[i]; A[i] = A[maxRow]; A[maxRow] = tmpRow;
      const tmpB = b[i]; b[i] = b[maxRow]; b[maxRow] = tmpB;

      if (Math.abs(A[i][i]) < 1e-8) return null;

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) A[k][j] = 0;
          else A[k][j] += c * A[i][j];
        }
        b[k] += c * b[i];
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += A[i][j] * x[j];
      }
      x[i] = (b[i] - sum) / A[i][i];
    }

    return x;
  }

  private getRandomSample<T>(arr: T[], size: number): T[] {
    const shuffled = arr.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    return shuffled.slice(0, size);
  }
}
