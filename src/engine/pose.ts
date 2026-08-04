/**
 * Homography-to-6DoF Pose Solver (Extracts 3D Rotation R and Translation T for Three.js)
 */

import * as THREE from 'three';

export class PoseSolver {
  /**
   * Decomposes 3x3 Homography H into 3D Transform Matrix for Three.js
   */
  public static homographyToMatrix4(H: number[], focalLengthPx = 600): THREE.Matrix4 {
    const mat = new THREE.Matrix4();

    // H columns
    const h1 = new THREE.Vector3(H[0], H[3], H[6]);
    const h2 = new THREE.Vector3(H[1], H[4], H[7]);
    const h3 = new THREE.Vector3(H[2], H[5], H[8]);

    // Scale factor
    const norm = 1.0 / h1.length();

    const r1 = h1.clone().multiplyScalar(norm);
    const r2 = h2.clone().multiplyScalar(norm);
    const r3 = new THREE.Vector3().crossVectors(r1, r2); // Orthonormal r3

    const t = h3.clone().multiplyScalar(norm);

    // Assembly 4x4 matrix
    const elements = new Float32Array([
      r1.x, r2.x, r3.x, 0,
      r1.y, r2.y, r3.y, 0,
      r1.z, r2.z, r3.z, 0,
      t.x / focalLengthPx, t.y / focalLengthPx, t.z / focalLengthPx, 1
    ]);

    mat.fromArray(elements);
    return mat;
  }

  /**
   * Decomposes Matrix4 into position, quaternion, scale
   */
  public static matrix4ToTRS(mat: THREE.Matrix4): { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 } {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    mat.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }
}
