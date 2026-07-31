import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { ARObjectData, GizmoMode, MarkerData, SequenceData } from '../types/webar';

interface WebGLCanvasProps {
  markerData: MarkerData;
  objects: ARObjectData[];
  selectedObjectId: string | null;
  gizmoMode: GizmoMode;
  sequenceData: SequenceData;
  onSelectObject: (id: string | null) => void;
  onUpdateObjectTransform: (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }
  ) => void;
}

export const WebGLCanvas: React.FC<WebGLCanvasProps> = ({
  markerData,
  objects,
  selectedObjectId,
  gizmoMode,
  sequenceData,
  onSelectObject,
  onUpdateObjectTransform
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const markerPlaneRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  
  const threeObjectsMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const mixersRef = useRef<Map<string, THREE.AnimationMixer>>(new Map());
  const animFrameIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const lastSeqFrameTimeRef = useRef<number>(0);
  const currentSeqFrameRef = useRef<number>(0);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      100
    );
    camera.position.set(0, 0.4, 0.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(1, 2, 1);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // OrbitControls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControlsRef.current = orbitControls;

    // TransformControls
    const transformControls = new TransformControls(camera, renderer.domElement);
    const transformHelper = transformControls.getHelper ? transformControls.getHelper() : (transformControls as unknown as THREE.Object3D);
    scene.add(transformHelper);
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
    });

    transformControls.addEventListener('change', () => {
      const activeThreeObj = transformControls.object;
      if (!activeThreeObj) return;

      const objId = activeThreeObj.userData?.id;
      if (!objId) return;

      const radToDeg = (rad: number) => (rad * 180) / Math.PI;

      onUpdateObjectTransform(objId, {
        position: [
          parseFloat(activeThreeObj.position.x.toFixed(3)),
          parseFloat(activeThreeObj.position.y.toFixed(3)),
          parseFloat(activeThreeObj.position.z.toFixed(3))
        ],
        rotation: [
          Math.round(radToDeg(activeThreeObj.rotation.x)),
          Math.round(radToDeg(activeThreeObj.rotation.y)),
          Math.round(radToDeg(activeThreeObj.rotation.z))
        ],
        scale: [
          parseFloat(activeThreeObj.scale.x.toFixed(3)),
          parseFloat(activeThreeObj.scale.y.toFixed(3)),
          parseFloat(activeThreeObj.scale.z.toFixed(3))
        ]
      });
    });

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      mixersRef.current.forEach((mixer) => mixer.update(delta));

      // Handle Sequence Textures
      if (sequenceData.textures.length > 0 && sequenceData.autoPlay) {
        const now = clockRef.current.getElapsedTime();
        if (now - lastSeqFrameTimeRef.current > 1 / sequenceData.fps) {
          lastSeqFrameTimeRef.current = now;
          currentSeqFrameRef.current =
            (currentSeqFrameRef.current + 1) % sequenceData.textures.length;

          threeObjectsMapRef.current.forEach((threeObj) => {
            if (threeObj.userData?.type === 'sequence') {
              const mesh = threeObj as THREE.Mesh;
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshBasicMaterial;
                mat.map = sequenceData.textures[currentSeqFrameRef.current];
                mat.needsUpdate = true;
              }
            }
          });
        }
      }

      orbitControls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);

      transformControls.dispose();
      orbitControls.dispose();
      renderer.dispose();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Marker Plane Surface Texture & Grid
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (markerPlaneRef.current) scene.remove(markerPlaneRef.current);
    if (gridHelperRef.current) scene.remove(gridHelperRef.current);

    const widthMeters = markerData.widthCm / 100;
    const heightMeters = widthMeters / (markerData.aspectRatio || 1.5);

    const geometry = new THREE.PlaneGeometry(widthMeters, heightMeters);

    let material: THREE.Material;
    if (markerData.texture) {
      material = new THREE.MeshBasicMaterial({
        map: markerData.texture,
        side: THREE.DoubleSide
      });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillRect(256, 256, 256, 256);
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Target Marker Surface', 256, 256);
      }
      const defaultTex = new THREE.CanvasTexture(canvas);
      material = new THREE.MeshBasicMaterial({
        map: defaultTex,
        side: THREE.DoubleSide
      });
    }

    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);
    markerPlaneRef.current = plane;

    const gridHelper = new THREE.GridHelper(
      widthMeters * 1.5,
      12,
      0x6366f1,
      0x1e293b
    );
    gridHelper.position.y = -0.001;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;
  }, [markerData.widthCm, markerData.aspectRatio, markerData.texture]);

  // Sync Objects Array to Three.js Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const currentMap = threeObjectsMapRef.current;
    const activeIds = new Set(objects.map((o) => o.id));

    // Remove deleted objects
    currentMap.forEach((threeObj, id) => {
      if (!activeIds.has(id)) {
        scene.remove(threeObj);
        mixersRef.current.delete(id);
        currentMap.delete(id);
      }
    });

    const degToRad = (deg: number) => (deg * Math.PI) / 180;

    // Add or Update objects
    objects.forEach((objData) => {
      let threeObj = currentMap.get(objData.id);

      if (!threeObj) {
        // Create 3D Object
        if (objData.type === 'cube') {
          const geom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
          const mat = new THREE.MeshStandardMaterial({
            color: objData.colorHex || '#6366f1',
            roughness: 0.3,
            metalness: 0.2
          });
          threeObj = new THREE.Mesh(geom, mat);
          threeObj.castShadow = true;
        } else if (objData.type === 'sphere') {
          const geom = new THREE.SphereGeometry(0.05, 32, 32);
          const mat = new THREE.MeshStandardMaterial({
            color: objData.colorHex || '#6366f1',
            roughness: 0.3,
            metalness: 0.2
          });
          threeObj = new THREE.Mesh(geom, mat);
          threeObj.castShadow = true;
        } else if (objData.type === 'cylinder') {
          const geom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 32);
          const mat = new THREE.MeshStandardMaterial({
            color: objData.colorHex || '#6366f1',
            roughness: 0.3
          });
          threeObj = new THREE.Mesh(geom, mat);
          threeObj.castShadow = true;
        } else if (objData.type === 'plane') {
          const geom = new THREE.PlaneGeometry(0.1, 0.1);
          const mat = new THREE.MeshStandardMaterial({
            color: objData.colorHex || '#6366f1',
            side: THREE.DoubleSide
          });
          threeObj = new THREE.Mesh(geom, mat);
        } else if (objData.type === 'capsule') {
          const group = new THREE.Group();
          const mat = new THREE.MeshStandardMaterial({
            color: objData.colorHex || '#6366f1',
            roughness: 0.3
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
          threeObj = group;
        } else if (objData.type === 'light') {
          const light = new THREE.PointLight(0xffaa00, objData.intensity || 2.0, 2);
          const helper = new THREE.PointLightHelper(light, 0.02);
          light.add(helper);
          threeObj = light;
        } else if (objData.threeObject) {
          threeObj = objData.threeObject;
        } else {
          // Fallback box
          const geom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
          const mat = new THREE.MeshStandardMaterial({ color: 0x6366f1 });
          threeObj = new THREE.Mesh(geom, mat);
        }

        threeObj.userData = { id: objData.id, type: objData.type };
        scene.add(threeObj);
        currentMap.set(objData.id, threeObj);

        // Mixers
        if (objData.mixer) {
          mixersRef.current.set(objData.id, objData.mixer);
        }
      }

      // Update properties
      threeObj.visible = objData.visible;
      threeObj.position.set(objData.position[0], objData.position[1], objData.position[2]);
      threeObj.rotation.set(
        degToRad(objData.rotation[0]),
        degToRad(objData.rotation[1]),
        degToRad(objData.rotation[2])
      );
      threeObj.scale.set(objData.scale[0], objData.scale[1], objData.scale[2]);

      // Light Intensity
      if (threeObj instanceof THREE.PointLight) {
        threeObj.intensity = objData.intensity || 2.0;
      }

      // Material Color & Opacity
      if (threeObj instanceof THREE.Mesh && threeObj.material) {
        const mat = threeObj.material as THREE.MeshStandardMaterial;
        if (mat.color && objData.colorHex) {
          mat.color.setStyle(objData.colorHex);
        }
        if (objData.opacity !== undefined) {
          mat.opacity = objData.opacity;
          mat.transparent = objData.opacity < 1;
        }
      }
    });
  }, [objects]);

  // Update Transform Controls Mode & Selected Object Attachment
  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (!transformControls) return;

    transformControls.setMode(gizmoMode);

    if (selectedObjectId) {
      const activeObj = threeObjectsMapRef.current.get(selectedObjectId);
      if (activeObj) {
        transformControls.attach(activeObj);
      } else {
        transformControls.detach();
      }
    } else {
      transformControls.detach();
    }
  }, [selectedObjectId, gizmoMode]);

  const handleResetCamera = () => {
    if (cameraRef.current && orbitControlsRef.current) {
      cameraRef.current.position.set(0, 0.4, 0.5);
      orbitControlsRef.current.target.set(0, 0, 0);
      orbitControlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950">
      {/* Status Overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-2">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 flex items-center space-x-2 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>3D Studio Viewport</span>
        </div>

        <button
          onClick={handleResetCamera}
          className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 font-medium transition shadow-lg"
        >
          Reset Cam
        </button>
      </div>

      {/* WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full flex-1 cursor-grab active:cursor-grabbing"
      />

      {/* Footer Info Bar */}
      <div className="h-6 bg-slate-900/90 border-t border-slate-800 px-3 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0 z-10">
        <span>Selected ID: {selectedObjectId || 'None'}</span>
        <span>Grid: 1 unit = 1m</span>
      </div>
    </div>
  );
};
