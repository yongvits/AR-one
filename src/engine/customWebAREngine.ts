/**
 * Custom WebGL2 WebAR Engine Coordinator
 * Modular WebAR Engine written in pure TypeScript & WebGL2
 */

import * as THREE from 'three';
import { FASTDetector, Keypoint } from './fast';
import { ORBExtractor } from './orb';
import { FeatureMatcher, MatchPair } from './matcher';
import { OpticalFlowTracker } from './opticalFlow';
import { KalmanPoseFilter } from './kalman';
import { PoseSolver } from './pose';

export interface CustomEngineOptions {
  videoElement: HTMLVideoElement;
  container: HTMLElement;
  targetImageUrl?: string;
  onTargetFound?: () => void;
  onTargetLost?: () => void;
}

export class CustomWebAREngine {
  private video: HTMLVideoElement;
  private container: HTMLElement;

  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;

  private fastDetector = new FASTDetector(22);
  private orbExtractor = new ORBExtractor();
  private matcher = new FeatureMatcher();
  private opticalFlow = new OpticalFlowTracker();
  private kalman = new KalmanPoseFilter();

  // Target Marker Features
  private markerKeypoints: Keypoint[] = [];
  private markerDescriptors: Uint8Array[] = [];
  private markerImageWidth = 1;
  private markerImageHeight = 1;

  // Frame State
  private prevFrameData: Uint8Array | null = null;
  private trackedKeypoints: Keypoint[] = [];

  // Three.js Pipeline
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public anchorGroup = new THREE.Group();

  private isRunning = false;
  private animationFrameId = 0;

  private onTargetFound?: () => void;
  private onTargetLost?: () => void;

  constructor(options: CustomEngineOptions) {
    this.video = options.videoElement;
    this.container = options.container;
    this.onTargetFound = options.onTargetFound;
    this.onTargetLost = options.onTargetLost;

    this.canvas = document.createElement('canvas');
    this.ctx2d = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.initThreeJS();
  }

  private initThreeJS(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.container.appendChild(this.renderer.domElement);
    this.scene.add(this.anchorGroup);

    // Video background plane inside Three scene
    const videoTexture = new THREE.VideoTexture(this.video);
    (videoTexture as any).colorSpace = (THREE as any).SRGBColorSpace || 'srgb';
  }

  /**
   * Pre-computes ORB features for the uploaded Marker Image
   */
  public async setMarkerImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.markerImageWidth = img.width;
        this.markerImageHeight = img.height;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const ctx = offCanvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const gray = this.toGrayscale(imgData.data, img.width, img.height);

        this.markerKeypoints = this.fastDetector.detect(gray, img.width, img.height, 600);
        this.markerDescriptors = this.orbExtractor.computeDescriptors(this.markerKeypoints, gray, img.width, img.height);

        console.log(`[CustomWebAREngine] Marker features extracted: ${this.markerKeypoints.length} keypoints`);
        resolve();
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.kalman.reset();
    this.processLoop();
  }

  public stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private processLoop = (): void => {
    if (!this.isRunning) return;

    if (this.video.readyState >= 2) {
      this.processVideoFrame();
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.processLoop);
  };

  private processVideoFrame(): void {
    const vWidth = this.video.videoWidth || 640;
    const vHeight = this.video.videoHeight || 480;

    if (this.canvas.width !== vWidth || this.canvas.height !== vHeight) {
      this.canvas.width = vWidth;
      this.canvas.height = vHeight;
    }

    this.ctx2d.drawImage(this.video, 0, 0, vWidth, vHeight);
    const frameData = this.ctx2d.getImageData(0, 0, vWidth, vHeight);
    const currGray = this.toGrayscale(frameData.data, vWidth, vHeight);

    let isMatched = false;
    let rawPos = new THREE.Vector3();
    let rawRot = new THREE.Quaternion();
    let rawScale = new THREE.Vector3(1, 1, 1);

    // Fast Optical Flow Tracking from previous frame
    if (this.prevFrameData && this.trackedKeypoints.length >= 8) {
      const { trackedKeypoints, status } = this.opticalFlow.track(
        this.prevFrameData,
        currGray,
        this.trackedKeypoints,
        vWidth,
        vHeight
      );

      const validPoints = trackedKeypoints.filter((_, idx) => status[idx]);
      if (validPoints.length >= 6) {
        this.trackedKeypoints = validPoints;
        isMatched = true;
      }
    }

    // Full ORB Detection & RANSAC Matching
    if (!isMatched || this.trackedKeypoints.length < 12) {
      const frameKeypoints = this.fastDetector.detect(currGray, vWidth, vHeight, 400);
      const frameDescriptors = this.orbExtractor.computeDescriptors(frameKeypoints, currGray, vWidth, vHeight);

      if (this.markerDescriptors.length > 0 && frameDescriptors.length > 0) {
        const matches = this.matcher.matchKNN(
          this.markerKeypoints,
          this.markerDescriptors,
          frameKeypoints,
          frameDescriptors,
          0.75
        );

        if (matches.length >= 6) {
          const { H, inliers } = this.matcher.findHomographyRANSAC(matches, 80, 4.0);

          if (H && inliers.length >= 5) {
            isMatched = true;
            this.trackedKeypoints = inliers.map(m => m.trainKp);

            const poseMat = PoseSolver.homographyToMatrix4(H, 600);
            const trs = PoseSolver.matrix4ToTRS(poseMat);

            rawPos = trs.position;
            rawRot = trs.quaternion;
            rawScale = trs.scale;
          }
        }
      }
    }

    // 6DoF Extended Kalman Filter & Deadzone Smoothing
    const filteredPose = this.kalman.update(rawPos, rawRot, rawScale, isMatched, 0.016);

    this.anchorGroup.position.copy(filteredPose.position);
    this.anchorGroup.quaternion.copy(filteredPose.quaternion);
    this.anchorGroup.scale.copy(filteredPose.scale);
    this.anchorGroup.visible = filteredPose.visible;

    if (filteredPose.visible && this.onTargetFound) {
      this.onTargetFound();
    } else if (!filteredPose.visible && this.onTargetLost) {
      this.onTargetLost();
    }

    this.prevFrameData = currGray;
  }

  private toGrayscale(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      gray[i] = (r * 77 + g * 150 + b * 29) >> 8;
    }
    return gray;
  }
}
