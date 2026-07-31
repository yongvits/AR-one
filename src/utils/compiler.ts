import * as THREE from 'three';

// Cache the imported modules
let mindarCompilerModule: any = null;
let mindarThreeModule: any = null;

export async function ensureMindARLoaded(): Promise<void> {
  if (mindarCompilerModule && mindarThreeModule) return;

  try {
    console.log("Loading MindAR ES modules via dynamic import...");
    // @ts-ignore
    mindarCompilerModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js');
    // @ts-ignore
    mindarThreeModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js');
    console.log("MindAR ES modules loaded:", !!mindarCompilerModule, !!mindarThreeModule);
  } catch (err) {
    console.error("Error dynamically loading MindAR modules:", err);
    throw new Error("Failed to load MindAR. Please check your internet connection and import map.");
  }
}

export function getMindARCompilerClass() {
  return mindarCompilerModule?.Compiler;
}

export function getMindARThreeClass() {
  return mindarThreeModule?.MindARThree;
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

  const buffer: any = await compiler.exportData();
  if (onProgress) onProgress(100);

  return buffer?.buffer ? buffer.buffer : buffer;
}
