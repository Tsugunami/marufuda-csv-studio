import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../lib/store";
import { getLabelDisplayTexts } from "../lib/label-utils";

interface Props {
  onSaveConfirm?: (filename: string) => void;
}

export function ExportBar({ onSaveConfirm }: Props) {
  const { grid, layout, csvFilename } = useStore();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
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
      setMessage(`出力完了: ${result}`);
      // 保存確認モーダル表示
      if (onSaveConfirm) {
        const name = csvFilename.trim() || `marufuda_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
        onSaveConfirm(name);
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
      <span className="text-xs text-slate-500">
        {grid.cols * grid.rows} ラベル / <span className="text-amber-600 font-medium">alymテンプレート</span>
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
