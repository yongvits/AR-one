import * as THREE from 'three';

/**
 * MindAR Image Target Feature Extraction and Compiler Utility
 */

function setupMindARGlobalStore() {
  if (typeof window === 'undefined') return;

  (window as any).THREE = THREE;

  if (!(window as any)._mindarStore) {
    (window as any)._mindarStore = {
      Compiler: null,
      MindARThree: null
    };

    const store = (window as any)._mindarStore;

    // Preserve existing if loaded before setup
    if ((window as any).MINDAR?.IMAGE?.Compiler) store.Compiler = (window as any).MINDAR.IMAGE.Compiler;
    if ((window as any).MINDAR?.IMAGE?.MindARThree) store.MindARThree = (window as any).MINDAR.IMAGE.MindARThree;

    const imageProxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'Compiler') return store.Compiler;
        if (prop === 'MindARThree') return store.MindARThree;
        return (store.IMAGE && (store.IMAGE as any)[prop]);
      },
      set(_target, prop, value) {
        if (prop === 'Compiler' && value) store.Compiler = value;
        if (prop === 'MindARThree' && value) store.MindARThree = value;
        return true;
      }
    });

    const mindarProxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'IMAGE') return imageProxy;
        return (store.MINDAR && (store.MINDAR as any)[prop]);
      },
      set(_target, prop, value) {
        if (prop === 'IMAGE' && value) {
          if (value.Compiler) store.Compiler = value.Compiler;
          if (value.MindARThree) store.MindARThree = value.MindARThree;
        }
        return true;
      }
    });

    try {
      Object.defineProperty(window, 'MINDAR', {
        get() { return mindarProxy; },
        set(val) {
          if (val && val.IMAGE) {
            if (val.IMAGE.Compiler) store.Compiler = val.IMAGE.Compiler;
            if (val.IMAGE.MindARThree) store.MindARThree = val.IMAGE.MindARThree;
          }
        },
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      console.warn("Could not redefine window.MINDAR property trap:", e);
    }
  }
}

export function restoreMindARGlobals() {
  setupMindARGlobalStore();
}

export async function ensureMindARLoaded(): Promise<void> {
  setupMindARGlobalStore();

  const store = (window as any)._mindarStore;
  if (store?.Compiler && store?.MindARThree) {
    return;
  }

  const appendScriptTag = (src: string, checkFn: () => boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (checkFn()) {
        resolve();
        return;
      }

      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existing) {
        // If script element exists, wait for it or re-append if timed out
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (checkFn()) {
            clearInterval(interval);
            resolve();
          } else if (attempts > 40) {
            clearInterval(interval);
            existing.remove(); // Force retry
            reject(new Error(`Timeout loading ${src}`));
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';

      const timeout = setTimeout(() => {
        if (checkFn()) {
          resolve();
        } else {
          script.remove();
          reject(new Error(`Timeout loading script: ${src}`));
        }
      }, 10000);

      script.onload = () => {
        clearTimeout(timeout);
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (checkFn() || attempts > 20) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      };

      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error(`Failed to download script: ${src}`));
      };

      document.head.appendChild(script);
    });
  };

  const loadWithFallback = async (primary: string, fallback: string, checkFn: () => boolean) => {
    if (checkFn()) return;
    try {
      await appendScriptTag(primary, checkFn);
    } catch {
      console.warn(`Primary script failed (${primary}), trying fallback (${fallback})...`);
      await appendScriptTag(fallback, checkFn);
    }
  };

  try {
    // 1. Load THREE if missing
    if (!(window as any).THREE) {
      await loadWithFallback(
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
        () => !!(window as any).THREE
      );
    }

    // 2. Load MindAR Compiler
    if (!store?.Compiler) {
      await loadWithFallback(
        'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js',
        'https://unpkg.com/mind-ar@1.2.2/dist/mindar-image.prod.js',
        () => !!(window as any)._mindarStore?.Compiler
      );
    }

    // 3. Load MindAR Three
    if (!store?.MindARThree) {
      await loadWithFallback(
        'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js',
        'https://unpkg.com/mind-ar@1.2.2/dist/mindar-image-three.prod.js',
        () => !!(window as any)._mindarStore?.MindARThree
      );
    }
  } catch (err) {
    console.error("Error loading MindAR libraries:", err);
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
  restoreMindARGlobals();

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
