import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";

export function LabelEditor() {
  const { grid, selectedRow, selectedCol, layout, updateLabelRow, reverseTo } =
    useStore();

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

      {/* 行エディタ */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {label.rows.map((row, i) => {
          const isDelim = i === delimIdx;
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`text-xs w-6 text-right ${
                  isDelim ? "text-red-500 font-bold" : "text-slate-400"
                }`}
              >
                {i + 1}
              </span>
              <input
                type="text"
                className={`flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                  isDelim
                    ? "border-red-300 bg-red-50 text-red-600 font-bold text-center focus:ring-red-300"
                    : "border-slate-300 focus:ring-brand-500"
                }`}
                value={isDelim ? layout.delimiter : row.text}
                readOnly={isDelim}
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
