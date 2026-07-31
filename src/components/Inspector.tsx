import React from 'react';
import { Eye, Trash2, Sliders, Palette, Lightbulb, Play, Scissors } from 'lucide-react';
import { ARObjectData } from '../types/webar';

interface InspectorProps {
  selectedObject: ARObjectData | null;
  onUpdateObject: (updated: Partial<ARObjectData>) => void;
  onDeleteObject: (id: string) => void;
  onChangeAnimation?: (animIndex: number) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedObject,
  onUpdateObject,
  onDeleteObject,
  onChangeAnimation
}) => {
  if (!selectedObject) {
    return (
      <div className="p-4 text-center text-slate-500 text-xs">
        <Sliders className="w-8 h-8 mx-auto mb-2 text-slate-700" />
        คลิกเลือกวัตถุใน Hierarchy หรือใน 3D Viewport เพื่อปรับแต่งคุณสมบัติ
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3.5">
      {/* Object Header */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400 font-medium block">
          ชื่อวัตถุ (Name):
        </label>
        <input
          type="text"
          value={selectedObject.name}
          onChange={(e) => onUpdateObject({ name: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
        />

        <div className="flex items-center space-x-4 pt-1 text-xs text-slate-300">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedObject.visible}
              onChange={(e) => onUpdateObject({ visible: e.target.checked })}
              className="accent-indigo-500 rounded"
            />
            <span>แสดงผล (Visible)</span>
          </label>
        </div>
      </div>

      {/* Transform Settings */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
        <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1">
          Transform (ตำแหน่ง / หมุน / ขนาด)
        </span>

        {/* Position */}
        <div>
          <span className="text-[10px] text-slate-400 block mb-1">Position (X, Y, Z เมตร):</span>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <input
              type="number"
              step="0.05"
              value={selectedObject.position[0]}
              onChange={(e) =>
                onUpdateObject({
                  position: [
                    parseFloat(e.target.value) || 0,
                    selectedObject.position[1],
                    selectedObject.position[2]
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-red-400 text-center focus:outline-none focus:border-red-500"
            />
            <input
              type="number"
              step="0.05"
              value={selectedObject.position[1]}
              onChange={(e) =>
                onUpdateObject({
                  position: [
                    selectedObject.position[0],
                    parseFloat(e.target.value) || 0,
                    selectedObject.position[2]
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-emerald-400 text-center focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              step="0.05"
              value={selectedObject.position[2]}
              onChange={(e) =>
                onUpdateObject({
                  position: [
                    selectedObject.position[0],
                    selectedObject.position[1],
                    parseFloat(e.target.value) || 0
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-sky-400 text-center focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <span className="text-[10px] text-slate-400 block mb-1">Rotation (X, Y, Z องศา):</span>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <input
              type="number"
              step="5"
              value={Math.round(selectedObject.rotation[0])}
              onChange={(e) =>
                onUpdateObject({
                  rotation: [
                    parseFloat(e.target.value) || 0,
                    selectedObject.rotation[1],
                    selectedObject.rotation[2]
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-red-400 text-center focus:outline-none focus:border-red-500"
            />
            <input
              type="number"
              step="5"
              value={Math.round(selectedObject.rotation[1])}
              onChange={(e) =>
                onUpdateObject({
                  rotation: [
                    selectedObject.rotation[0],
                    parseFloat(e.target.value) || 0,
                    selectedObject.rotation[2]
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-emerald-400 text-center focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              step="5"
              value={Math.round(selectedObject.rotation[2])}
              onChange={(e) =>
                onUpdateObject({
                  rotation: [
                    selectedObject.rotation[0],
                    selectedObject.rotation[1],
                    parseFloat(e.target.value) || 0
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-sky-400 text-center focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Scale */}
        <div>
          <span className="text-[10px] text-slate-400 block mb-1">Scale (X, Y, Z):</span>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <input
              type="number"
              step="0.1"
              value={selectedObject.scale[0]}
              onChange={(e) =>
                onUpdateObject({
                  scale: [
                    parseFloat(e.target.value) || 0.1,
                    selectedObject.scale[1],
                    selectedObject.scale[2]
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-red-400 text-center focus:outline-none focus:border-red-500"
            />
            <input
              type="number"
              step="0.1"
              value={selectedObject.scale[1]}
              onChange={(e) =>
                onUpdateObject({
                  scale: [
                    selectedObject.scale[0],
                    parseFloat(e.target.value) || 0.1,
                    selectedObject.scale[2]
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-emerald-400 text-center focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              step="0.1"
              value={selectedObject.scale[2]}
              onChange={(e) =>
                onUpdateObject({
                  scale: [
                    selectedObject.scale[0],
                    selectedObject.scale[1],
                    parseFloat(e.target.value) || 0.1
                  ]
                })
              }
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-sky-400 text-center focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Material Section */}
      {selectedObject.type !== 'light' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            Material & Visuals
          </span>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Color / Tint:</span>
            <input
              type="color"
              value={selectedObject.colorHex || '#6366f1'}
              onChange={(e) => onUpdateObject({ colorHex: e.target.value })}
              className="w-8 h-6 bg-transparent cursor-pointer rounded border border-slate-700"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Opacity (โปร่งแสง):</span>
              <span className="font-mono text-indigo-400">
                {(selectedObject.opacity ?? 1.0).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedObject.opacity ?? 1.0}
              onChange={(e) => onUpdateObject({ opacity: parseFloat(e.target.value) || 1.0 })}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Chroma Key / Green Screen (Artivive Style Video Transparency) */}
          {(selectedObject.type === 'video' || selectedObject.type === 'plane' || selectedObject.type === 'sequence') && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selectedObject.chromaKeyEnabled}
                    onChange={(e) => onUpdateObject({ chromaKeyEnabled: e.target.checked })}
                    className="accent-emerald-500 rounded"
                  />
                  <span className="text-xs text-emerald-400 font-medium">
                    Scissors / Chroma Key (เจาะฉากหลัง/ฉากเขียว)
                  </span>
                </label>
              </div>

              {selectedObject.chromaKeyEnabled && (
                <div className="pl-5 space-y-2 text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Key Color (สีที่ต้องการเจาะออก):</span>
                    <input
                      type="color"
                      value={selectedObject.chromaKeyColor || '#00ff00'}
                      onChange={(e) => onUpdateObject({ chromaKeyColor: e.target.value })}
                      className="w-7 h-5 bg-transparent cursor-pointer rounded border border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Similarity (ความเหมือนของสี):</span>
                      <span className="font-mono text-emerald-400">
                        {(selectedObject.chromaKeySimilarity ?? 0.4).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.02"
                      value={selectedObject.chromaKeySimilarity ?? 0.4}
                      onChange={(e) => onUpdateObject({ chromaKeySimilarity: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Light Settings */}
      {selectedObject.type === 'light' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            Light Properties
          </span>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Intensity (ความสว่าง):</span>
              <span className="font-mono text-amber-400">
                {(selectedObject.intensity || 2.0).toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={selectedObject.intensity || 2.0}
              onChange={(e) => onUpdateObject({ intensity: parseFloat(e.target.value) || 2.0 })}
              className="w-full accent-amber-500"
            />
          </div>
        </div>
      )}

      {/* Animation Clips (GLB) */}
      {selectedObject.type === 'glb' && selectedObject.animations && selectedObject.animations.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            Animation Clips ({selectedObject.animations.length})
          </span>
          <label className="text-[10px] text-slate-400 block">เลือกการเคลื่อนไหว:</label>
          <select
            value={selectedObject.activeAnimIndex || 0}
            onChange={(e) => onChangeAnimation?.(parseInt(e.target.value) || 0)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
          >
            {selectedObject.animations.map((clip, index) => (
              <option key={index} value={index}>
                {clip.name || `Clip ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Delete Object Button */}
      <button
        onClick={() => onDeleteObject(selectedObject.id)}
        className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 text-xs font-medium rounded-lg flex items-center justify-center space-x-1.5 transition"
      >
        <Trash2 className="w-4 h-4" />
        <span>ลบวัตถุนี้ (Delete Object)</span>
      </button>
    </div>
  );
};
