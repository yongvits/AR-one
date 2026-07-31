import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { Camera, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { ARObjectData, MarkerData } from '../types/webar';
import { ensureMindARLoaded } from '../utils/compiler';

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

      if (!(window as any).MINDAR?.IMAGE?.MindARThree) {
        throw new Error("MindAR Three library is not loaded");
      }

      const MindARThreeClass = (window as any).MINDAR.IMAGE.MindARThree;

      const mindarThree = new MindARThreeClass({
        container: container,
        imageTargetSrc: targetSrc,
        facingMode: facingMode,
        uiLoading: "no",
        uiScanning: "no",
        filterMinCF: 0.001,
        filterBeta: 0.01
      });

      mindarThreeRef.current = mindarThree;

      const { renderer, scene, camera } = mindarThree;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(1, 2, 2);
      scene.add(dirLight);

      // Anchor
      const anchor = mindarThree.addAnchor(0);
      const mixers: THREE.AnimationMixer[] = [];
      const videos: HTMLVideoElement[] = [];

      // Attach 3D objects to Anchor group
      objects.forEach((obj) => {
        if (!obj.visible) return;

        let cloneObj: THREE.Object3D;
        if (obj.type === 'glb' && obj.threeObject) {
          cloneObj = SkeletonUtils.clone(obj.threeObject);
        } else if (obj.threeObject) {
          cloneObj = obj.threeObject.clone(true);
        } else {
          const geom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
          const mat = new THREE.MeshStandardMaterial({ color: 0x6366f1 });
          cloneObj = new THREE.Mesh(geom, mat);
        }

        const degToRad = (deg: number) => (deg * Math.PI) / 180;
        cloneObj.position.set(obj.position[0], obj.position[1], obj.position[2]);
        cloneObj.rotation.set(
          degToRad(obj.rotation[0]),
          degToRad(obj.rotation[1]),
          degToRad(obj.rotation[2])
        );
        cloneObj.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);

        if (obj.type === 'glb' && obj.animations && obj.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(cloneObj);
          const clipIdx = obj.activeAnimIndex || 0;
          const clip = obj.animations[clipIdx] || obj.animations[0];
          mixer.clipAction(clip).play();
          mixers.push(mixer);
        }

        if (obj.type === 'video' && obj.videoElement) {
          videos.push(obj.videoElement);
        }

        if (cloneObj && cloneObj instanceof THREE.Object3D) {
          anchor.group.add(cloneObj);
        }
      });

      anchor.onTargetFound = () => {
        setTargetFound(true);
        setTrackingStatus('พบภาพ Target แล้ว! ✅');
        setStatusColor('bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold');
        videos.forEach((v) => v.play().catch(() => {}));
      };

      anchor.onTargetLost = () => {
        setTargetFound(false);
        setTrackingStatus('กำลังส่องหาภาพ Target...');
        setStatusColor('bg-amber-500/20 text-amber-300 border-amber-500/30');
        videos.forEach((v) => v.pause());
      };

      // Start engine
      await mindarThree.start();

      // CSS full bleed styling fix
      requestAnimationFrame(() => {
        const v = container.querySelector('video');
        const c = container.querySelector('canvas');
        [v, c].forEach((el) => {
          if (!el) return;
          el.style.setProperty('width', '100%', 'important');
          el.style.setProperty('height', '100%', 'important');
          el.style.setProperty('position', 'absolute', 'important');
          el.style.setProperty('top', '0', 'important');
          el.style.setProperty('left', '0', 'important');
        });
      });

      if (usingUserMarker) {
        setTrackingStatus('ส่องกล้องไปที่รูป Target ของคุณ...');
        setStatusColor('bg-sky-500/20 text-sky-300 border-sky-500/30');
      } else {
        setTrackingStatus('⚠️ ใช้ภาพตัวอย่าง (อัปโหลด Marker เพื่อส่องรูปจริง)');
        setStatusColor('bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold');
      }

      // Render Loop
      const arClock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        const delta = arClock.getDelta();
        mixers.forEach((m) => m.update(delta));
        renderer.render(scene, camera);
      });
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

    const container = containerRef.current;
    if (container) container.innerHTML = '';
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
