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
    reverseTo,
    setLayout,
    presets,
    applyPreset,
  } = useStore();

  const label = grid.labels[selectedRow]?.[selectedCol];

  if (!label) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        ラベルが選択されていません
      </div>
    );
  }

  const delimIdx = layout.delimiter
    ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
    : -1;
  const used = isLabelUsed(label, delimIdx);

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

      {/* ラベルサイズ + プリセット呼び出し */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 w-10">幅</label>
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
          <label className="text-xs text-slate-600 w-10">高さ</label>
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
        {/* プリセット呼び出し */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 whitespace-nowrap">サイズP</label>
          <select
            className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            value=""
            onChange={(e) => {
              if (e.target.value !== "") applyPreset(Number(e.target.value));
            }}
          >
            <option value="">-- サイズプリセット --</option>
            {presets.map((p, i) => (
              <option key={i} value={i}>
                {p.name} ({p.layout.labelSize.widthMm}×{p.layout.labelSize.heightMm}mm)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 行エディタ */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {label.rows.map((row, i) => {
          const isDelim = i === delimIdx;
          // デリミタ行は使用中ラベルのみ表示、未使用なら空
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

      {/* 反転ツールバー */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        <p className="text-xs font-medium text-slate-600 mb-2">
          反転コピー（「～」を境に入れ替え）
        </p>
        <div className="grid grid-cols-4 gap-2">
          <button
            className="px-2 py-2 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={selectedCol >= grid.cols - 1}
            onClick={() => reverseTo("right")}
            title="右隣へ反転"
          >
            → 右
          </button>
          <button
            className="px-2 py-2 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={selectedCol <= 0}
            onClick={() => reverseTo("left")}
            title="左隣へ反転"
          >
            ← 左
          </button>
          <button
            className="px-2 py-2 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={selectedRow <= 0}
            onClick={() => reverseTo("up")}
            title="上へ反転"
          >
            ↑ 上
          </button>
          <button
            className="px-2 py-2 text-xs rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            disabled={selectedRow >= grid.rows - 1}
            onClick={() => reverseTo("down")}
            title="下へ反転"
          >
            ↓ 下
          </button>
        </div>
        {!layout.delimiter && (
          <p className="text-xs text-amber-600 mt-2">
            ※ デリミタが未設定です。レイアウト設定で「～」等を指定してください。
          </p>
        )}
      </div>
    </div>
  );
}
