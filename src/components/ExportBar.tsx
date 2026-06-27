import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../lib/store";
import { buildCsvMatrix } from "../lib/csv-build";

export function ExportBar() {
  const { grid, exportConfig, layout, csvFilename } = useStore();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const matrix = buildCsvMatrix(grid, exportConfig, layout);
      const rows = matrix.map((cells) => ({ cells }));

      const ext = format;
      const defaultName = csvFilename.trim()
        ? csvFilename.trim().replace(/\.(csv|xlsx)$/i, "") + "." + ext
        : `marufuda_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.${ext}`;
      const filePath = await save({
        defaultPath: defaultName,
        filters: format === "csv"
          ? [{ name: "CSV", extensions: ["csv"] }]
          : [{ name: "Excel", extensions: ["xlsx"] }],
      });

      if (!filePath || typeof filePath !== "string") {
        setMessage("キャンセルしました");
        setExporting(false);
        return;
      }

      const cmd = format === "csv" ? "export_csv" : "export_xlsx";
      const result = await invoke<string>(cmd, {
        request: {
          rows,
          encoding: exportConfig.encoding,
          path: filePath,
        },
      });

      setMessage(`出力完了: ${result}`);
    } catch (e) {
      setMessage(`エラー: ${e}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 bg-white">
      <button
        className="px-4 py-2 text-sm font-medium rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        disabled={exporting}
        onClick={handleExport}
      >
        {exporting ? "出力中..." : "出力実行"}
      </button>
      {/* フォーマット選択 */}
      <div className="flex items-center gap-1">
        <button
          className={`px-2 py-1 text-xs rounded border ${
            format === "csv"
              ? "bg-brand-50 border-brand-300 text-brand-700 font-medium"
              : "border-slate-300 text-slate-500 hover:bg-slate-50"
          }`}
          onClick={() => setFormat("csv")}
        >CSV</button>
        <button
          className={`px-2 py-1 text-xs rounded border ${
            format === "xlsx"
              ? "bg-brand-50 border-brand-300 text-brand-700 font-medium"
              : "border-slate-300 text-slate-500 hover:bg-slate-50"
          }`}
          onClick={() => setFormat("xlsx")}
        >Excel</button>
      </div>
      <span className="text-xs text-slate-500">
        {grid.cols * grid.rows} ラベル
        {format === "csv" && (
          <> /{" "}
          {exportConfig.encoding === "shift_jis"
            ? "Shift-JIS"
            : exportConfig.encoding === "utf8_bom"
            ? "UTF-8 BOM"
            : "UTF-8"}</>
        )}
      </span>
      {message && (
        <span
          className={`text-xs ml-auto ${
            message.startsWith("エラー")
              ? "text-red-600"
              : message === "キャンセルしました"
              ? "text-slate-500"
              : "text-green-600"
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
