import { useState, useRef } from "react";
import { LayoutConfigPanel } from "./components/LayoutConfigPanel";
import { OverviewCanvas } from "./components/OverviewCanvas";
import { LabelEditor } from "./components/LabelEditor";
import { ExportBar } from "./components/ExportBar";
import { useStore } from "./lib/store";
import type { LayoutConfig } from "./lib/types";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

interface CsvImportModalData {
  filename: string;
  csvBlockCols: number;
  csvBlockRows: number;
  csvItemsPerLabel: number;
  csvTotalLabels: number;
  currentBlockCols: number;
  currentBlockRows: number;
  currentItemsPerLabel: number;
  currentTotalLabels: number;
  matchingPresetIndex: number;
  csvRows: string[][];
  csvHasHeader: boolean;
}

export default function App() {
  const {
    getProjectData,
    loadProjectData,
    layout,
    presets,
    hasExistingData,
    importCsvData,
    setCsvFilename,
    csvFilename,
    applyPreset,
  } = useStore();
  const [statusMsg, setStatusMsg] = useState("");
  const [importModal, setImportModal] = useState<CsvImportModalData | null>(null);
  const [overwriteModal, setOverwriteModal] = useState<{
    filename: string;
    csvRows: string[][];
    csvHasHeader: boolean;
    newLayout?: LayoutConfig;
  } | null>(null);
  const pendingImportRef = useRef<{
    csvRows: string[][];
    csvHasHeader: boolean;
    newLayout?: LayoutConfig;
    filename: string;
  } | null>(null);

  const handleSaveProject = async () => {
    try {
      const data = getProjectData();
      const json = JSON.stringify(data, null, 2);
      const filePath = await save({
        defaultPath: `marufuda_project_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`,
        filters: [{ name: "Project JSON", extensions: ["json"] }],
      });
      if (!filePath || typeof filePath !== "string") {
        setStatusMsg("保存をキャンセルしました");
        return;
      }
      await writeTextFile(filePath, json);
      setStatusMsg(`プロジェクト保存完了: ${filePath}`);
    } catch (e) {
      setStatusMsg(`保存エラー: ${e}`);
    }
  };

  const handleLoadProject = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "Project JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!filePath || typeof filePath !== "string") {
        setStatusMsg("読み込みをキャンセルしました");
        return;
      }
      const json = await readTextFile(filePath);
      const data = JSON.parse(json);
      loadProjectData(data);
      setStatusMsg(`プロジェクト読み込み完了: ${filePath}`);
    } catch (e) {
      setStatusMsg(`読み込みエラー: ${e}`);
    }
  };

  const handleImportCsv = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        multiple: false,
      });
      if (!filePath || typeof filePath !== "string") {
        setStatusMsg("CSV読込をキャンセルしました");
        return;
      }

      const result = await invoke<{ rows: string[][]; has_header: boolean }>("import_csv", { path: filePath });
      const { rows, has_header } = result;
      if (!rows || rows.length === 0) {
        setStatusMsg("CSVファイルが空です");
        return;
      }

      // ファイル名を抽出（パスから）
      const filename = filePath.split(/[/\\]/).pop() || filePath;
      const baseName = filename.replace(/\.csv$/i, "");

      // CSVのデータ行数と列数
      const dataRows = has_header ? rows.slice(1) : rows;
      const csvCols = rows[0]?.length || 0;
      const csvTotalLabels = dataRows.length;
      const csvItemsPerLabel = csvCols;

      // 現在のグリッド情報
      const currentTotalLabels = layout.blockCols * layout.blockRows;
      const currentItemsPerLabel = layout.itemsPerLabel;

      // マッチするプリセットを検索
      let matchingPresetIndex = -1;
      for (let i = 0; i < presets.length; i++) {
        const p = presets[i];
        if (
          p.layout.blockCols * p.layout.blockRows === csvTotalLabels &&
          p.layout.itemsPerLabel === csvItemsPerLabel
        ) {
          matchingPresetIndex = i;
          break;
        }
      }

      // 現在のレイアウトが一致するか
      const currentMatches =
        currentTotalLabels === csvTotalLabels && currentItemsPerLabel === csvItemsPerLabel;

      if (currentMatches) {
        // 現在のレイアウトでそのまま読み込み可能
        // ファイル名を自動設定
        setCsvFilename(baseName);
        // 既存データの上書き確認
        if (hasExistingData()) {
          setOverwriteModal({
            filename: baseName,
            csvRows: rows,
            csvHasHeader: has_header,
            newLayout: undefined,
          });
        } else {
          const ok = importCsvData(rows, has_header);
          if (ok) {
            setStatusMsg(`CSV読込完了: ${filename}`);
          } else {
            setStatusMsg("CSV読込エラー: データ構造が一致しません");
          }
        }
      } else {
        // 次元が合わない → モーダル表示
        let csvBlockCols = 0;
        let csvBlockRows = 0;
        if (matchingPresetIndex >= 0) {
          csvBlockCols = presets[matchingPresetIndex].layout.blockCols;
          csvBlockRows = presets[matchingPresetIndex].layout.blockRows;
        } else {
          // プリセットが見つからない場合は総数のみ表示
          csvBlockCols = 0;
          csvBlockRows = 0;
        }
        setImportModal({
          filename: baseName,
          csvBlockCols,
          csvBlockRows,
          csvItemsPerLabel,
          csvTotalLabels,
          currentBlockCols: layout.blockCols,
          currentBlockRows: layout.blockRows,
          currentItemsPerLabel: layout.itemsPerLabel,
          currentTotalLabels,
          matchingPresetIndex,
          csvRows: rows,
          csvHasHeader: has_header,
        });
      }
    } catch (e) {
      setStatusMsg(`CSV読込エラー: ${e}`);
    }
  };

  const executeImport = (
    csvRows: string[][],
    csvHasHeader: boolean,
    newLayout: LayoutConfig | undefined,
    filename: string
  ) => {
    const ok = importCsvData(csvRows, csvHasHeader, newLayout);
    if (ok) {
      setCsvFilename(filename);
      setStatusMsg(`CSV読込完了: ${filename}.csv`);
    } else {
      setStatusMsg("CSV読込エラー: データ構造が一致しません");
    }
  };

  const handleImportModalYes = () => {
    if (!importModal) return;
    const { csvRows, csvHasHeader, matchingPresetIndex, filename } = importModal;

    if (matchingPresetIndex >= 0) {
      // プリセットを切り替えてから読み込み
      const preset = presets[matchingPresetIndex];
      applyPreset(matchingPresetIndex);
      // 既存データの上書き確認
      if (hasExistingData()) {
        pendingImportRef.current = {
          csvRows,
          csvHasHeader,
          newLayout: { ...preset.layout },
          filename,
        };
        setImportModal(null);
        setOverwriteModal({
          filename,
          csvRows,
          csvHasHeader,
          newLayout: { ...preset.layout },
        });
      } else {
        executeImport(csvRows, csvHasHeader, { ...preset.layout }, filename);
        setImportModal(null);
      }
    } else {
      setStatusMsg("一致するプリセットが見つかりません。手動でレイアウトを変更してください。");
      setImportModal(null);
    }
  };

  const handleOverwriteYes = () => {
    if (!overwriteModal) return;
    const { csvRows, csvHasHeader, newLayout, filename } = overwriteModal;
    executeImport(csvRows, csvHasHeader, newLayout, filename);
    setOverwriteModal(null);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <header className="flex items-center px-4 py-2 bg-slate-800 text-white">
        <h1 className="text-base font-bold">丸札CSVスタジオ</h1>
        <span className="ml-2 text-xs text-slate-400">
          A-ONE ラベル屋さん™ 差し込み印刷用 CSV 作成ツール
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={handleImportCsv}
            title="CSVを読み込む"
          >📥 CSV読込</button>
          <button
            className="px-3 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white"
            onClick={handleSaveProject}
            title="プロジェクトを保存"
          >💾 保存</button>
          <button
            className="px-3 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white"
            onClick={handleLoadProject}
            title="プロジェクトを開く"
          >📂 開く</button>
        </div>
      </header>

      {/* メイン */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左サイドバー: 設定 */}
        <aside className="w-64 shrink-0 overflow-auto p-3 bg-slate-100 border-r border-slate-200">
          <LayoutConfigPanel />
        </aside>

        {/* 中央: 全体ビュー */}
        <main className="flex-1 p-3 overflow-hidden">
          <OverviewCanvas />
        </main>

        {/* 右サイドバー: ラベル編集 */}
        <aside className="w-80 shrink-0 p-3 overflow-auto bg-slate-100 border-l border-slate-200">
          <LabelEditor />
        </aside>
      </div>

      {/* 下部: エクスポート */}
      <footer className="shrink-0 border-t border-slate-200">
        <ExportBar />
        {statusMsg && (
          <div className="px-4 py-1 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
            {statusMsg}
          </div>
        )}
      </footer>

      {/* CSV読込 次元不一致モーダル */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">CSV読込 — レイアウト確認</h3>
            <div className="text-xs text-slate-600 space-y-2 mb-4">
              <p>読み込みファイル名：<strong>{importModal.filename}</strong></p>
              <div className="border border-slate-200 rounded p-3 space-y-1">
                <p className="font-medium text-slate-700">CSVの構成</p>
                {importModal.matchingPresetIndex >= 0 ? (
                  <>
                    <p>シートブロック列数：{importModal.csvBlockCols}列</p>
                    <p>シートブロック行数：{importModal.csvBlockRows}行</p>
                    <p>ラベル内行数：{importModal.csvItemsPerLabel}行</p>
                    <p>総ラベル数：{importModal.csvTotalLabels}面</p>
                  </>
                ) : (
                  <>
                    <p>ラベル内行数：{importModal.csvItemsPerLabel}行</p>
                    <p>総ラベル数：{importModal.csvTotalLabels}面</p>
                    <p className="text-red-600">一致するプリセットが見つかりません</p>
                  </>
                )}
              </div>
              <div className="border border-slate-200 rounded p-3 space-y-1">
                <p className="font-medium text-slate-700">現在のプリセット</p>
                <p>{importModal.currentBlockCols}×{importModal.currentBlockRows}　{importModal.currentTotalLabels}面</p>
                <p>ラベル内行数：{importModal.currentItemsPerLabel}行</p>
              </div>
              {importModal.matchingPresetIndex >= 0 && (
                <p className="text-slate-700">
                  構成が違うのでプリセット「{presets[importModal.matchingPresetIndex].name}」に切り替えて読み込みますか？
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setImportModal(null)}
              >いいえ</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40"
                disabled={importModal.matchingPresetIndex < 0}
                onClick={handleImportModalYes}
              >はい</button>
            </div>
          </div>
        </div>
      )}

      {/* 上書き確認モーダル */}
      {overwriteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">上書き確認</h3>
            <p className="text-xs text-slate-600 mb-4">
              既存の入力データが上書きされます。よろしいですか？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setOverwriteModal(null)}
              >いいえ</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                onClick={handleOverwriteYes}
              >はい（上書き）</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
