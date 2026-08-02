import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import JSZip from 'jszip';

import { Header } from './components/Header';
import { SidebarTracker } from './components/SidebarTracker';
import { SidebarAdd } from './components/SidebarAdd';
import { SidebarHierarchy } from './components/SidebarHierarchy';
import { SidebarSequence } from './components/SidebarSequence';
import { Inspector } from './components/Inspector';
import { WebGLCanvas } from './components/WebGLCanvas';
import { ARCameraModal } from './components/ARCameraModal';

import {
  ARObjectData,
  CompilerStatus,
  GizmoMode,
  MarkerData,
  ObjectType,
  SequenceData,
  SidebarTab
} from './types/webar';

import { compileMarkerTarget } from './utils/compiler';
import { exportStandalonePackage, saveProjectFile } from './utils/zipHandler';
import { createChromaKeyMaterial } from './utils/chromaKeyShader';

export default function App() {
  // Sidebar Tab
  const [activeTab, setActiveTab] = useState<SidebarTab>('tracker');

  // Gizmo Mode
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');

  // Selected Object
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // AR Modal State
  const [isARModalOpen, setIsARModalOpen] = useState<boolean>(false);

  // Marker State
  const [markerData, setMarkerData] = useState<MarkerData>({
    name: 'Target01.jpg',
    widthCm: 15,
    heightCm: 10,
    aspectRatio: 1.5,
    texture: null,
    file: null,
    imgElement: null,
    previewUrl: null
  });

  // Compiler State
  const [compilerStatus, setCompilerStatus] = useState<CompilerStatus>('idle');
  const [compilerProgress, setCompilerProgress] = useState<number>(0);
  const [compilerError, setCompilerError] = useState<string>('');
  const [compiledMindBuffer, setCompiledMindBuffer] = useState<ArrayBuffer | null>(null);

  // Objects Array
  const [objects, setObjects] = useState<ARObjectData[]>([]);

  // Sequence State
  const [sequenceData, setSequenceData] = useState<SequenceData>({
    files: [],
    textures: [],
    fps: 24,
    mode: 'loop',
    autoPlay: true
  });

  // Load default initial scene
  useEffect(() => {
    loadDefaultMarker();
    createDefaultObjects();
  }, []);

  const loadDefaultMarker = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 341; // 1.5 aspect ratio
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 512, 341);
      ctx.fillStyle = '#312e81';
      ctx.fillRect(10, 10, 492, 321);

      ctx.fillStyle = '#6366f1';
      ctx.fillRect(30, 30, 100, 100);
      ctx.fillRect(380, 211, 100, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WebAR Target', 256, 160);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText('WebAR Studio Pro v5.5.1', 256, 200);
    }

    const dataUrl = canvas.toDataURL('image/jpeg');
    const imgObj = new Image();
    imgObj.crossOrigin = 'anonymous';
    imgObj.onload = async () => {
      const texture = new THREE.CanvasTexture(canvas);
      setMarkerData({
        name: 'Target01.jpg',
        widthCm: 15,
        heightCm: 10,
        aspectRatio: 512 / 341,
        texture: texture,
        file: null,
        imgElement: imgObj,
        previewUrl: dataUrl
      });

      // Auto compile initial target
      handleCompileMarker(imgObj);
    };
    imgObj.src = dataUrl;
  };

  const createDefaultObjects = () => {
    const cubeObj: ARObjectData = {
      id: 'obj_cube_' + Date.now(),
      name: 'Interactive Cube',
      type: 'cube',
      visible: true,
      position: [0, 0.04, 0],
      rotation: [0, 45, 0],
      scale: [1, 1, 1],
      colorHex: '#6366f1',
      opacity: 1.0
    };

    setObjects([cubeObj]);
    setSelectedObjectId(cubeObj.id);
  };

  // Compile Marker Target
  const handleCompileMarker = async (imgElement: HTMLImageElement) => {
    setCompilerStatus('compiling');
    setCompilerProgress(10);
    setCompilerError('');
    setCompiledMindBuffer(null);

    try {
      const buffer = await compileMarkerTarget(imgElement, (progress) => {
        setCompilerProgress(progress);
      });

      setCompiledMindBuffer(buffer);
      setCompilerStatus('success');
      setCompilerProgress(100);
    } catch (err: any) {
      console.error("Marker compilation error:", err);
      setCompilerStatus('error');
      setCompilerError(err?.message || 'ไม่สามารถสกัดจุดเด่นภาพได้');
    }
  };

  // Marker Upload (.jpg, .png, or .mind)
  const handleMarkerUpload = (file: File) => {
    if (file.name.toLowerCase().endsWith('.mind')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          const buffer = e.target.result;
          setCompiledMindBuffer(buffer);
          setCompilerStatus('success');
          setCompilerProgress(100);
          setCompilerError('');

          const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="none"><rect width="300" height="200" fill="#0f172a"/><text x="150" y="90" fill="#38bdf8" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">MindAR Target File (.mind)</text><text x="150" y="120" fill="#94a3b8" font-family="sans-serif" font-size="12" text-anchor="middle">${file.name}</text></svg>`;
          const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

          setMarkerData((prev) => ({
            ...prev,
            name: file.name,
            file: file,
            previewUrl: svgUrl
          }));
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const imgObj = new Image();
    imgObj.crossOrigin = 'anonymous';
    imgObj.onload = () => {
      const aspectRatio = imgObj.naturalWidth / imgObj.naturalHeight;
      const heightCm = Math.round((markerData.widthCm / aspectRatio) * 10) / 10;

      const loader = new THREE.TextureLoader();
      loader.load(url, (texture) => {
        setMarkerData({
          name: file.name,
          widthCm: markerData.widthCm,
          heightCm: heightCm,
          aspectRatio: aspectRatio,
          texture: texture,
          file: file,
          imgElement: imgObj,
          previewUrl: url
        });

        handleCompileMarker(imgObj);
      });
    };
    imgObj.src = url;
  };

  // Marker Width Change
  const handleMarkerWidthChange = (widthCm: number) => {
    const heightCm = Math.round((widthCm / (markerData.aspectRatio || 1.5)) * 10) / 10;
    setMarkerData((prev) => ({
      ...prev,
      widthCm,
      heightCm
    }));
  };

  // Create Primitive Object
  const handleCreatePrimitive = (type: ObjectType) => {
    const newId = 'obj_' + Date.now();
    const nameMap: Record<string, string> = {
      cube: 'Cube',
      sphere: 'Sphere',
      plane: 'Plane',
      cylinder: 'Cylinder',
      capsule: 'Capsule',
      light: 'Point Light'
    };

    const newObj: ARObjectData = {
      id: newId,
      name: nameMap[type] || '3D Object',
      type: type,
      visible: true,
      position: [0, 0.05, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colorHex: '#6366f1',
      opacity: 1.0,
      intensity: 2.0
    };

    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setActiveTab('hierarchy');
  };

  // Upload GLB Model
  const handleGLBUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1);

        let mixer: THREE.AnimationMixer | null = null;
        const animations = gltf.animations || [];
        if (animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(animations[0]).play();
        }

        const newId = 'glb_' + Date.now();
        const newObj: ARObjectData = {
          id: newId,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: 'glb',
          visible: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [0.1, 0.1, 0.1],
          colorHex: '#ffffff',
          opacity: 1.0,
          fileName: file.name,
          file: file,
          rawGltf: gltf,
          threeObject: model,
          mixer: mixer,
          animations: animations,
          activeAnimIndex: 0
        };

        setObjects((prev) => [...prev, newObj]);
        setSelectedObjectId(newId);
        setActiveTab('hierarchy');
      },
      undefined,
      (err) => {
        alert('เกิดข้อผิดพลาดในการโหลดไฟล์ GLB โปรดตรวจสอบว่าไฟล์สมบูรณ์');
      }
    );
  };

  // Upload Video Texture
  const handleVideoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.play().catch(() => {});

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const geom = new THREE.PlaneGeometry(0.12, 0.08);
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
    const mesh = new THREE.Mesh(geom, mat);

    video.onloadedmetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        const aspect = video.videoWidth / video.videoHeight;
        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(0.12, 0.12 / aspect);
      }
    };

    const newId = 'video_' + Date.now();
    const newObj: ARObjectData = {
      id: newId,
      name: file.name,
      type: 'video',
      visible: true,
      position: [0, 0.06, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colorHex: '#ffffff',
      opacity: 1.0,
      fileName: file.name,
      file: file,
      videoElement: video,
      threeObject: mesh
    };

    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setActiveTab('hierarchy');
  };

  // Upload Sequence Frames
  const handleSequenceUpload = (files: FileList) => {
    const fileArray = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    const textures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();

    fileArray.forEach((file) => {
      const url = URL.createObjectURL(file);
      textures.push(loader.load(url));
    });

    setSequenceData({
      files: fileArray,
      textures,
      fps: 24,
      mode: 'loop',
      autoPlay: true
    });

    const geom = new THREE.PlaneGeometry(0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({
      map: textures[0],
      transparent: true,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geom, mat);

    const newId = 'seq_' + Date.now();
    const newObj: ARObjectData = {
      id: newId,
      name: `Sequence (${files.length} frames)`,
      type: 'sequence',
      visible: true,
      position: [0, 0.05, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colorHex: '#ffffff',
      opacity: 1.0,
      threeObject: mesh
    };

    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setActiveTab('sequence');
  };

  // Delete Object
  const handleDeleteObject = (id: string) => {
    setObjects((prev) => prev.filter((o) => o.id !== id));
    if (selectedObjectId === id) setSelectedObjectId(null);
  };

  // Toggle Object Visibility
  const handleToggleVisibility = (id: string) => {
    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, visible: !o.visible } : o))
    );
  };

  // Update Object Transform from Canvas or Inspector
  const handleUpdateObjectTransform = (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }
  ) => {
    setObjects((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              position: transform.position,
              rotation: transform.rotation,
              scale: transform.scale
            }
          : o
      )
    );
  };

  // Update Object Properties from Inspector
  const handleUpdateObjectProps = (updated: Partial<ARObjectData>) => {
    if (!selectedObjectId) return;
    setObjects((prev) =>
      prev.map((o) => (o.id === selectedObjectId ? { ...o, ...updated } : o))
    );
  };

  // Change GLB Animation Clip
  const handleChangeGLBAnimation = (clipIdx: number) => {
    if (!selectedObjectId) return;
    setObjects((prev) =>
      prev.map((o) => {
        if (o.id === selectedObjectId && o.mixer && o.animations && o.animations[clipIdx]) {
          o.mixer.stopAllAction();
          o.mixer.clipAction(o.animations[clipIdx]).play();
          return { ...o, activeAnimIndex: clipIdx };
        }
        return o;
      })
    );
  };

  // Save Project File (.webar)
  const handleSaveProject = async () => {
    try {
      const blob = await saveProjectFile(
        markerData,
        objects,
        compiledMindBuffer,
        sequenceData
      );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `project_${markerData.name.replace(/\.[^/.]+$/, '')}.webar`;
      link.click();
    } catch (err) {
      console.error("Save error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกโปรเจกต์");
    }
  };

  // Load Project File (.webar / .zip)
  const handleLoadProject = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("project.json");
      if (!jsonFile) {
        alert("ไฟล์โปรเจกต์ไม่ถูกต้อง (ไม่พบ project.json)");
        return;
      }

      const text = await jsonFile.async("string");
      const projectData = JSON.parse(text);

      // Reset
      setObjects([]);
      setSelectedObjectId(null);

      // Load Marker
      if (projectData.marker) {
        const mName = projectData.marker.name || 'Target01.jpg';
        const mWidth = projectData.marker.widthCm || 15;

        const markerZipFile = zip.file(mName);
        if (markerZipFile) {
          const blob = await markerZipFile.async("blob");
          const fileObj = new File([blob], mName, { type: blob.type });
          handleMarkerUpload(fileObj);
        } else {
          setMarkerData((prev) => ({ ...prev, name: mName, widthCm: mWidth }));
        }
      }

      // Load Mind Buffer
      const mindZipFile = zip.file("targets.mind");
      if (mindZipFile) {
        const buffer = await mindZipFile.async("arraybuffer");
        setCompiledMindBuffer(buffer);
        setCompilerStatus('success');
        setCompilerProgress(100);
      }

      // Load Objects
      if (Array.isArray(projectData.objects)) {
        const loadedObjects: ARObjectData[] = [];

        for (const objData of projectData.objects) {
          const newId = 'loaded_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

          let fileObj: File | undefined = undefined;
          let threeObj: THREE.Object3D | undefined = undefined;
          let videoElem: HTMLVideoElement | undefined = undefined;
          let mixer: THREE.AnimationMixer | undefined = undefined;
          let animations: THREE.AnimationClip[] | undefined = undefined;

          if (objData.fileName) {
            const assetZipFile = zip.file(objData.fileName);
            if (assetZipFile) {
              const blob = await assetZipFile.async("blob");
              fileObj = new File([blob], objData.fileName, { type: blob.type });
            }
          }

          if (objData.type === 'glb' && fileObj) {
            const url = URL.createObjectURL(fileObj);
            const loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
            loader.setDRACOLoader(dracoLoader);

            try {
              const gltf = await loader.loadAsync(url);
              threeObj = gltf.scene;
              threeObj.scale.set(1, 1, 1);
              animations = gltf.animations || [];
              if (animations.length > 0) {
                mixer = new THREE.AnimationMixer(threeObj);
                const clipIdx = objData.activeAnimIndex || 0;
                mixer.clipAction(animations[clipIdx] || animations[0]).play();
              }
            } catch (e) {
              console.warn("Failed to parse GLB in project load:", e);
            }
          } else if (objData.type === 'video' && fileObj) {
            const url = URL.createObjectURL(fileObj);
            videoElem = document.createElement('video');
            videoElem.src = url;
            videoElem.loop = true;
            videoElem.muted = true;
            videoElem.setAttribute('playsinline', '');
            videoElem.setAttribute('webkit-playsinline', '');
            videoElem.play().catch(() => {});

            const texture = new THREE.VideoTexture(videoElem);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            let mat: THREE.Material;
            if (objData.chromaKeyEnabled) {
              mat = createChromaKeyMaterial(texture, objData.chromaKeyColor || '#00ff00');
            } else {
              mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
            }

            const geom = new THREE.PlaneGeometry(0.12, 0.08);
            threeObj = new THREE.Mesh(geom, mat);

            const vMesh = threeObj as THREE.Mesh;
            videoElem.onloadedmetadata = () => {
              if (videoElem && videoElem.videoWidth && videoElem.videoHeight) {
                const aspect = videoElem.videoWidth / videoElem.videoHeight;
                vMesh.geometry.dispose();
                vMesh.geometry = new THREE.PlaneGeometry(0.12, 0.12 / aspect);
              }
            };
          }

          loadedObjects.push({
            id: newId,
            name: objData.name || 'Object',
            type: objData.type || 'cube',
            visible: objData.visible ?? true,
            position: objData.position || [0, 0, 0],
            rotation: objData.rotation || [0, 0, 0],
            scale: objData.scale || [1, 1, 1],
            colorHex: objData.colorHex || '#6366f1',
            opacity: objData.opacity ?? 1.0,
            intensity: objData.intensity || 2.0,
            fileName: objData.fileName || undefined,
            file: fileObj,
            threeObject: threeObj,
            videoElement: videoElem,
            mixer: mixer,
            animations: animations,
            activeAnimIndex: objData.activeAnimIndex || 0,
            chromaKeyEnabled: objData.chromaKeyEnabled || false,
            chromaKeyColor: objData.chromaKeyColor || '#00ff00'
          });
        }

        setObjects(loadedObjects);
        if (loadedObjects.length > 0) {
          setSelectedObjectId(loadedObjects[0].id);
        }
      }

      alert("โหลดโปรเจกต์ .webar สำเร็จสมบูรณ์! ✅");
    } catch (err) {
      console.error("Load project error:", err);
      alert("เกิดข้อผิดพลาดในการเปิดไฟล์โปรเจกต์");
    }
  };

  // Export Standalone WebAR Package (.zip)
  const handleExportPackage = async () => {
    try {
      const blob = await exportStandalonePackage(
        markerData,
        objects,
        compiledMindBuffer,
        sequenceData
      );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `webar-project-package.zip`;
      link.click();
    } catch (err) {
      console.error("Export error:", err);
      alert("เกิดข้อผิดพลาดในการส่งออกแพ็กเกจ WebAR");
    }
  };

  const selectedObject = objects.find((o) => o.id === selectedObjectId) || null;

  return (
    <div className="h-full flex flex-col font-['Prompt',sans-serif] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header Bar */}
      <Header
        gizmoMode={gizmoMode}
        setGizmoMode={setGizmoMode}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onStartPreview={() => setIsARModalOpen(true)}
        onExportPackage={handleExportPackage}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-full md:w-80 bg-slate-900/95 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0 z-10 max-h-60 md:max-h-none overflow-hidden">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 border-b border-slate-800 text-[11px] font-medium bg-slate-950/60">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`py-2 text-center transition ${
                activeTab === 'tracker'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
              }`}
            >
              Tracker
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`py-2 text-center transition ${
                activeTab === 'add'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
              }`}
            >
              + โมเดล
            </button>
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`py-2 text-center transition ${
                activeTab === 'hierarchy'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
              }`}
            >
              Hierarchy
            </button>
            <button
              onClick={() => setActiveTab('sequence')}
              className={`py-2 text-center transition ${
                activeTab === 'sequence'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
              }`}
            >
              Sequence
            </button>
          </div>

          {/* Sidebar Tab Panels */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {activeTab === 'tracker' && (
              <SidebarTracker
                markerData={markerData}
                compilerStatus={compilerStatus}
                compilerProgress={compilerProgress}
                compilerErrorMessage={compilerError}
                onMarkerUpload={handleMarkerUpload}
                onWidthChange={handleMarkerWidthChange}
                onNameChange={(name) => setMarkerData((p) => ({ ...p, name }))}
                onLoadDefaultMarker={loadDefaultMarker}
              />
            )}

            {activeTab === 'add' && (
              <SidebarAdd
                onCreatePrimitive={handleCreatePrimitive}
                onGLBUpload={handleGLBUpload}
                onVideoUpload={handleVideoUpload}
              />
            )}

            {activeTab === 'hierarchy' && (
              <SidebarHierarchy
                objects={objects}
                selectedObjectId={selectedObjectId}
                markerName={markerData.name}
                onSelectObject={(id) => setSelectedObjectId(id)}
                onToggleVisibility={handleToggleVisibility}
                onDeleteObject={handleDeleteObject}
              />
            )}

            {activeTab === 'sequence' && (
              <SidebarSequence
                sequenceData={sequenceData}
                onSequenceUpload={handleSequenceUpload}
                onUpdateSequence={(updated) =>
                  setSequenceData((p) => ({ ...p, ...updated }))
                }
              />
            )}
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
          <WebGLCanvas
            markerData={markerData}
            objects={objects}
            selectedObjectId={selectedObjectId}
            gizmoMode={gizmoMode}
            sequenceData={sequenceData}
            onSelectObject={setSelectedObjectId}
            onUpdateObjectTransform={handleUpdateObjectTransform}
          />
        </main>

        {/* Right Inspector Sidebar */}
        <aside className="w-full md:w-80 bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0 z-10 max-h-56 md:max-h-none overflow-y-auto">
          <div className="h-9 px-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              7. INSPECTOR
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
              {selectedObject ? selectedObject.type : 'None'}
            </span>
          </div>

          <Inspector
            selectedObject={selectedObject}
            onUpdateObject={handleUpdateObjectProps}
            onDeleteObject={handleDeleteObject}
            onChangeAnimation={handleChangeGLBAnimation}
          />
        </aside>
      </div>

      {/* AR Live Camera Modal */}
      <ARCameraModal
        isOpen={isARModalOpen}
        markerData={markerData}
        objects={objects}
        compiledMindBuffer={compiledMindBuffer}
        onClose={() => setIsARModalOpen(false)}
      />
    </div>
  );
}
