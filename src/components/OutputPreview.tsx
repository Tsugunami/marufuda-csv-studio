import { useMemo } from "react";
import { useStore } from "../lib/store";
import { buildCsvMatrix, buildCsvText } from "../lib/csv-build";

export function OutputPreview() {
  const { grid, exportConfig, setExportConfig, layout } = useStore();

  const matrix = useMemo(
    () => buildCsvMatrix(grid, exportConfig, layout),
    [grid, exportConfig, layout]
  );
  const csvText = useMemo(() => buildCsvText(matrix), [matrix]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
      {/* ヘッダ */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <h3 className="text-sm font-bold text-slate-700">出力プレビュー</h3>
        <div className="ml-auto flex items-center gap-3">
          <select
            className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={exportConfig.encoding}
            onChange={(e) =>
              setExportConfig({
                encoding: e.target.value as
                  | "shift_jis"
                  | "utf8"
                  | "utf8_bom",
              })
            }
          >
            <option value="shift_jis">Shift-JIS</option>
            <option value="utf8_bom">UTF-8 (BOM)</option>
            <option value="utf8">UTF-8</option>
          </select>
        </div>
      </div>

      {/* プレビュー */}
      <div className="overflow-auto max-h-48 p-3">
        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap break-all">
          {csvText}
        </pre>
      </div>

      {/* フッタ */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 rounded-b-lg text-xs text-slate-500">
        {matrix.length} 行 / {matrix[0]?.length ?? 0} 列
      </div>
    </div>
  );
}
