import { useState, useMemo } from "react";
import { useStore } from "../lib/store";

export function LayoutConfigPanel() {
  const {
    layout,
    setLayout,
    presets,
    applyPreset,
    addPreset,
    deletePreset,
    overwritePreset,
    reorderPresets,
    resetPresets,
    sizePresets,
    applySizePreset,
    addSizePreset,
    deleteSizePreset,
    resetSizePresets,
    csvFilename,
    setCsvFilename,
    hasExistingData,
  } = useStore();
  const [newPresetName, setNewPresetName] = useState("");
  const [newSizePresetName, setNewSizePresetName] = useState("");

  // 確認モーダル状態
  const [confirmApplyModal, setConfirmApplyModal] = useState<{
    presetIndex: number;
  } | null>(null);
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<number | null>(null);
  const [confirmDeleteSizePreset, setConfirmDeleteSizePreset] = useState<number | null>(null);

  // 現在のレイアウトにマッチするプリセットを検出
  const currentPresetIndex = useMemo(() => {
    for (let i = 0; i < presets.length; i++) {
      const p = presets[i].layout;
      if (
        p.blockCols === layout.blockCols &&
        p.blockRows === layout.blockRows &&
        p.itemsPerLabel === layout.itemsPerLabel &&
        p.labelSize.widthMm === layout.labelSize.widthMm &&
        p.labelSize.heightMm === layout.labelSize.heightMm
      ) {
        return i;
      }
    }
    return -1; // 未設定
  }, [layout.blockCols, layout.blockRows, layout.itemsPerLabel, layout.labelSize.widthMm, layout.labelSize.heightMm, presets]);

  const handleSelectPreset = (value: string) => {
    if (value === "") return;
    const idx = Number(value);
    if (hasExistingData()) {
      setConfirmApplyModal({ presetIndex: idx });
    } else {
      applyPreset(idx);
    }
  };

  const handleConfirmApply = () => {
    if (!confirmApplyModal) return;
    applyPreset(confirmApplyModal.presetIndex);
    setConfirmApplyModal(null);
  };

  const handleDeletePreset = (index: number) => {
    setConfirmDeletePreset(index);
  };

  const handleConfirmDeletePreset = () => {
    if (confirmDeletePreset === null) return;
    deletePreset(confirmDeletePreset);
    setConfirmDeletePreset(null);
  };

  const handleDeleteSizePreset = (index: number) => {
    setConfirmDeleteSizePreset(index);
  };

  const handleConfirmDeleteSizePreset = () => {
    if (confirmDeleteSizePreset === null) return;
    deleteSizePreset(confirmDeleteSizePreset);
    setConfirmDeleteSizePreset(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
      <h2 className="text-sm font-bold text-slate-700 border-b pb-2">
        レイアウト設定
      </h2>

      {/* ファイル名 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          ファイル名（CSV出力時のデフォルト）
        </label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="ファイル名を入力"
            value={csvFilename}
            onChange={(e) => setCsvFilename(e.target.value)}
          />
        </div>
      </div>

      {/* レイアウトプリセット */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          プリセット
        </label>
        <select
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={currentPresetIndex >= 0 ? currentPresetIndex : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") return;
            handleSelectPreset(val);
          }}
        >
          <option value="">-- 未設定 --</option>
          {presets.map((p, i) => (
            <option key={i} value={i}>{p.name}</option>
          ))}
        </select>

        <div className="mt-2 space-y-1">
          {presets.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-slate-50">
              <span className="flex-1 truncate text-slate-700">{p.name}</span>
              <button className="text-slate-400 hover:text-brand-600 disabled:opacity-20" disabled={i === 0} onClick={() => reorderPresets(i, i - 1)} title="上へ">▲</button>
              <button className="text-slate-400 hover:text-brand-600 disabled:opacity-20" disabled={i === presets.length - 1} onClick={() => reorderPresets(i, i + 1)} title="下へ">▼</button>
              <button className="text-blue-500 hover:text-blue-700" onClick={() => {
                if (hasExistingData()) {
                  setConfirmApplyModal({ presetIndex: i });
                } else {
                  applyPreset(i);
                }
              }} title="適用">適用</button>
              <button className="text-amber-600 hover:text-amber-800" onClick={() => overwritePreset(i)} title="現在の設定で上書き保存">上書き</button>
              <button className="text-red-500 hover:text-red-700" onClick={() => handleDeletePreset(i)} title="削除">✕</button>
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
          <button
            className="px-2 py-1 text-xs rounded bg-slate-300 hover:bg-slate-400 text-slate-700"
            onClick={resetPresets}
            title="デフォルトに戻す"
          >戻す</button>
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">幅</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                step={0.1}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
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
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">高さ</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                step={0.1}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          </div>
        </div>

        {/* サイズプリセット */}
        <div className="mt-2 space-y-1">
          {sizePresets.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-slate-50">
              <span className="flex-1 truncate text-slate-700">{p.name}</span>
              <button className="text-blue-500 hover:text-blue-700" onClick={() => applySizePreset(i)} title="適用">適用</button>
              <button className="text-red-500 hover:text-red-700" onClick={() => handleDeleteSizePreset(i)} title="削除">✕</button>
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
          <button
            className="px-2 py-1 text-xs rounded bg-slate-300 hover:bg-slate-400 text-slate-700"
            onClick={resetSizePresets}
            title="デフォルトに戻す"
          >戻す</button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-1">総ラベル数: {layout.blockCols * layout.blockRows} 面</p>

      {/* プリセット適用確認モーダル */}
      {confirmApplyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">プリセット適用確認</h3>
            <p className="text-xs text-slate-600 mb-4">
              現在入力中のデータがクリアされます。
              プリセットを適用してもよろしいですか？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setConfirmApplyModal(null)}
              >キャンセル</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white"
                onClick={handleConfirmApply}
              >適用</button>
            </div>
          </div>
        </div>
      )}

      {/* プリセット削除確認モーダル */}
      {confirmDeletePreset !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">プリセット削除確認</h3>
            <p className="text-xs text-slate-600 mb-4">
              プリセット「{presets[confirmDeletePreset]?.name}」を削除します。よろしいですか？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setConfirmDeletePreset(null)}
              >キャンセル</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmDeletePreset}
              >削除</button>
            </div>
          </div>
        </div>
      )}

      {/* サイズプリセット削除確認モーダル */}
      {confirmDeleteSizePreset !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">サイズプリセット削除確認</h3>
            <p className="text-xs text-slate-600 mb-4">
              サイズプリセット「{sizePresets[confirmDeleteSizePreset]?.name}」を削除します。よろしいですか？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setConfirmDeleteSizePreset(null)}
              >キャンセル</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmDeleteSizePreset}
              >削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
