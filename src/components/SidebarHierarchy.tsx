import React from 'react';
import { Layers, Eye, EyeOff, Trash2, Box } from 'lucide-react';
import { ARObjectData } from '../types/webar';

interface SidebarHierarchyProps {
  objects: ARObjectData[];
  selectedObjectId: string | null;
  markerName: string;
  onSelectObject: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteObject: (id: string) => void;
}

export const SidebarHierarchy: React.FC<SidebarHierarchyProps> = ({
  objects,
  selectedObjectId,
  markerName,
  onSelectObject,
  onToggleVisibility,
  onDeleteObject
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          6. Scene Hierarchy
        </h2>
        <span className="text-[10px] font-mono text-slate-500">
          {objects.length} Items
        </span>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-xs text-slate-300 min-h-[200px]">
        {/* Root Scene */}
        <div className="flex items-center py-1 px-2 text-indigo-400 font-bold border-b border-slate-800/80">
          <Layers className="w-4 h-4 mr-2" />
          <span>Scene</span>
        </div>

        {/* Marker Root */}
        <div className="pl-2 pt-1.5">
          <div className="flex items-center py-1 px-2 text-emerald-400 font-medium">
            <span className="text-slate-600 mr-2">├──</span>
            <span>Marker ({markerName})</span>
          </div>

          {/* Children Objects */}
          <div className="pl-4 space-y-1 mt-1">
            {objects.length === 0 ? (
              <div className="text-[11px] text-slate-600 italic py-2">
                (ยังไม่มีวัตถุในระบบ)
              </div>
            ) : (
              objects.map((obj) => {
                const isSelected = selectedObjectId === obj.id;
                return (
                  <div
                    key={obj.id}
                    onClick={() => onSelectObject(obj.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs font-mono transition ${
                      isSelected
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0 pr-1">
                      <span className="text-slate-500 shrink-0">├──</span>
                      <Box className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{obj.name}</span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisibility(obj.id);
                        }}
                        title={obj.visible ? "ซ่อนวัตถุ" : "แสดงวัตถุ"}
                        className="p-1 text-slate-400 hover:text-white transition"
                      >
                        {obj.visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteObject(obj.id);
                        }}
                        title="ลบวัตถุ"
                        className="p-1 text-slate-400 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
