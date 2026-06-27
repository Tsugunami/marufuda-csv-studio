import { useState } from "react";
import { useStore } from "../lib/store";
import { DEFAULT_PRESETS } from "../lib/presets";
import { DEFAULT_SIZE_PRESETS } from "../lib/size-presets";

export function LayoutConfigPanel() {
  const {
    layout,
    setLayout,
    presets,
    applyPreset,
    addPreset,
    deletePreset,
    sizePresets,
    applySizePreset,
    addSizePreset,
    deleteSizePreset,
  } = useStore();
  const [newPresetName, setNewPresetName] = useState("");
  const [newSizePresetName, setNewSizePresetName] = useState("");

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
      <h2 className="text-sm font-bold text-slate-700 border-b pb-2">
        レイアウト設定
      </h2>

      {/* レイアウトプリセット */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          プリセット
        </label>
        <select
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value=""
          onChange={(e) => {
            if (e.target.value !== "") applyPreset(Number(e.target.value));
          }}
        >
          <option value="">-- プリセットを選択 --</option>
          {presets.map((p, i) => (
            <option key={i} value={i}>{p.name}</option>
          ))}
        </select>

        <div className="mt-2 space-y-1 max-h-32 overflow-auto">
          {presets.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-slate-50">
              <span className="flex-1 truncate text-slate-700">{p.name}</span>
              <button className="text-blue-500 hover:text-blue-700" onClick={() => applyPreset(i)} title="適用">適用</button>
              {i >= DEFAULT_PRESETS.length && (
                <button className="text-red-500 hover:text-red-700" onClick={() => deletePreset(i)} title="削除">✕</button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-1">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="新規プリセット名"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
          />
          <button
            className="px-2 py-1 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={!newPresetName.trim()}
            onClick={() => { addPreset(newPresetName.trim()); setNewPresetName(""); }}
          >追加</button>
        </div>
      </div>

      {/* ブロック構成 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ブロック列数</label>
          <input type="number" min={1} max={20}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.blockCols}
            onChange={(e) => setLayout({ blockCols: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ブロック行数</label>
          <input type="number" min={1} max={30}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.blockRows}
            onChange={(e) => setLayout({ blockRows: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>

      {/* ラベルサイズ */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">ラベルサイズ</label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">幅</label>
          <input
            type="number"
            min={1}
            step={0.1}
            className="w-16 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.labelSize.widthMm}
            onChange={(e) =>
              setLayout({
                labelSize: {
                  ...layout.labelSize,
                  widthMm: Math.max(1, Number(e.target.value) || 1),
                },
              })
            }
          />
          <span className="text-xs text-slate-500">mm</span>
          <span className="text-slate-300">×</span>
          <label className="text-xs text-slate-500">高さ</label>
          <input
            type="number"
            min={1}
            step={0.1}
            className="w-16 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.labelSize.heightMm}
            onChange={(e) =>
              setLayout({
                labelSize: {
                  ...layout.labelSize,
                  heightMm: Math.max(1, Number(e.target.value) || 1),
                },
              })
            }
          />
          <span className="text-xs text-slate-500">mm</span>
        </div>

        {/* サイズプリセット */}
        <div className="mt-2 space-y-1 max-h-24 overflow-auto">
          {sizePresets.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-slate-50">
              <span className="flex-1 truncate text-slate-700">{p.name}</span>
              <button className="text-blue-500 hover:text-blue-700" onClick={() => applySizePreset(i)} title="適用">適用</button>
              {i >= DEFAULT_SIZE_PRESETS.length && (
                <button className="text-red-500 hover:text-red-700" onClick={() => deleteSizePreset(i)} title="削除">✕</button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="サイズプリセット名"
            value={newSizePresetName}
            onChange={(e) => setNewSizePresetName(e.target.value)}
          />
          <button
            className="px-2 py-1 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={!newSizePresetName.trim()}
            onClick={() => { addSizePreset(newSizePresetName.trim()); setNewSizePresetName(""); }}
          >追加</button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-1">総ラベル数: {layout.blockCols * layout.blockRows} 面</p>
    </div>
  );
}
