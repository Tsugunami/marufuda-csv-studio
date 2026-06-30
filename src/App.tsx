import { useState } from "react";
import { LayoutConfigPanel } from "./components/LayoutConfigPanel";
import { OverviewCanvas } from "./components/OverviewCanvas";
import { LabelEditor } from "./components/LabelEditor";
import { ExportBar } from "./components/ExportBar";
import { useStore } from "./lib/store";
import type { LayoutConfig } from "./lib/types";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

interface ImportModalData {
  filename: string;
  csvTotalLabels: number;
  csvItemsPerLabel: number;
  csvBlockCols: number;
  csvBlockRows: number;
  currentBlockCols: number;
  currentBlockRows: number;
  currentItemsPerLabel: number;
  currentTotalLabels: number;
  // 0=完全一致(通さない), 1=プリセット完全一致, 2=ブロック数一致のみ(行数違い)
  matchType: 0 | 1 | 2;
  matchingPresetName: string;
  csvRows: string[][];
  csvHasHeader: boolean;
  newLayout: LayoutConfig;
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
    applyPreset,
  } = useStore();
  const [statusMsg, setStatusMsg] = useState("");
  const [importModal, setImportModal] = useState<ImportModalData | null>(null);
  const [overwriteModal, setOverwriteModal] = useState<{
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

  const doImport = (
    csvRows: string[][],
    csvHasHeader: boolean,
    newLayout: LayoutConfig | undefined,
    filename: string
  ) => {
    const ok = importCsvData(csvRows, csvHasHeader, newLayout);
    if (ok) {
    setCsvFilename(filename);
    setStatusMsg(`読込完了: ${filename}`);
    } else {
      setStatusMsg("CSV読込エラー: データ構造が一致しません");
    }
  };

  const handleImportCsv = async () => {
    try {
      const filePath = await open({
        filters: [
          { name: "CSV / Excel", extensions: ["csv", "xlsx"] },
          { name: "CSV", extensions: ["csv"] },
          { name: "Excel", extensions: ["xlsx"] },
        ],
        multiple: false,
      });
      if (!filePath || typeof filePath !== "string") {
        setStatusMsg("読込をキャンセルしました");
        return;
      }

      const isXlsx = /\.xlsx$/i.test(filePath);
      const cmd = isXlsx ? "import_xlsx" : "import_csv";
      const result = await invoke<{ rows: string[][]; has_header: boolean }>(cmd, { path: filePath });
      const { rows, has_header } = result;
      if (!rows || rows.length === 0) {
        setStatusMsg("ファイルが空です");
        return;
      }

      const filename = filePath.split(/[/\\]/).pop() || filePath;
      const baseName = filename.replace(/\.(csv|xlsx)$/i, "");

      const dataRows = has_header ? rows.slice(1) : rows;
      const csvItemsPerLabel = rows[0]?.length || 0;
      const csvTotalLabels = dataRows.length;

      const currentTotalLabels = layout.blockCols * layout.blockRows;
      const currentItemsPerLabel = layout.itemsPerLabel;

      // 完全一致チェック
      if (
        currentTotalLabels === csvTotalLabels &&
        currentItemsPerLabel === csvItemsPerLabel
      ) {
        // 現在のレイアウトでそのまま読込
        setCsvFilename(baseName);
        if (hasExistingData()) {
          setOverwriteModal({
            filename: baseName,
            csvRows: rows,
            csvHasHeader: has_header,
            newLayout: undefined,
          });
        } else {
          doImport(rows, has_header, undefined, baseName);
        }
        return;
      }

      // プリセットから完全一致を検索
      let matchType: 0 | 1 | 2 = 0;
      let matchingPresetName = "";
      let csvBlockCols = 0;
      let csvBlockRows = 0;
      let newLayout: LayoutConfig = { ...layout };

      for (let i = 0; i < presets.length; i++) {
        const p = presets[i];
        if (
          p.layout.blockCols * p.layout.blockRows === csvTotalLabels &&
          p.layout.itemsPerLabel === csvItemsPerLabel
        ) {
          matchType = 1;
          matchingPresetName = p.name;
          csvBlockCols = p.layout.blockCols;
          csvBlockRows = p.layout.blockRows;
          newLayout = { ...p.layout };
          break;
        }
      }

      // プリセット完全一致がなければ、ブロック数のみ一致するプリセットを検索
      if (matchType === 0) {
        for (let i = 0; i < presets.length; i++) {
          const p = presets[i];
          if (p.layout.blockCols * p.layout.blockRows === csvTotalLabels) {
            matchType = 2;
            matchingPresetName = p.name;
            csvBlockCols = p.layout.blockCols;
            csvBlockRows = p.layout.blockRows;
            // プリセットのブロック構成を採用しつつ、ラベル内行数はCSVに合わせる
            newLayout = {
              ...p.layout,
              itemsPerLabel: csvItemsPerLabel,
            };
            break;
          }
        }
      }

      // プリセットが見つからなくてもブロック数だけでも推測
      if (matchType === 0) {
        // 現在のブロック構成のまま行数だけ変更
        if (currentTotalLabels === csvTotalLabels) {
          matchType = 2;
          matchingPresetName = "（現在の構成）";
          csvBlockCols = layout.blockCols;
          csvBlockRows = layout.blockRows;
          newLayout = { ...layout, itemsPerLabel: csvItemsPerLabel };
        } else {
          // ブロック数も違う → 読込不可
          setStatusMsg(
            `CSV読込エラー: CSVのラベル数(${csvTotalLabels})が現在のブロック数(${currentTotalLabels})と一致しません。`
          );
          return;
        }
      }

      setImportModal({
        filename: baseName,
        csvTotalLabels,
        csvItemsPerLabel,
        csvBlockCols,
        csvBlockRows,
        currentBlockCols: layout.blockCols,
        currentBlockRows: layout.blockRows,
        currentItemsPerLabel: layout.itemsPerLabel,
        currentTotalLabels,
        matchType,
        matchingPresetName,
        csvRows: rows,
        csvHasHeader: has_header,
        newLayout,
      });
    } catch (e) {
      setStatusMsg(`CSV読込エラー: ${e}`);
    }
  };

  const handleImportModalYes = () => {
    if (!importModal) return;
    const { csvRows, csvHasHeader, newLayout, filename, matchType, matchingPresetName } = importModal;

    // プリセット完全一致ならプリセット適用
    if (matchType === 1) {
      const presetIdx = presets.findIndex((p) => p.name === matchingPresetName);
      if (presetIdx >= 0) applyPreset(presetIdx);
    }

    if (hasExistingData()) {
      setImportModal(null);
      setOverwriteModal({
        filename,
        csvRows,
        csvHasHeader,
        newLayout,
      });
    } else {
      doImport(csvRows, csvHasHeader, newLayout, filename);
      setImportModal(null);
    }
  };

  const handleOverwriteYes = () => {
    if (!overwriteModal) return;
    const { csvRows, csvHasHeader, newLayout, filename } = overwriteModal;
    doImport(csvRows, csvHasHeader, newLayout, filename);
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
            title="CSV/Excelを読み込む"
          >📥 読込</button>
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
        <aside className="w-72 shrink-0 overflow-y-auto p-3 bg-slate-100 border-r border-slate-200">
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

      {/* CSV読込 レイアウト確認モーダル */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">読込 — レイアウト確認</h3>
            <div className="text-xs text-slate-600 space-y-2 mb-4">
              <p>読み込みファイル名：<strong>{importModal.filename}</strong></p>
              <div className="border border-slate-200 rounded p-3 space-y-1">
                <p className="font-medium text-slate-700">CSVの構成</p>
                <p>シートブロック列数：{importModal.csvBlockCols}列</p>
                <p>シートブロック行数：{importModal.csvBlockRows}行</p>
                <p>ラベル内行数：{importModal.csvItemsPerLabel}行</p>
                <p>総ラベル数：{importModal.csvTotalLabels}面</p>
              </div>
              <div className="border border-slate-200 rounded p-3 space-y-1">
                <p className="font-medium text-slate-700">現在のプリセット</p>
                <p>{importModal.currentBlockCols}×{importModal.currentBlockRows}　{importModal.currentTotalLabels}面</p>
                <p>ラベル内行数：{importModal.currentItemsPerLabel}行</p>
              </div>
              {importModal.matchType === 1 && (
                <p className="text-slate-700">
                  構成が違うのでプリセット「{importModal.matchingPresetName}」に切り替えて読み込みますか？
                </p>
              )}
              {importModal.matchType === 2 && (
                <div className="space-y-1">
                  <p className="text-amber-700 font-medium">
                    ⚠ ラベル内行数が異なります
                  </p>
                  <p className="text-slate-700">
                    ブロック数は一致しますが、ラベル内行数が
                    <strong>{importModal.currentItemsPerLabel}行 → {importModal.csvItemsPerLabel}行</strong>
                    に変更されます。
                  </p>
                  <p className="text-slate-500">
                    ※ 行数が増えた場合は末尾に空行が追加されます。行数が減った場合は末尾のデータが切り捨てられます。
                  </p>
                  <p className="text-slate-700">
                    「{importModal.matchingPresetName}」の構成で読み込みますか？
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setImportModal(null)}
              >いいえ</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white"
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
