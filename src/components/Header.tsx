import React from 'react';
import { 
  Box, 
  RotateCw, 
  Maximize2, 
  Save, 
  FolderOpen, 
  Camera, 
  Download, 
  Sparkles,
  Layers,
  Layers3
} from 'lucide-react';
import { GizmoMode } from '../types/webar';

interface HeaderProps {
  gizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  onStartPreview: () => void;
  onExportPackage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  gizmoMode,
  setGizmoMode,
  onSaveProject,
  onLoadProject,
  onStartPreview,
  onExportPackage
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadProject(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 md:px-4 z-20 shrink-0">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-2 md:space-x-3">
        <div className="p-1.5 md:p-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center">
          <Layers3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xs md:text-sm font-bold tracking-wide text-slate-100 flex items-center gap-1.5">
            WebAR Studio Pro
            <span className="text-[9px] md:text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
              v5.8.0 WebAR Pro
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 hidden md:block">
            เครื่องมือสร้าง WebAR Image Tracking & 3D Interactive
          </p>
        </div>
      </div>

      {/* Center Gizmo Controls & Actions */}
      <div className="flex items-center space-x-1.5 md:space-x-2 overflow-x-auto py-1">
        {/* Gizmo Tools */}
        <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex space-x-1 mr-1">
          <button
            onClick={() => setGizmoMode('translate')}
            title="ย้ายตำแหน่ง Move (W)"
            className={`p-1.5 rounded transition ${
              gizmoMode === 'translate'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            onClick={() => setGizmoMode('rotate')}
            title="หมุนวัตถุ Rotate (E)"
            className={`p-1.5 rounded transition ${
              gizmoMode === 'rotate'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setGizmoMode('scale')}
            title="ย่อ/ขยาย Scale (R)"
            className={`p-1.5 rounded transition ${
              gizmoMode === 'scale'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Save & Load Buttons */}
        <button
          onClick={onSaveProject}
          title="บันทึกไฟล์โปรเจกต์ .webar"
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center space-x-1.5 shadow transition shrink-0"
        >
          <Save className="w-3.5 h-3.5 text-sky-400" />
          <span>Save 💾</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          accept=".webar,.zip"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="โหลดไฟล์โปรเจกต์ .webar"
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center space-x-1.5 shadow transition shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Load 📂</span>
        </button>

        {/* Preview AR */}
        <button
          onClick={onStartPreview}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-lg shadow-amber-600/20 transition shrink-0"
        >
          <Camera className="w-4 h-4" />
          <span>Preview AR ⭐</span>
        </button>

        {/* Export Package */}
        <button
          onClick={onExportPackage}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export Package 🚀</span>
        </button>
      </div>
    </header>
  );
};
