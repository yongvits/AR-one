import React from 'react';
import { Upload, Box, Circle, Cylinder, Square, Lightbulb, Video, Plus, Shield } from 'lucide-react';
import { ObjectType } from '../types/webar';

interface SidebarAddProps {
  onCreatePrimitive: (type: ObjectType) => void;
  onGLBUpload: (file: File) => void;
  onVideoUpload: (file: File) => void;
}

export const SidebarAdd: React.FC<SidebarAddProps> = ({
  onCreatePrimitive,
  onGLBUpload,
  onVideoUpload
}) => {
  const glbInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* GLB Upload */}
      <div>
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
          2. GLB / GLTF 3D Model Import
        </h2>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <input
            type="file"
            ref={glbInputRef}
            accept=".glb,.gltf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onGLBUpload(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={() => glbInputRef.current?.click()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition shadow-md shadow-indigo-600/20"
          >
            <Upload className="w-4 h-4" />
            <span>อัปโหลดไฟล์ GLB / GLTF</span>
          </button>
        </div>
      </div>

      {/* Primitives */}
      <div>
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
          3. Primitive 3D Generator
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onCreatePrimitive('cube')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs font-medium text-slate-300 flex items-center justify-between transition"
          >
            <span>Cube</span>
            <Box className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={() => onCreatePrimitive('sphere')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs font-medium text-slate-300 flex items-center justify-between transition"
          >
            <span>Sphere</span>
            <Circle className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={() => onCreatePrimitive('plane')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs font-medium text-slate-300 flex items-center justify-between transition"
          >
            <span>Plane</span>
            <Square className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={() => onCreatePrimitive('cylinder')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs font-medium text-slate-300 flex items-center justify-between transition"
          >
            <span>Cylinder</span>
            <Cylinder className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={() => onCreatePrimitive('capsule')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs font-medium text-slate-300 flex items-center justify-between transition"
          >
            <span>Capsule</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={() => onCreatePrimitive('light')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs font-medium text-slate-300 flex items-center justify-between transition"
          >
            <span>Light Source</span>
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Video Texture */}
      <div>
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
          5. Video Texture
        </h2>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <input
            type="file"
            ref={videoInputRef}
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onVideoUpload(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={() => videoInputRef.current?.click()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition"
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>นำเข้าวิดีโอ (MP4, WebM)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
