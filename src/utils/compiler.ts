import * as THREE from 'three';
// @ts-ignore
import { Compiler } from 'mind-ar/dist/mindar-image.prod.js';
// @ts-ignore
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';

export async function ensureMindARLoaded(): Promise<void> {
  // Already imported via ES modules from the local package
  return Promise.resolve();
}

export function getMindARCompilerClass() {
  return Compiler;
}

export function getMindARThreeClass() {
  return MindARThree;
}

export async function getOptimizedImageElement(img: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const maxDim = 800;
    let w = img.naturalWidth || img.width || 800;
    let h = img.naturalHeight || img.height || 600;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error("Could not create 2D canvas context"));
      return;
    }

    ctx.drawImage(img, 0, 0, w, h);

    const optImg = new Image();
    optImg.crossOrigin = "anonymous";
    optImg.onload = () => resolve(optImg);
    optImg.onerror = () => reject(new Error("Failed to process optimized marker image"));
    optImg.src = canvas.toDataURL('image/jpeg', 0.92);
  });
}

export async function compileMarkerTarget(
  imgElement: HTMLImageElement,
  onProgress?: (progressPercent: number) => void
): Promise<ArrayBuffer> {
  if (onProgress) onProgress(10);

  await ensureMindARLoaded();

  const CompilerClass = getMindARCompilerClass();
  if (!CompilerClass) {
    throw new Error("MindAR Compiler library is not loaded. Please check internet connection.");
  }

  const optImg = await getOptimizedImageElement(imgElement);
  if (onProgress) onProgress(30);

  const compiler = new CompilerClass();

  await compiler.compileImageTargets([optImg], (progress: number) => {
    const p = Math.round(30 + progress * 70);
    if (onProgress) onProgress(p);
  });

  const exported: any = await compiler.exportData();
  if (onProgress) onProgress(100);

  // Correctly extract exact byte slice from Uint8Array to avoid extra trailing buffer pool bytes
  const uint8 = exported instanceof Uint8Array ? exported : new Uint8Array(exported);
  const exactArrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

  return exactArrayBuffer;
}
