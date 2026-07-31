import React from 'react';
import { Film, Play, Repeat, Settings } from 'lucide-react';
import { SequenceData } from '../types/webar';

interface SidebarSequenceProps {
  sequenceData: SequenceData;
  onSequenceUpload: (files: FileList) => void;
  onUpdateSequence: (data: Partial<SequenceData>) => void;
}

export const SidebarSequence: React.FC<SidebarSequenceProps> = ({
  sequenceData,
  onSequenceUpload,
  onUpdateSequence
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
        4. Image Sequence Editor
      </h2>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
        <label className="block text-xs text-slate-400 font-medium">
          นำเข้าไฟล์เฟรมต่อเนื่อง (0001.png, 0002.png...)
        </label>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png, image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onSequenceUpload(e.target.files);
            }
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition"
        >
          <Film className="w-4 h-4" />
          <span>เลือกหลายรูป (Multiple PNGs)</span>
        </button>

        {sequenceData.files.length > 0 && (
          <div className="space-y-3 border-t border-slate-800 pt-3">
            <div className="text-xs text-slate-300 font-medium">
              จำนวนเฟรม: <span className="text-indigo-400 font-mono">{sequenceData.files.length} รูป</span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>FPS (ความเร็วเฟรม):</span>
                <span className="font-mono text-indigo-400">{sequenceData.fps}</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={sequenceData.fps}
                onChange={(e) => onUpdateSequence({ fps: parseInt(e.target.value) || 24 })}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">รูปแบบการเล่น:</label>
              <select
                value={sequenceData.mode}
                onChange={(e) => onUpdateSequence({ mode: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="loop">Loop (เล่นวนลูป)</option>
                <option value="pingpong">Ping Pong (ย้อนกลับ-ไปมา)</option>
                <option value="once">Play Once (เล่นครั้งเดียว)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
