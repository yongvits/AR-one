import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { Camera, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { ARObjectData, MarkerData } from '../types/webar';
import { ensureMindARLoaded, getMindARThreeClass } from '../utils/compiler';
import { createChromaKeyMaterial } from '../utils/chromaKeyShader';
import { CustomWebAREngine } from '../engine/customWebAREngine';

interface ARCameraModalProps {
  isOpen: boolean;
  markerData: MarkerData;
  objects: ARObjectData[];
  compiledMindBuffer: ArrayBuffer | null;
  onClose: () => void;
}

export const ARCameraModal: React.FC<ARCameraModalProps> = ({
  isOpen,
  markerData,
  objects,
  compiledMindBuffer,
  onClose
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [trackingStatus, setTrackingStatus] = useState<string>('กำลังเข้าถึงกล้อง...');
  const [statusColor, setStatusColor] = useState<string>('bg-amber-500/20 text-amber-300 border-amber-500/30');
  const [hasError, setHasError] = useState<boolean>(false);
  const [targetFound, setTargetFound] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mindarThreeRef = useRef<any>(null);
  const activeBlobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      stopARSession();
      return;
    }

    startARSession();

    return () => {
      stopARSession();
    };
  }, [isOpen, facingMode, compiledMindBuffer]);

  const startARSession = async () => {
    stopARSession();

    const container = containerRef.current;
    if (!container) return;

    setHasError(false);
    setTargetFound(false);
    setTrackingStatus('กำลังเข้าถึงกล้อง...');
    setStatusColor('bg-amber-500/20 text-amber-300 border-amber-500/30');

    // 1. Check secure context / mediaDevices support
    const isSecure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure) {
      setTrackingStatus('ต้องใช้งานผ่าน HTTPS หรือ localhost');
      setStatusColor('bg-red-500/20 text-red-300 border-red-500/30');
      setHasError(true);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setTrackingStatus('เบราว์เซอร์นี้ไม่รองรับกล้อง (getUserMedia)');
      setStatusColor('bg-red-500/20 text-red-300 border-red-500/30');
      setHasError(true);
      return;
    }

    // 1.5 Explicitly request camera permission first
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      // We got permission, we can stop the stream immediately since MindAR will request its own
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error("Camera permission denied:", err);
      setTrackingStatus('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตสิทธิ์การใช้งานกล้อง');
      setStatusColor('bg-red-500/20 text-red-300 border-red-500/30 font-bold');
      setHasError(true);
      return;
    }

    // 2. Prepare target URL
    let targetSrc: string;
    let usingUserMarker = false;

    if (compiledMindBuffer) {
      const blob = new Blob([compiledMindBuffer], { type: 'application/octet-stream' });
      targetSrc = URL.createObjectURL(blob);
      activeBlobUrlsRef.current.push(targetSrc);
      usingUserMarker = true;
    } else {
      // MindAR demo card fallback
      targetSrc = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/examples/image-tracking/assets/card-example/card.mind';
    }

    try {
      await ensureMindARLoaded();

      const MindARThreeClass = getMindARThreeClass();
      if (!MindARThreeClass) {
        throw new Error("MindAR Three library is not loaded");
      }

      let mindarThree: any = null;

      const initAndStartEngine = async (mode: string) => {
        container.innerHTML = '';
        const engine = new MindARThreeClass({
          container: container,
          imageTargetSrc: targetSrc,
          facingMode: mode,
          uiLoading: "no",
          uiScanning: "no",
          filterMinCF: 0.001,
          filterBeta: 10,
          warmupTolerance: 5,
          missTolerance: 10
        });

        const { renderer, scene, camera } = engine;
        if (renderer) {
          renderer.setClearColor(0x000000, 0);
        }
        scene.background = null;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(1, 2, 2);
        scene.add(dirLight);

        // Anchor
        const anchor = engine.addAnchor(0);
        const mixers: THREE.AnimationMixer[] = [];
        const videos: HTMLVideoElement[] = [];

        // Studio Group container inside anchor.group
        // Aligns Studio Viewport coordinates (X=Width, Y=Up from target plane, Z=Height down target)
        // with MindAR Anchor coordinates.
        const studioGroup = new THREE.Group();
        anchor.group.add(studioGroup);

        studioGroup.rotation.x = Math.PI / 2;

        const targetWidthMeters = (markerData?.widthCm || 15) / 100;
        const scaleFactor = 1 / targetWidthMeters;
        studioGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Attach 3D objects to Studio group
        objects.forEach((obj) => {
          if (!obj.visible) return;

          let cloneObj: THREE.Object3D | null = null;

          if (obj.type === 'cube') {
            const geom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const mat = new THREE.MeshStandardMaterial({
              color: obj.colorHex || '#6366f1',
              transparent: (obj.opacity ?? 1) < 1,
              opacity: obj.opacity ?? 1
            });
            cloneObj = new THREE.Mesh(geom, mat);
          } else if (obj.type === 'sphere') {
            const geom = new THREE.SphereGeometry(0.05, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
              color: obj.colorHex || '#6366f1',
              transparent: (obj.opacity ?? 1) < 1,
              opacity: obj.opacity ?? 1
            });
            cloneObj = new THREE.Mesh(geom, mat);
          } else if (obj.type === 'cylinder') {
            const geom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 32);
            const mat = new THREE.MeshStandardMaterial({
              color: obj.colorHex || '#6366f1',
              transparent: (obj.opacity ?? 1) < 1,
              opacity: obj.opacity ?? 1
            });
            cloneObj = new THREE.Mesh(geom, mat);
          } else if (obj.type === 'plane') {
            const geom = new THREE.PlaneGeometry(0.1, 0.1);
            const mat = new THREE.MeshStandardMaterial({
              color: obj.colorHex || '#6366f1',
              side: THREE.DoubleSide,
              transparent: (obj.opacity ?? 1) < 1,
              opacity: obj.opacity ?? 1
            });
            cloneObj = new THREE.Mesh(geom, mat);
          } else if (obj.type === 'capsule') {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({
              color: obj.colorHex || '#6366f1',
              transparent: (obj.opacity ?? 1) < 1,
              opacity: obj.opacity ?? 1
            });
            const cyl = new THREE.Mesh(
              new THREE.CylinderGeometry(0.03, 0.03, 0.08, 32),
              mat
            );
            const topSp = new THREE.Mesh(
              new THREE.SphereGeometry(0.03, 16, 16),
              mat
            );
            topSp.position.y = 0.04;
            const botSp = new THREE.Mesh(
              new THREE.SphereGeometry(0.03, 16, 16),
              mat
            );
            botSp.position.y = -0.04;
            group.add(cyl, topSp, botSp);
            cloneObj = group;
          } else if (obj.type === 'light') {
            cloneObj = new THREE.PointLight(obj.colorHex || '#ffaa00', obj.intensity || 2.0, 2);
          } else if (obj.type === 'video') {
            let videoElem: HTMLVideoElement | null = obj.videoElement || null;
            let videoUrl = '';
            if (obj.file) {
              videoUrl = URL.createObjectURL(obj.file);
              activeBlobUrlsRef.current.push(videoUrl);
            } else if (obj.videoElement?.src) {
              videoUrl = obj.videoElement.src;
            }

            if (videoUrl) {
              videoElem = document.createElement('video');
              videoElem.src = videoUrl;
              videoElem.crossOrigin = 'anonymous';
              videoElem.loop = true;
              videoElem.muted = true;
              videoElem.playsInline = true;
              videoElem.setAttribute('playsinline', '');
              videoElem.setAttribute('webkit-playsinline', '');
              videoElem.load();
              videoElem.play().catch(() => {});
            }

            if (videoElem) {
              videos.push(videoElem);
              const texture = new THREE.VideoTexture(videoElem);
              texture.minFilter = THREE.LinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texture.format = THREE.RGBAFormat;

              let mat: THREE.Material;
              if (obj.chromaKeyEnabled) {
                mat = createChromaKeyMaterial(texture, obj.chromaKeyColor || '#00ff00');
              } else {
                mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
              }

              let aspect = 1.5;
              if (videoElem.videoWidth && videoElem.videoHeight) {
                aspect = videoElem.videoWidth / videoElem.videoHeight;
              }
              const geom = new THREE.PlaneGeometry(0.12, 0.12 / aspect);
              cloneObj = new THREE.Mesh(geom, mat);
              (cloneObj as any)._videoTexture = texture;

              const vMesh = cloneObj as THREE.Mesh;
              const updateAspect = () => {
                if (videoElem && videoElem.videoWidth && videoElem.videoHeight) {
                  const realAspect = videoElem.videoWidth / videoElem.videoHeight;
                  vMesh.geometry.dispose();
                  vMesh.geometry = new THREE.PlaneGeometry(0.12, 0.12 / realAspect);
                }
              };

              if (videoElem.readyState >= 1) {
                updateAspect();
              } else {
                videoElem.onloadedmetadata = updateAspect;
                videoElem.onloadeddata = updateAspect;
              }
            } else if (obj.threeObject) {
              cloneObj = obj.threeObject.clone(true);
            }
          } else if (obj.type === 'glb') {
            if (obj.threeObject) {
              cloneObj = SkeletonUtils.clone(obj.threeObject);
            } else if (obj.rawGltf?.scene) {
              cloneObj = SkeletonUtils.clone(obj.rawGltf.scene);
            }

            if (cloneObj) {
              cloneObj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.frustumCulled = false;
                  child.castShadow = true;
                  child.receiveShadow = true;
                  if (child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach((m) => { m.side = THREE.DoubleSide; });
                    } else {
                      child.material.side = THREE.DoubleSide;
                    }
                  }
                }
              });
              if (obj.animations && obj.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(cloneObj);
                const clipIdx = obj.activeAnimIndex || 0;
                const clip = obj.animations[clipIdx] || obj.animations[0];
                mixer.clipAction(clip).play();
                mixers.push(mixer);
              }
            }
          } else if (obj.threeObject) {
            cloneObj = obj.threeObject.clone(true);
          }

          if (cloneObj) {
            const degToRad = (deg: number) => (deg * Math.PI) / 180;
            cloneObj.position.set(obj.position[0], obj.position[1], obj.position[2]);
            cloneObj.rotation.set(
              degToRad(obj.rotation[0]),
              degToRad(obj.rotation[1]),
              degToRad(obj.rotation[2])
            );
            cloneObj.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);

            studioGroup.add(cloneObj);
          }
        });

        // Render Loop
        const arClock = new THREE.Clock();

        anchor.onTargetFound = () => {
          setTargetFound(true);
          setTrackingStatus('พบภาพ Target แล้ว! ✅');
          setStatusColor('bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold');
          videos.forEach((v) => {
            v.muted = true;
            v.play().catch((e) => console.log('Video play catch:', e));
          });
        };

        anchor.onTargetLost = () => {
          setTargetFound(false);
          setTrackingStatus('กำลังส่องหาภาพ Target...');
          setStatusColor('bg-amber-500/20 text-amber-300 border-amber-500/30');
          videos.forEach((v) => v.pause());
        };

        await engine.start();

        // Let MindAR resize video & projection matrix accurately
        if (typeof engine.resize === 'function') {
          engine.resize();
        }

        // Maintain correct z-index layering without overriding video aspect geometry
        const enforceVideoStyles = () => {
          const v = container.querySelector('video') as HTMLVideoElement | null;
          const c = container.querySelector('canvas') as HTMLCanvasElement | null;

          if (v) {
            v.style.setProperty('position', 'absolute', 'important');
            v.style.setProperty('z-index', '1', 'important');
            v.style.setProperty('display', 'block', 'important');
            v.style.setProperty('opacity', '1', 'important');
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.muted = true;
            if (v.paused) {
              v.play().catch(() => {});
            }
          }

          if (c) {
            c.style.setProperty('z-index', '2', 'important');
            c.style.setProperty('pointer-events', 'none', 'important');
            c.style.setProperty('background', 'transparent', 'important');
          }
        };

        enforceVideoStyles();
        const layoutInterval = setInterval(enforceVideoStyles, 1000);
        (container as any)._layoutInterval = layoutInterval;

        const handleResize = () => {
          if (typeof engine.resize === 'function') {
            engine.resize();
          }
          enforceVideoStyles();
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        (container as any)._resizeHandler = handleResize;

        renderer.setAnimationLoop(() => {
          const delta = arClock.getDelta();
          mixers.forEach((m) => m.update(delta));

          // Video texture updates
          anchor.group.traverse((child) => {
            if ((child as any)._videoTexture) {
              (child as any)._videoTexture.needsUpdate = true;
            }
          });

          renderer.render(scene, camera);
        });

        return engine;
      };

      try {
        mindarThree = await initAndStartEngine(facingMode);
      } catch (err) {
        console.warn(`Camera start failed with mode ${facingMode}, retrying with user mode:`, err);
        mindarThree = await initAndStartEngine('user');
      }

      mindarThreeRef.current = mindarThree;
    } catch (err: any) {
      console.error("AR Start Failed:", err);
      let reason = 'ไม่ทราบสาเหตุ';
      if (err?.name === 'NotAllowedError') reason = 'ผู้ใช้ปฏิเสธสิทธิ์กล้อง';
      else if (err?.name === 'NotFoundError') reason = 'ไม่พบกล้องบนอุปกรณ์นี้';
      else if (err?.name === 'NotReadableError') reason = 'กล้องถูกใช้งานโดยแอปอื่นอยู่';
      else if (err?.message) reason = err.message;

      setTrackingStatus(`ข้อผิดพลาด: ${reason}`);
      setStatusColor('bg-red-500/20 text-red-300 border-red-500/30 font-bold');
      setHasError(true);
    }
  };

  const stopARSession = () => {
    const containerEl = containerRef.current;
    if (containerEl && (containerEl as any)._layoutInterval) {
      clearInterval((containerEl as any)._layoutInterval);
      (containerEl as any)._layoutInterval = null;
    }

    if (containerEl && (containerEl as any)._resizeHandler) {
      window.removeEventListener('resize', (containerEl as any)._resizeHandler);
      window.removeEventListener('orientationchange', (containerEl as any)._resizeHandler);
      (containerEl as any)._resizeHandler = null;
    }

    if (mindarThreeRef.current) {
      try {
        mindarThreeRef.current.stop();
        if (mindarThreeRef.current.renderer) {
          mindarThreeRef.current.renderer.dispose();
        }
      } catch (e) {}
      mindarThreeRef.current = null;
    }

    activeBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrlsRef.current = [];

    if (containerEl) containerEl.innerHTML = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      {/* Header Bar */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between z-30">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-emerald-400" />
            Live WebAR Camera Preview
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">v6.4.0 Pro</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            title="สลับกล้องหน้า / กล้องหลัง"
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">สลับกล้อง</span>
          </button>

          <span className={`text-[10px] md:text-[11px] px-2.5 py-1 rounded-full border font-mono truncate max-w-[200px] md:max-w-none ${statusColor}`}>
            {trackingStatus}
          </span>

          <button
            onClick={onClose}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-lg transition flex items-center space-x-1"
          >
            <X className="w-4 h-4" />
            <span>ปิด AR</span>
          </button>
        </div>
      </div>

      {/* AR Live Viewport Container */}
      <div
        id="ar-view-container"
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-black flex items-center justify-center"
      >
        {/* Target Frame Overlay */}
        <div
          className={`absolute inset-0 pointer-events-none border-2 border-dashed m-6 md:m-12 rounded-2xl flex items-center justify-center z-10 transition-all duration-300 ${
            targetFound
              ? 'border-emerald-400/80 bg-emerald-500/5'
              : 'border-indigo-400/50'
          }`}
        >
          {!targetFound && (
            <div className="bg-slate-900/85 backdrop-blur px-4 py-2 rounded-xl text-xs text-slate-200 font-mono border border-slate-700 shadow-xl text-center max-w-[300px]">
              นำกล้องส่องไปที่รูปภาพ Target <br />
              <span className="text-[10px] text-indigo-400">วัตถุ 3D จะปรากฏบนภาพทันที</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
