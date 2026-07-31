import * as THREE from 'three';

export type ObjectType = 
  | 'cube' 
  | 'sphere' 
  | 'cylinder' 
  | 'plane' 
  | 'capsule' 
  | 'circle' 
  | 'light' 
  | 'glb' 
  | 'video' 
  | 'sequence';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type SidebarTab = 'tracker' | 'add' | 'hierarchy' | 'sequence';
export type CompilerStatus = 'idle' | 'compiling' | 'success' | 'error';

export interface MarkerData {
  name: string;
  widthCm: number;
  heightCm: number;
  aspectRatio: number;
  texture: THREE.Texture | null;
  file: File | null;
  imgElement: HTMLImageElement | null;
  previewUrl: string | null;
}

export interface ARObjectData {
  id: string;
  name: string;
  type: ObjectType;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number]; // degrees [X, Y, Z]
  scale: [number, number, number];
  colorHex: string;
  opacity: number;
  intensity?: number;
  fileName?: string;
  file?: File;
  rawGltf?: any;
  mixer?: THREE.AnimationMixer | null;
  animations?: THREE.AnimationClip[];
  activeAnimIndex?: number;
  videoElement?: HTMLVideoElement;
  threeObject?: THREE.Object3D;
  chromaKeyEnabled?: boolean;
  chromaKeyColor?: string;
  chromaKeySimilarity?: number;
}

export interface SequenceData {
  files: File[];
  textures: THREE.Texture[];
  fps: number;
  mode: 'loop' | 'pingpong' | 'once';
  autoPlay: boolean;
}

export interface ProjectJSON {
  version: string;
  timestamp: string;
  marker: {
    name: string;
    widthCm: number;
    heightCm: number;
  };
  objects: {
    name: string;
    type: ObjectType;
    fileName?: string | null;
    colorHex?: string;
    opacity?: number;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    visible: boolean;
    intensity?: number;
    activeAnimIndex?: number;
    chromaKeyEnabled?: boolean;
    chromaKeyColor?: string;
  }[];
}
