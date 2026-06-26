import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../lib/store";
import { buildCsvMatrix } from "../lib/csv-build";

export function ExportBar() {
  const { grid, exportConfig } = useStore();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const matrix = buildCsvMatrix(grid, exportConfig);
      const rows = matrix.map((cells) => ({ cells }));

      // 保存先を選択
      const defaultName = `marufuda_${new Date()
        .toISOString()
        .slice(0, 10).replace(/-/g, "")}.csv`;
      const filePath = await open({
        defaultPath: defaultName,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });

      if (!filePath || typeof filePath !== "string") {
        setMessage("キャンセルしました");
        setExporting(false);
        return;
      }

      const result = await invoke<string>("export_csv", {
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
        {exporting ? "出力中..." : "CSV出力実行"}
      </button>
      <span className="text-xs text-slate-500">
        {grid.cols * grid.rows} ラベル /{" "}
        {exportConfig.encoding === "shift_jis"
          ? "Shift-JIS"
          : exportConfig.encoding === "utf8_bom"
          ? "UTF-8 BOM"
          : "UTF-8"}
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
