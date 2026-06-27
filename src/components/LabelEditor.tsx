import { useState } from "react";
import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";
import { isLabelUsed } from "../lib/label-utils";
import { DEFAULT_PRESETS } from "../lib/presets";

export function LabelEditor() {
  const {
    grid,
    selectedRow,
    selectedCol,
    layout,
    updateLabelRow,
    toggleLabelDelimiter,
    reverseTo,
    copyTo,
    setLayout,
    presets,
    applyPreset,
    addPreset,
    deletePreset,
    clipboard,
    copyToClipboard,
    pasteFromClipboard,
  } = useStore();
  const [newPresetName, setNewPresetName] = useState("");

  const label = grid.labels[selectedRow]?.[selectedCol];

  if (!label) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        ラベルが選択されていません
      </div>
    );
  }

  const useDelim = label.useDelimiter ?? true;
  const hasDelimiter = !!layout.delimiter;
  const delimIdx = useDelim && hasDelimiter
    ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
    : -1;
  const used = isLabelUsed(label, delimIdx);
  const isEven = layout.itemsPerLabel % 2 === 0;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200">
      {/* ヘッダ */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <h3 className="text-sm font-bold text-slate-700">
          ラベル編集{" "}
          <span className="text-xs font-normal text-slate-500">
            （{selectedRow + 1}-{selectedCol + 1}）
          </span>
        </h3>
      </div>

      {/* 1行あたりの行数 + 接続詞 */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 whitespace-nowrap">1行あたりの行数</label>
          <input type="number" min={1} max={20}
            className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.itemsPerLabel}
            onChange={(e) => setLayout({ itemsPerLabel: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">接続詞</label>
          <input type="text" maxLength={3}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.delimiter}
            onChange={(e) => setLayout({ delimiter: e.target.value })}
            placeholder="～"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">接続詞の寄せ（偶数行時）</label>
          <select
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
            value={layout.delimiterAlign}
            disabled={!isEven}
            onChange={(e) => setLayout({ delimiterAlign: e.target.value as "center" | "self" | "partner" })}
          >
            <option value="center">中央（上側）</option>
            <option value="self">自分側に寄せる（上）</option>
            <option value="partner">相手側に寄せる（下）</option>
          </select>
          {!isEven && <p className="text-xs text-slate-400 mt-1">奇数行のため中央固定</p>}
        </div>
        {/* ラベルごとの接続詞トグル */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">このラベルの接続詞</label>
          <button
            className={`px-3 py-1 text-xs rounded font-medium ${
              useDelim
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                : "bg-slate-100 text-slate-500 border border-slate-300"
            }`}
            onClick={toggleLabelDelimiter}
          >
            {useDelim ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* 行エディタ */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {label.rows.map((row, i) => {
          const isDelim = i === delimIdx;
          const displayValue = isDelim
            ? used
              ? layout.delimiter
              : ""
            : row.text;
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`text-xs w-6 text-right ${
                  isDelim && used ? "text-red-500 font-bold" : "text-slate-400"
                }`}
              >
                {i + 1}
              </span>
              <input
                type="text"
                className={`flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                  isDelim && used
                    ? "border-red-300 bg-red-50 text-red-600 font-bold text-center focus:ring-red-300"
                    : "border-slate-300 focus:ring-brand-500"
                }`}
                value={displayValue}
                readOnly={isDelim && used}
                placeholder={`行 ${i + 1}`}
                onChange={(e) => updateLabelRow(i, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      {/* 反転コピー（十字型） */}
      <div className={`px-4 py-3 border-t border-slate-200 bg-slate-50 ${!hasDelimiter ? "opacity-40 pointer-events-none" : ""}`}>
        <p className="text-sm font-bold text-slate-700 mb-2">
          反転コピー（「{layout.delimiter || "～"}」を境に入れ替え）
        </p>
        <div className="flex flex-col items-center gap-1">
          <button
            className="w-20 px-2 py-1.5 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={selectedRow <= 0}
            onClick={() => reverseTo("up")}
          >↑ 上</button>
          <div className="flex gap-1">
            <button
              className="w-20 px-2 py-1.5 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
              disabled={selectedCol <= 0}
              onClick={() => reverseTo("left")}
            >← 左</button>
            <div className="w-20 px-2 py-1.5 text-xs rounded bg-slate-200 text-slate-400 text-center">
              反転
            </div>
            <button
              className="w-20 px-2 py-1.5 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
              disabled={selectedCol >= grid.cols - 1}
              onClick={() => reverseTo("right")}
            >右 →</button>
          </div>
          <button
            className="w-20 px-2 py-1.5 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={selectedRow >= grid.rows - 1}
            onClick={() => reverseTo("down")}
          >↓ 下</button>
        </div>
      </div>

      {/* 通常コピー（十字型 + クリップボード） */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
        <p className="text-sm font-bold text-slate-700 mb-2">
          通常コピー（そのまま複製）
        </p>
        <div className="flex flex-col items-center gap-1">
          <button
            className="w-20 px-2 py-1.5 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40"
            disabled={selectedRow <= 0}
            onClick={() => copyTo("up")}
          >↑ 上</button>
          <div className="flex gap-1">
            <button
              className="w-20 px-2 py-1.5 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40"
              disabled={selectedCol <= 0}
              onClick={() => copyTo("left")}
            >← 左</button>
            <button
              className={`w-20 px-2 py-1.5 text-xs rounded text-white ${clipboard ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-500 hover:bg-orange-600"}`}
              onClick={() => {
                if (clipboard) {
                  pasteFromClipboard();
                } else {
                  copyToClipboard();
                }
              }}
            >{clipboard ? "貼付" : "コピー"}</button>
            <button
              className="w-20 px-2 py-1.5 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40"
              disabled={selectedCol >= grid.cols - 1}
              onClick={() => copyTo("right")}
            >右 →</button>
          </div>
          <button
            className="w-20 px-2 py-1.5 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40"
            disabled={selectedRow >= grid.rows - 1}
            onClick={() => copyTo("down")}
          >↓ 下</button>
        </div>
        {clipboard && (
          <p className="text-xs text-emerald-600 mt-2 text-center">
            ✓ コピー済み — 全体ビューでセルを選択してから「貼付」ボタンを押してください
          </p>
        )}
      </div>

      {/* プリセット管理 */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        <p className="text-sm font-bold text-slate-700 mb-2">
          プリセット管理
        </p>
        <div className="space-y-1 max-h-24 overflow-auto mb-2">
          {presets.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-slate-100">
              <span className="flex-1 truncate text-slate-700">{p.name}</span>
              <button className="text-blue-500 hover:text-blue-700" onClick={() => applyPreset(i)} title="適用">適用</button>
              {i >= DEFAULT_PRESETS.length && (
                <button className="text-red-500 hover:text-red-700" onClick={() => deletePreset(i)} title="削除">✕</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
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
    </div>
  );
}
