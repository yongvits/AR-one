import JSZip from 'jszip';
import { ARObjectData, MarkerData, ProjectJSON, SequenceData } from '../types/webar';

export async function saveProjectFile(
  markerData: MarkerData,
  objects: ARObjectData[],
  compiledMindBuffer: ArrayBuffer | null,
  sequenceData: SequenceData
): Promise<Blob> {
  const zip = new JSZip();

  // Ensure all objects have valid filenames for saving
  const processedObjects = objects.map(obj => {
    let fileName = obj.fileName;
    if (!fileName && (obj.type === 'glb' || obj.type === 'video')) {
      fileName = `${obj.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}_${obj.id}.${obj.type === 'video' ? 'mp4' : 'glb'}`;
    }
    return { ...obj, fileName };
  });

  const projectData: ProjectJSON = {
    version: "5.5.1",
    timestamp: new Date().toISOString(),
    marker: {
      name: markerData.name,
      widthCm: markerData.widthCm,
      heightCm: markerData.heightCm
    },
    objects: processedObjects.map(obj => ({
      name: obj.name,
      type: obj.type,
      fileName: obj.fileName || null,
      colorHex: obj.colorHex || '#6366f1',
      opacity: obj.opacity ?? 1.0,
      position: obj.position,
      rotation: obj.rotation,
      scale: obj.scale,
      visible: obj.visible,
      intensity: obj.intensity || 2.0,
      activeAnimIndex: obj.activeAnimIndex || 0,
      chromaKeyEnabled: obj.chromaKeyEnabled || false,
      chromaKeyColor: obj.chromaKeyColor || '#00ff00'
    }))
  };

  zip.file("project.json", JSON.stringify(projectData, null, 2));

  if (compiledMindBuffer) {
    zip.file("targets.mind", compiledMindBuffer);
  }

  if (markerData.file) {
    zip.file(markerData.name, markerData.file);
  }

  // Save GLB models and videos reliably
  for (const obj of processedObjects) {
    if ((obj.type === 'glb' || obj.type === 'video') && obj.fileName) {
      if (obj.file) {
        zip.file(obj.fileName, obj.file);
      } else if (obj.videoElement?.src) {
        try {
          const res = await fetch(obj.videoElement.src);
          const blob = await res.blob();
          zip.file(obj.fileName, blob);
        } catch (e) {
          console.warn("Could not fetch video blob for save:", e);
        }
      }
    }
  }

  if (sequenceData.files.length > 0) {
    const seqFolder = zip.folder("effect");
    if (seqFolder) {
      sequenceData.files.forEach(f => seqFolder.file(f.name, f));
    }
  }

  return await zip.generateAsync({ type: "blob" });
}

export async function exportStandalonePackage(
  markerData: MarkerData,
  objects: ARObjectData[],
  compiledMindBuffer: ArrayBuffer | null,
  sequenceData: SequenceData
): Promise<Blob> {
  const zip = new JSZip();

  const sceneData = {
    marker: {
      name: markerData.name || 'marker.jpg',
      widthCm: markerData.widthCm,
      heightCm: markerData.heightCm
    },
    objects: objects.map(obj => ({
      name: obj.name,
      type: obj.type,
      fileName: obj.fileName || null,
      colorHex: obj.colorHex || '#6366f1',
      opacity: obj.opacity ?? 1.0,
      position: obj.position,
      rotation: obj.rotation,
      scale: obj.scale,
      visible: obj.visible,
      intensity: obj.intensity || 2.0,
      activeAnimIndex: obj.activeAnimIndex || 0,
      frames: obj.type === 'sequence' ? sequenceData.files.map(f => f.name) : null,
      fps: sequenceData.fps,
      chromaKeyEnabled: obj.chromaKeyEnabled || false,
      chromaKeyColor: obj.chromaKeyColor || '#00ff00'
    }))
  };

  zip.file("scene.json", JSON.stringify(sceneData, null, 2));

  const standaloneHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WebAR Experience - ${markerData.name}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; background: #000; font-family: system-ui, -apple-system, sans-serif; }
    #ar-overlay {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      color: #fff;
      background: rgba(15, 23, 42, 0.85);
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 500;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      text-align: center;
      pointer-events: none;
      transition: all 0.3s ease;
    }
    video { object-fit: cover !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 1 !important; }
    canvas { position: absolute !important; top: 0 !important; left: 0 !important; z-index: 2 !important; pointer-events: none !important; background: transparent !important; }
  </style>
</head>
<body>
  <div id="ar-overlay">📷 ส่องกล้องไปที่รูปภาพ Target เพื่อดู AR</div>
  <script src="main.js"></script>
</body>
</html>`;

  zip.file("index.html", standaloneHtml);

  const standaloneMainJs = `window.addEventListener('DOMContentLoaded', async () => {
  const overlay = document.getElementById('ar-overlay');
  const res = await fetch('./scene.json');
  const sceneConfig = await res.json();

  let targetSrc = './assets/targets.mind';
  try {
    const testRes = await fetch(targetSrc, { method: 'HEAD' });
    if (!testRes.ok) throw new Error("Mind target file missing");
  } catch(e) {
    const markerFileName = sceneConfig.marker?.name || 'marker.jpg';
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.src = './assets/' + markerFileName;
    await new Promise((resolve, reject) => {
      imgElement.onload = resolve;
      imgElement.onerror = reject;
    });

    const compiler = new window.MINDAR.IMAGE.Compiler();
    await compiler.compileImageTargets([imgElement], () => {});
    const compiledBuffer = await compiler.exportData();
    const blob = new Blob([compiledBuffer], { type: 'application/octet-stream' });
    targetSrc = URL.createObjectURL(blob);
  }

  const mindarThree = new window.MINDAR.IMAGE.MindARThree({
    container: document.body,
    imageTargetSrc: targetSrc,
    uiLoading: "no",
    uiScanning: "no",
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 5,
    missTolerance: 10
  });

  const { renderer, scene, camera } = mindarThree;

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(1, 2, 2);
  scene.add(dirLight);

  const anchor = mindarThree.addAnchor(0);
  const mixers = [];
  const videosToControl = [];

  // Smooth Group lerps world transform to eliminate camera micro-jitter
  const smoothGroup = new THREE.Group();
  scene.add(smoothGroup);

  // Studio Group container inside smoothGroup
  // Aligns Studio Viewport coordinates with MindAR Anchor coordinates.
  const studioGroup = new THREE.Group();
  smoothGroup.add(studioGroup);

  studioGroup.rotation.x = Math.PI / 2;

  const targetWidthMeters = (sceneConfig.marker?.widthCm || 15) / 100;
  const scaleFactor = 1 / targetWidthMeters;
  studioGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

  function createChromaKeyMat(texture, keyColorHex = '#00ff00') {
    const col = new THREE.Color(keyColorHex);
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uKeyColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
        uSimilarity: { value: 0.4 },
        uSmoothness: { value: 0.1 },
        uOpacity: { value: 1.0 }
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D uTexture; uniform vec3 uKeyColor; uniform float uSimilarity; uniform float uSmoothness; uniform float uOpacity; varying vec2 vUv; void main() { vec4 texColor = texture2D(uTexture, vUv); float dist = distance(texColor.rgb, uKeyColor); float alpha = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist); gl_FragColor = vec4(texColor.rgb, texColor.a * alpha * uOpacity); }',
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  if (sceneConfig.objects && sceneConfig.objects.length > 0) {
    for (const objData of sceneConfig.objects) {
      if (objData.visible === false) continue;
      let object3D;

      const degToRad = (deg) => (deg * Math.PI) / 180;

      if (objData.type === 'cube') {
        const geom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const mat = new THREE.MeshStandardMaterial({ 
          color: objData.colorHex || 0x6366f1,
          transparent: (objData.opacity ?? 1) < 1,
          opacity: objData.opacity ?? 1
        });
        object3D = new THREE.Mesh(geom, mat);
      } else if (objData.type === 'sphere') {
        const geom = new THREE.SphereGeometry(0.05, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ 
          color: objData.colorHex || 0x6366f1,
          transparent: (objData.opacity ?? 1) < 1,
          opacity: objData.opacity ?? 1 
        });
        object3D = new THREE.Mesh(geom, mat);
      } else if (objData.type === 'cylinder') {
        const geom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 32);
        const mat = new THREE.MeshStandardMaterial({ color: objData.colorHex || 0x6366f1 });
        object3D = new THREE.Mesh(geom, mat);
      } else if (objData.type === 'plane') {
        const geom = new THREE.PlaneGeometry(0.1, 0.1);
        const mat = new THREE.MeshStandardMaterial({ color: objData.colorHex || 0x6366f1, side: THREE.DoubleSide });
        object3D = new THREE.Mesh(geom, mat);
      } else if (objData.type === 'light') {
        object3D = new THREE.PointLight(0xffaa00, objData.intensity || 2.0, 2);
      } else if (objData.type === 'glb' && objData.fileName) {
        const loader = new THREE.GLTFLoader();
        const dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
        loader.setDRACOLoader(dracoLoader);

        try {
          const gltf = await new Promise((resolve, reject) => {
            loader.load('./assets/' + objData.fileName, resolve, undefined, reject);
          });
          object3D = gltf.scene;
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(object3D);
            const clipIdx = objData.activeAnimIndex || 0;
            const clip = gltf.animations[clipIdx] || gltf.animations[0];
            mixer.clipAction(clip).play();
            mixers.push(mixer);
          }
        } catch(e) {
          console.warn("Error loading GLB:", objData.fileName);
        }
      } else if (objData.type === 'video' && objData.fileName) {
        const video = document.createElement('video');
        video.src = './assets/' + objData.fileName;
        video.loop = true;
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.play().catch(() => {});

        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        let mat;
        if (objData.chromaKeyEnabled) {
          mat = createChromaKeyMat(texture, objData.chromaKeyColor || '#00ff00');
        } else {
          mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        }

        let aspect = 1.5;
        if (video.videoWidth && video.videoHeight) {
          aspect = video.videoWidth / video.videoHeight;
        }
        const geom = new THREE.PlaneGeometry(0.12, 0.12 / aspect);
        object3D = new THREE.Mesh(geom, mat);

        const vMesh = object3D;
        const updateAspect = () => {
          if (video.videoWidth && video.videoHeight) {
            const realAspect = video.videoWidth / video.videoHeight;
            vMesh.geometry.dispose();
            vMesh.geometry = new THREE.PlaneGeometry(0.12, 0.12 / realAspect);
          }
        };

        if (video.readyState >= 1) {
          updateAspect();
        } else {
          video.onloadedmetadata = updateAspect;
          video.onloadeddata = updateAspect;
        }

        videosToControl.push(video);
      }

      if (object3D) {
        object3D.position.set(...objData.position);
        object3D.rotation.set(
          degToRad(objData.rotation[0]),
          degToRad(objData.rotation[1]),
          degToRad(objData.rotation[2])
        );
        object3D.scale.set(...objData.scale);
        studioGroup.add(object3D);
      }
    }
  }

  let isTracked = false;

  anchor.onTargetFound = () => {
    isTracked = false;
    overlay.style.background = "rgba(16, 185, 129, 0.9)";
    overlay.innerHTML = "✨ พบภาพ Target! แสดงวัตถุ AR";
    videosToControl.forEach(v => v.play().catch(() => {}));
  };

  anchor.onTargetLost = () => {
    isTracked = false;
    overlay.style.background = "rgba(15, 23, 42, 0.85)";
    overlay.innerHTML = "📷 ส่องกล้องไปที่รูปภาพ Target เพื่อดู AR";
    videosToControl.forEach(v => v.pause());
  };

  await mindarThree.start();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    mixers.forEach(m => m.update(delta));

    if (anchor.group.visible) {
      smoothGroup.visible = true;
      if (!isTracked) {
        smoothGroup.position.copy(anchor.group.position);
        smoothGroup.quaternion.copy(anchor.group.quaternion);
        smoothGroup.scale.copy(anchor.group.scale);
        isTracked = true;
      } else {
        smoothGroup.position.lerp(anchor.group.position, 0.25);
        smoothGroup.quaternion.slerp(anchor.group.quaternion, 0.25);
        smoothGroup.scale.lerp(anchor.group.scale, 0.25);
      }
    } else {
      smoothGroup.visible = false;
      isTracked = false;
    }

    renderer.render(scene, camera);
  });
});`;

  zip.file("main.js", standaloneMainJs);

  const assetsFolder = zip.folder("assets");
  if (assetsFolder) {
    if (compiledMindBuffer) {
      assetsFolder.file("targets.mind", compiledMindBuffer);
    }
    if (markerData.file) {
      assetsFolder.file(markerData.name, markerData.file);
    }

    for (const obj of objects) {
      const fileName = obj.fileName || `${obj.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}_${obj.id}.${obj.type === 'video' ? 'mp4' : 'glb'}`;
      if ((obj.type === 'glb' || obj.type === 'video') && fileName) {
        if (obj.file) {
          assetsFolder.file(fileName, obj.file);
        } else if (obj.videoElement?.src) {
          try {
            const res = await fetch(obj.videoElement.src);
            const blob = await res.blob();
            assetsFolder.file(fileName, blob);
          } catch (e) {
            console.warn("Could not fetch video blob for export package:", e);
          }
        }
      }
    }

    if (sequenceData.files.length > 0) {
      const effectFolder = assetsFolder.folder("effect");
      if (effectFolder) {
        sequenceData.files.forEach(file => {
          effectFolder.file(file.name, file);
        });
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}
