import React from 'react';
import { Upload, CheckCircle2, AlertCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { CompilerStatus, MarkerData } from '../types/webar';

interface SidebarTrackerProps {
  markerData: MarkerData;
  compilerStatus: CompilerStatus;
  compilerProgress: number;
  compilerErrorMessage?: string;
  onMarkerUpload: (file: File) => void;
  onWidthChange: (widthCm: number) => void;
  onNameChange: (name: string) => void;
  onLoadDefaultMarker: () => void;
}

export const SidebarTracker: React.FC<SidebarTrackerProps> = ({
  markerData,
  compilerStatus,
  compilerProgress,
  compilerErrorMessage,
  onMarkerUpload,
  onWidthChange,
  onNameChange,
  onLoadDefaultMarker
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onMarkerUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          1. Image Tracker Manager
          {compilerStatus === 'success' && <span className="text-emerald-400">✅</span>}
        </h2>
        <button
          onClick={onLoadDefaultMarker}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-medium"
        >
          ใช้รูปตั้งต้น (Default)
        </button>
      </div>

      {/* Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 rounded-xl p-3.5 text-center cursor-pointer transition group"
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png, image/jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="w-6 h-6 mx-auto text-slate-500 group-hover:text-indigo-400 mb-1.5 transition" />
        <p className="text-xs text-slate-300 font-medium">
          Drag & Drop หรือคลิกเลือกรูป AR Target
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">รองรับไฟล์ JPG, PNG</p>
      </div>

      {/* Compiler Progress Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-indigo-300 font-medium flex items-center gap-1">
            {compilerStatus === 'compiling' && <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />}
            สถานะ AR Target:
          </span>
          <span
            className={`font-mono text-[11px] font-bold ${
              compilerStatus === 'success'
                ? 'text-emerald-400'
                : compilerStatus === 'error'
                ? 'text-red-400'
                : compilerStatus === 'compiling'
                ? 'text-amber-400'
                : 'text-slate-400'
            }`}
          >
            {compilerStatus === 'success' && 'พร้อมใช้งาน (100%) ✅'}
            {compilerStatus === 'compiling' && `กำลังสกัดจุดเด่น (${compilerProgress}%)`}
            {compilerStatus === 'error' && 'เกิดข้อผิดพลาด ❌'}
            {compilerStatus === 'idle' && 'รอรูปภาพ...'}
          </span>
        </div>

        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              compilerStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${compilerProgress}%` }}
          />
        </div>

        {compilerErrorMessage && (
          <p className="text-[10px] text-red-400 font-mono mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{compilerErrorMessage}</span>
          </p>
        )}
      </div>

      {/* Target Preview & Physical Scale */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-medium text-slate-300">ชื่อ Target</span>
          <input
            type="text"
            value={markerData.name}
            onChange={(e) => onNameChange(e.target.value)}
            className="text-[11px] font-mono text-indigo-300 bg-slate-900 border border-slate-700 rounded px-2 py-1 w-32 text-right focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
          {markerData.previewUrl ? (
            <img
              src={markerData.previewUrl}
              alt="Marker Preview"
              className="max-h-full object-contain"
            />
          ) : (
            <div className="text-xs text-slate-500 flex flex-col items-center gap-1">
              <ImageIcon className="w-6 h-6 text-slate-600" />
              <span>ใช้รูป Marker ตั้งต้น</span>
            </div>
          )}
        </div>

        {/* Real World Dimensions */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] text-slate-400 font-medium">
            ขนาดจริงในโลกจริง (Real World Scale)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500">Width:</span>
              <div className="flex items-center mt-1">
                <input
                  type="number"
                  value={markerData.widthCm}
                  min="1"
                  step="0.5"
                  onChange={(e) => onWidthChange(parseFloat(e.target.value) || 15)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-l px-2 py-1 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
                <span className="bg-slate-800 border border-l-0 border-slate-700 px-2 py-1 text-[11px] text-slate-400 rounded-r">
                  cm
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Height:</span>
              <div className="mt-1 bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-400">
                {markerData.heightCm} cm
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
