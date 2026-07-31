import JSZip from 'jszip';
import { ARObjectData, MarkerData, ProjectJSON, SequenceData } from '../types/webar';

export async function saveProjectFile(
  markerData: MarkerData,
  objects: ARObjectData[],
  compiledMindBuffer: ArrayBuffer | null,
  sequenceData: SequenceData
): Promise<Blob> {
  const zip = new JSZip();

  const projectData: ProjectJSON = {
    version: "5.5.1",
    timestamp: new Date().toISOString(),
    marker: {
      name: markerData.name,
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

  objects.forEach(obj => {
    if ((obj.type === 'glb' || obj.type === 'video') && obj.file && obj.fileName) {
      zip.file(obj.fileName, obj.file);
    }
  });

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
    uiScanning: "no"
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
        const texture = new THREE.VideoTexture(video);
        const geom = new THREE.PlaneGeometry(0.12, 0.08);
        const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        object3D = new THREE.Mesh(geom, mat);
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
        anchor.group.add(object3D);
      }
    }
  }

  anchor.onTargetFound = () => {
    overlay.style.background = "rgba(16, 185, 129, 0.9)";
    overlay.innerHTML = "✨ พบภาพ Target! แสดงวัตถุ AR";
    videosToControl.forEach(v => v.play().catch(() => {}));
  };

  anchor.onTargetLost = () => {
    overlay.style.background = "rgba(15, 23, 42, 0.85)";
    overlay.innerHTML = "📷 ส่องกล้องไปที่รูปภาพ Target เพื่อดู AR";
    videosToControl.forEach(v => v.pause());
  };

  await mindarThree.start();

  const iv = setInterval(() => {
    const videoElem = document.querySelector('video');
    if (videoElem) {
      videoElem.setAttribute('playsinline', '');
      videoElem.setAttribute('webkit-playsinline', '');
      videoElem.setAttribute('autoplay', '');
      videoElem.muted = true;
      if (videoElem.paused) videoElem.play().catch(() => {});
    } else {
      clearInterval(iv);
    }
  }, 500);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    mixers.forEach(m => m.update(delta));
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

    objects.forEach(obj => {
      if ((obj.type === 'glb' || obj.type === 'video') && obj.file && obj.fileName) {
        assetsFolder.file(obj.fileName, obj.file);
      }
    });

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
