import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../lib/store";
import { buildCsvMatrix } from "../lib/csv-build";
import { getLabelDisplayTexts } from "../lib/label-utils";

interface Props {
  onSaveConfirm?: (filename: string) => void;
}

export function ExportBar({ onSaveConfirm }: Props) {
  const { grid, exportConfig, layout, csvFilename } = useStore();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [templateMode, setTemplateMode] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      if (templateMode) {
        // --- alym (テンプレート) 出力 ---
        const defaultName = csvFilename.trim()
          ? csvFilename.trim().replace(/\.(csv|xlsx|alym)$/i, "") + ".alym"
          : `marufuda_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.alym`;
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: "ラベル屋さんテンプレート", extensions: ["alym"] }],
        });
        if (!filePath || typeof filePath !== "string") {
          setMessage("キャンセルしました");
          setExporting(false);
          return;
        }

        // グリッドデータをラベル行ごとに変換
        const labelRows: string[][] = [];
        for (let r = 0; r < grid.rows; r++) {
          for (let c = 0; c < grid.cols; c++) {
            const label = grid.labels[r]?.[c];
            if (label) {
              const displayTexts = getLabelDisplayTexts(label, layout);
              labelRows.push(displayTexts);
            }
          }
        }

        const result = await invoke<string>("export_alym", {
          request: {
            rows: labelRows,
            cols: grid.cols,
            rows_count: grid.rows,
            items_per_label: layout.itemsPerLabel,
            path: filePath,
          },
        });
        setMessage(`テンプレート出力完了: ${result}`);
      } else {
        // --- 従来の CSV / Excel 出力 ---
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
        if (onSaveConfirm) {
          const name = csvFilename.trim() || `marufuda_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
          onSaveConfirm(name);
        }
      }
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
      {/* テンプレートモード切替 */}
      <button
        className={`px-3 py-1.5 text-xs rounded border font-medium ${
          templateMode
            ? "bg-amber-50 border-amber-400 text-amber-700"
            : "border-slate-300 text-slate-500 hover:bg-slate-50"
        }`}
        onClick={() => setTemplateMode((v) => !v)}
        title="ラベル屋さんテンプレート(.alym)として出力"
      >
        テンプレ
      </button>
      {/* フォーマット選択（テンプレートモード時は非表示） */}
      {!templateMode && (
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
      )}
      <span className="text-xs text-slate-500">
        {grid.cols * grid.rows} ラベル
        {templateMode ? (
          <> / <span className="text-amber-600 font-medium">alymテンプレート</span></>
        ) : (
          format === "csv" && (
          <> /{" "}
          {exportConfig.encoding === "shift_jis"
            ? "Shift-JIS"
            : exportConfig.encoding === "utf8_bom"
            ? "UTF-8 BOM"
            : "UTF-8"}</>
          )
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
