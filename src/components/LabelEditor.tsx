import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";
import { isLabelUsed } from "../lib/label-utils";

export function LabelEditor() {
    const {
    grid,
    selectedRow,
    selectedCol,
    layout,
    updateLabelRow,
    toggleLabelDelimiter,
    reverseTo,
    reverseCopyToClipboard,
    copyTo,
    setLayout,
    clipboardMode,
    copyToClipboard,
    pasteFromClipboard,
    clearSelected,
    undo,
    presetTexts,
    addPresetText,
    deletePresetText,
    applyPresetTextToSelected,
  } = useStore();

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

            {/* 行数 / 接続詞 / 寄せ を1行3列にまとめ */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">行数</label>
            <input type="number" min={1} max={20}
              className="w-full border border-slate-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={layout.itemsPerLabel}
              onChange={(e) => setLayout({ itemsPerLabel: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">接続詞</label>
            <input type="text" maxLength={3}
              className="w-full border border-slate-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={layout.delimiter}
              onChange={(e) => setLayout({ delimiter: e.target.value })}
              placeholder="～"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">寄せ</label>
            <select
              className="w-full border border-slate-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
              value={layout.delimiterAlign}
              disabled={!isEven}
              onChange={(e) => setLayout({ delimiterAlign: e.target.value as "center" | "self" | "partner" })}
            >
              <option value="center">中央</option>
              <option value="self">自側</option>
              <option value="partner">相手側</option>
            </select>
          </div>
        </div>
        {!isEven && <p className="text-xs text-slate-400 mt-1">奇数行のため中央固定</p>}
        {/* 接続詞 ON/OFF */}
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-slate-600">このラベルの接続詞</label>
          <button
            className={`px-3 py-0.5 text-xs rounded font-medium ${
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

            {/* 行エディタ（最重要：スクロールなしで見える優先） */}
      <div className="flex-1 overflow-auto p-3 space-y-1.5">
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
                className={`flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 ${
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

      {/* プリセットラベル */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
        <p className="text-xs font-bold text-slate-700 mb-1">
          プリセットラベル
        </p>
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="追加するラベルテキスト（カンマ区切りで複数行）"
            id="preset-text-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const el = document.getElementById("preset-text-input") as HTMLInputElement;
                if (el && el.value.trim()) {
                  const texts = el.value.split(",").map((s) => s.trim());
                  addPresetText(texts);
                  el.value = "";
                }
              }
            }}
          />
          <button
            className="px-2 py-1 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 shrink-0"
            onClick={() => {
              const el = document.getElementById("preset-text-input") as HTMLInputElement;
              if (el && el.value.trim()) {
                const texts = el.value.split(",").map((s) => s.trim());
                addPresetText(texts);
                el.value = "";
              }
            }}
          >追加</button>
        </div>
        {presetTexts.length > 0 && (
          <div className="space-y-1 max-h-28 overflow-auto">
            {presetTexts.map((p) => (
              <div key={p.id} className="flex items-center gap-1 text-xs px-1 py-0.5 rounded hover:bg-slate-100">
                <span className="flex-1 truncate text-slate-600">{p.text.filter(t => t.trim()).join("／") || "(空)"}</span>
                <button
                  className="text-blue-500 hover:text-blue-700 shrink-0"
                  onClick={() => applyPresetTextToSelected(p.text)}
                  title="選択セルに適用"
                >適用</button>
                <button
                  className="text-red-500 hover:text-red-700 shrink-0"
                  onClick={() => deletePresetText(p.id)}
                  title="削除"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 反転コピー（十字型） */}
      <div className={`px-4 py-2 border-t border-slate-200 bg-slate-50 ${!hasDelimiter ? "opacity-40 pointer-events-none" : ""}`}>
        <p className="text-xs font-bold text-slate-700 mb-1">
          反転コピー（「{layout.delimiter || "～"}」を境に入れ替え）
        </p>
        <div className="flex flex-col items-center gap-0.5">
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
            <button
              className={`w-20 px-2 py-1.5 text-xs rounded text-white ${clipboardMode === "reverse" ? "bg-violet-600 hover:bg-violet-700" : "bg-brand-600 hover:bg-brand-700"}`}
              onClick={() => {
                if (clipboardMode === "reverse") {
                  pasteFromClipboard();
                } else {
                  reverseCopyToClipboard();
                }
              }}
            >{clipboardMode === "reverse" ? "貼付" : "反転コピー"}</button>
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
                {clipboardMode === "reverse" && (
          <p className="text-xs text-violet-600 mt-1 text-center">
                        ✓ セルを選択(Ctrl/Shift+クリックで複数)して「貼付」
          </p>
        )}
      </div>

      {/* 通常コピー（十字型 + クリップボード） */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
        <p className="text-xs font-bold text-slate-700 mb-1">
          通常コピー（そのまま複製）
        </p>
        <div className="flex flex-col items-center gap-0.5">
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
              className={`w-20 px-2 py-1.5 text-xs rounded text-white ${clipboardMode === "copy" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-500 hover:bg-orange-600"}`}
              onClick={() => {
                if (clipboardMode === "copy") {
                  pasteFromClipboard();
                } else {
                  copyToClipboard();
                }
              }}
            >{clipboardMode === "copy" ? "貼付" : "コピー"}</button>
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
                {clipboardMode === "copy" && (
          <p className="text-xs text-emerald-600 mt-1 text-center">
                        ✓ セルを選択(Ctrl/Shift+クリックで複数)して「貼付」
          </p>
        )}
      </div>

      {/* 操作ボタン */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 rounded-b-lg flex gap-2">
        <button
          className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-100 text-slate-600"
          onClick={undo}
          title="元に戻す (Ctrl+Z)"
        >↩ 元に戻す</button>
        <button
          className="flex-1 px-2 py-1.5 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
          onClick={clearSelected}
          title="選択セルをクリア (Del)"
        >🗑 クリア</button>
            </div>
    </div>
  );
}
