import * as THREE from 'three';

/**
 * MindAR Image Target Feature Extraction and Compiler Utility
 */

export async function ensureMindARLoaded(): Promise<void> {
  if (typeof window !== 'undefined') {
    (window as any).THREE = THREE;
  }

  if ((window as any).MINDAR?.IMAGE?.Compiler && (window as any).MINDAR?.IMAGE?.MindARThree) {
    return;
  }

  const loadScript = (src: string, checkGlobal?: () => boolean) => {
    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existing) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if ((checkGlobal && checkGlobal()) || attempts > 50) {
            clearInterval(checkInterval);
            if (checkGlobal && !checkGlobal()) {
              reject(new Error(`Timeout waiting for script: ${src}`));
            } else {
              resolve();
            }
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (!checkGlobal || checkGlobal() || attempts > 30) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  try {
    if (!(window as any).MINDAR?.IMAGE?.Compiler) {
      await loadScript(
        'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js',
        () => !!(window as any).MINDAR?.IMAGE?.Compiler
      );
    }
    if (!(window as any).MINDAR?.IMAGE?.MindARThree) {
      await loadScript(
        'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js',
        () => !!(window as any).MINDAR?.IMAGE?.MindARThree
      );
    }
  } catch (err) {
    console.error("Error dynamically loading MindAR scripts:", err);
    throw err;
  }
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

  if (!(window as any).MINDAR?.IMAGE?.Compiler) {
    throw new Error("MindAR Compiler library is not loaded. Please check internet connection.");
  }

  const optImg = await getOptimizedImageElement(imgElement);
  if (onProgress) onProgress(30);

  const CompilerClass = (window as any).MINDAR.IMAGE.Compiler;
  const compiler = new CompilerClass();

  await compiler.compileImageTargets([optImg], (progress: number) => {
    // progress is 0 to 1
    const p = Math.round(30 + progress * 70);
    if (onProgress) onProgress(p);
  });

  const buffer: ArrayBuffer = await compiler.exportData();
  if (onProgress) onProgress(100);

  return buffer;
}
