import { useState, useEffect, useRef, useCallback } from "react";
import { LayoutConfigPanel } from "./components/LayoutConfigPanel";
import { OverviewCanvas } from "./components/OverviewCanvas";
import { LabelEditor } from "./components/LabelEditor";
import { ExportBar } from "./components/ExportBar";
import { useStore } from "./lib/store";
import type { ProjectData } from "./lib/store";
import type { LayoutConfig, ReusableSheet } from "./lib/types";
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
  matchType: 0 | 1 | 2;
  matchingPresetName: string;
  csvRows: string[][];
  csvHasHeader: boolean;
  newLayout: LayoutConfig;
}

interface HistoryEntry {
  name: string;
  timestamp: string;
  filename: string;
  project_json: string;
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
    setLayout,
    startNewProject,
    markFilledCellsUsed,
    reusableSheetId,
  } = useStore();
  const [statusMsg, setStatusMsg] = useState("");
  const [importModal, setImportModal] = useState<ImportModalData | null>(null);
  const [overwriteModal, setOverwriteModal] = useState<{
    csvRows: string[][];
    csvHasHeader: boolean;
    newLayout?: LayoutConfig;
    filename: string;
  } | null>(null);
  const [saveConfirmModal, setSaveConfirmModal] = useState<{ filename: string } | null>(null);

  // ペイン幅
  const [leftPaneWidth, setLeftPaneWidth] = useState(288);
  const [rightPaneWidth, setRightPaneWidth] = useState(320);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reusableSheets, setReusableSheets] = useState<ReusableSheet[]>([]);
  const reusableSheetsLoaded = useRef(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newLayoutSource, setNewLayoutSource] = useState("current");
  const [newSheetSource, setNewSheetSource] = useState<"blank" | "reuse" | "history">("blank");
  const [newSheetName, setNewSheetName] = useState("");
  const [selectedReusableSheetId, setSelectedReusableSheetId] = useState("");
  const [selectedHistorySheetId, setSelectedHistorySheetId] = useState("");

  const resizing = useRef<"left" | "right" | null>(null);

  // 自動保存・自動読み込み
  useEffect(() => {
    // 起動時に設定を読み込む
    (async () => {
      try {
        const settings = await invoke<{ project_json: string; pane_widths: string }>("load_settings");
        if (settings.pane_widths) {
          const pw = JSON.parse(settings.pane_widths);
          if (pw.left) setLeftPaneWidth(pw.left);
          if (pw.right) setRightPaneWidth(pw.right);
        }
        if (settings.project_json) {
          const data = JSON.parse(settings.project_json);
          loadProjectData(data);
          setStatusMsg("前回の作業を復元しました");
        }
      } catch {
        // 設定がない場合は何もしない
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const json = await invoke<string>("load_reusable_sheets");
        setReusableSheets(JSON.parse(json));
      } catch {
        setReusableSheets([]);
      } finally {
        reusableSheetsLoaded.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!reusableSheetsLoaded.current) return;
    void invoke("save_reusable_sheets", { sheetsJson: JSON.stringify(reusableSheets) });
  }, [reusableSheets]);

  // 自動保存関数
  const autoSave = useCallback(async () => {
    try {
      const data = getProjectData();
      const projectJson = JSON.stringify(data);
      const paneWidths = JSON.stringify({ left: leftPaneWidth, right: rightPaneWidth });
      await invoke("save_settings", { projectJson, paneWidths });
    } catch {
      // 自動保存の失敗は無視
    }
  }, [getProjectData, leftPaneWidth, rightPaneWidth]);

  // 定期保存に加え、編集データの変更後は短時間で保存する。
  // 終了イベントは横取りせず、Windows/Tauri標準の×ボタン処理を利用する。
  useEffect(() => {
    let saveTimer: number | undefined;
    const unsubscribe = useStore.subscribe((state, previous) => {
      const projectChanged =
        state.grid !== previous.grid ||
        state.layout !== previous.layout ||
        state.presets !== previous.presets ||
        state.sizePresets !== previous.sizePresets ||
        state.presetTexts !== previous.presetTexts ||
        state.presetTextCategories !== previous.presetTextCategories ||
        state.exportConfig !== previous.exportConfig;
      if (!projectChanged) return;
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => { void autoSave(); }, 500);
    });
    const interval = window.setInterval(() => { void autoSave(); }, 30000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    };
  }, [autoSave]);

  // 履歴一覧読み込み
  const loadHistory = useCallback(async () => {
    try {
      const list = await invoke<HistoryEntry[]>("load_history_list");
      setHistoryList(list);
    } catch {
      setHistoryList([]);
    }
  }, []);

  // 保存確認モーダル（ExportBar からの呼び出し用）
  const handleShowSaveConfirm = (filename: string) => {
    setSaveConfirmModal({ filename });
  };

  const handleSaveConfirmYes = async () => {
    if (!saveConfirmModal) return;
    try {
      const data = getProjectData();
      const projectJson = JSON.stringify(data);
      const name = saveConfirmModal.filename.replace(/\.(csv|xlsx)$/i, "") || "unnamed";
      await invoke("save_history", { name, projectJson });
      setStatusMsg(`ラベル情報を保存しました: ${name}`);
      loadHistory();
    } catch (e) {
      setStatusMsg(`保存エラー: ${e}`);
    }
    setSaveConfirmModal(null);
  };

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

  // 履歴からの復元
  const handleRestoreHistory = async (entry: HistoryEntry) => {
    try {
      const data = JSON.parse(entry.project_json);
      loadProjectData(data, true);
      setShowHistory(false);
      setStatusMsg(`履歴から復元: ${entry.name} (${entry.timestamp})`);
    } catch (e) {
      setStatusMsg(`復元エラー: ${e}`);
    }
  };

  const handleDeleteHistory = async (entry: HistoryEntry) => {
    try {
      await invoke("delete_history", { filename: entry.filename });
      setStatusMsg(`履歴を削除しました: ${entry.name}`);
      loadHistory();
    } catch (e) {
      setStatusMsg(`削除エラー: ${e}`);
    }
  };

  const selectedNewLayout = newLayoutSource === "current"
    ? layout
    : presets[Number(newLayoutSource)]?.layout ?? layout;
  const compatibleReusableSheets = reusableSheets.filter((sheet) =>
    sheet.layout.blockCols === selectedNewLayout.blockCols &&
    sheet.layout.blockRows === selectedNewLayout.blockRows &&
    sheet.layout.labelSize.widthMm === selectedNewLayout.labelSize.widthMm &&
    sheet.layout.labelSize.heightMm === selectedNewLayout.labelSize.heightMm
  );

  const compatibleHistorySheets = historyList.flatMap((entry) => {
    try {
      const project = JSON.parse(entry.project_json) as ProjectData;
      const matches = project.layout.blockCols === selectedNewLayout.blockCols &&
        project.layout.blockRows === selectedNewLayout.blockRows &&
        project.layout.labelSize.widthMm === selectedNewLayout.labelSize.widthMm &&
        project.layout.labelSize.heightMm === selectedNewLayout.labelSize.heightMm;
      if (!matches) return [];
      const usedCells: string[] = [];
      project.grid.labels.forEach((row, r) => row.forEach((label, c) => {
        if (label.rows.some((line) => line.text.trim() !== "")) usedCells.push(`${r},${c}`);
      }));
      return [{ entry, usedCells }];
    } catch {
      return [];
    }
  });

  const handleOpenNewModal = async () => {
    await loadHistory();
    setNewLayoutSource("current");
    setNewSheetSource("blank");
    setNewSheetName("");
    setSelectedReusableSheetId("");
    setSelectedHistorySheetId("");
    setShowNewModal(true);
  };

  const handleCreateNewProject = () => {
    const selected = reusableSheets.find((sheet) => sheet.id === selectedReusableSheetId);
    if (newSheetSource === "reuse" && selected) {
      startNewProject(selectedNewLayout, selected.usedCells, selected.id);
      setStatusMsg(`残りシートを使用して新規作成: ${selected.name}`);
    } else if (newSheetSource === "history") {
      const history = compatibleHistorySheets.find((item) => item.entry.filename === selectedHistorySheetId);
      if (!history) return;
      const now = new Date().toISOString();
      const id = `history-${history.entry.filename}`;
      const sheet: ReusableSheet = {
        id, name: `履歴: ${history.entry.name}`,
        layout: { ...selectedNewLayout, labelSize: { ...selectedNewLayout.labelSize } },
        usedCells: history.usedCells, createdAt: now, updatedAt: now,
      };
      setReusableSheets((items) => [...items.filter((item) => item.id !== id), sheet]);
      startNewProject(selectedNewLayout, history.usedCells, id);
      setStatusMsg(`保存履歴から残りシートを作成: ${history.entry.name}`);
    } else {
      let sheetId: string | null = null;
      if (newSheetName.trim()) {
        const now = new Date().toISOString();
        const sheet: ReusableSheet = {
          id: crypto.randomUUID(), name: newSheetName.trim(),
          layout: { ...selectedNewLayout, labelSize: { ...selectedNewLayout.labelSize } },
          usedCells: [], createdAt: now, updatedAt: now,
        };
        sheetId = sheet.id;
        setReusableSheets((items) => [...items, sheet]);
      }
      startNewProject(selectedNewLayout, [], sheetId);
      setStatusMsg(sheetId ? "残りシートとして登録して新規作成しました" : "白紙シートで新規作成しました");
    }
    setShowNewModal(false);
  };

  const handleMarkPrinted = () => {
    if (!reusableSheetId) return;
    const usedCells = markFilledCellsUsed();
    setReusableSheets((items) => items.map((sheet) => sheet.id === reusableSheetId
      ? { ...sheet, usedCells, updatedAt: new Date().toISOString() }
      : sheet));
    setStatusMsg("入力済みラベルを使用済みに更新しました");
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
          { name: "CSV / alym", extensions: ["csv", "alym"] },
          { name: "ラベル屋さんテンプレート", extensions: ["alym"] },
          { name: "CSV", extensions: ["csv"] },
        ],
        multiple: false,
      });
      if (!filePath || typeof filePath !== "string") {
        setStatusMsg("読込をキャンセルしました");
        return;
      }

      const filename = filePath.split(/[/\\]/).pop() || filePath;
      const baseName = filename.replace(/\.(csv|xlsx|alym)$/i, "");

      // alym の場合
      if (/\.alym$/i.test(filePath)) {
        const result = await invoke<{ rows: string[][]; has_header: boolean }>("import_alym", { path: filePath });
        const alymRows = result.rows;
        if (!alymRows || alymRows.length === 0) {
          setStatusMsg("ファイルにデータがありません");
          return;
        }
        // alymに含まれるレイアウト情報は無視し、現在のレイアウトで読み込む
        doImport(alymRows, false, undefined, baseName);
        return;
      }

      const isXlsx = /\.xlsx$/i.test(filePath);
      const cmd = isXlsx ? "import_xlsx" : "import_csv";
      const csvResult = await invoke<{ rows: string[][]; has_header: boolean }>(cmd, { path: filePath });
      const { rows: csvRows, has_header } = csvResult;

      const dataRows = csvRows ? (has_header ? csvRows.slice(1) : csvRows) : [];
      const csvItemsPerLabel = Math.max(...dataRows.map((r) => r.length), 0);
      const csvTotalLabels = dataRows.length;

      const currentTotalLabels = layout.blockCols * layout.blockRows;
      const currentItemsPerLabel = layout.itemsPerLabel;

      if (currentTotalLabels === csvTotalLabels && currentItemsPerLabel === csvItemsPerLabel) {
        setCsvFilename(baseName);
        if (hasExistingData()) {
          setOverwriteModal({ filename: baseName, csvRows: csvRows ?? [], csvHasHeader: has_header ?? false, newLayout: undefined });
        } else {
          doImport(csvRows ?? [], has_header ?? false, undefined, baseName);
        }
        return;
      }

      let matchType: 0 | 1 | 2 = 0;
      let matchingPresetName = "";
      let csvBlockCols = 0;
      let csvBlockRows = 0;
      let newLayout: LayoutConfig = { ...layout };

      for (let i = 0; i < presets.length; i++) {
        const p = presets[i];
        if (p.layout.blockCols * p.layout.blockRows === csvTotalLabels && p.layout.itemsPerLabel === csvItemsPerLabel) {
          matchType = 1;
          matchingPresetName = p.name;
          csvBlockCols = p.layout.blockCols;
          csvBlockRows = p.layout.blockRows;
          newLayout = { ...p.layout };
          break;
        }
      }

      if (matchType === 0) {
        for (let i = 0; i < presets.length; i++) {
          const p = presets[i];
          if (p.layout.blockCols * p.layout.blockRows === csvTotalLabels) {
            matchType = 2;
            matchingPresetName = p.name;
            csvBlockCols = p.layout.blockCols;
            csvBlockRows = p.layout.blockRows;
            newLayout = { ...p.layout, itemsPerLabel: csvItemsPerLabel };
            break;
          }
        }
      }

      if (matchType === 0) {
        if (currentTotalLabels === csvTotalLabels) {
          matchType = 2;
          matchingPresetName = "（現在の構成）";
          csvBlockCols = layout.blockCols;
          csvBlockRows = layout.blockRows;
          newLayout = { ...layout, itemsPerLabel: csvItemsPerLabel };
        } else {
          csvBlockCols = layout.blockCols;
          csvBlockRows = Math.ceil(csvTotalLabels / csvBlockCols);
          matchingPresetName = `（${csvBlockCols}×${csvBlockRows}）`;
          matchType = 2;
          newLayout = { ...layout, blockCols: csvBlockCols, blockRows: csvBlockRows, itemsPerLabel: csvItemsPerLabel };
        }
      }

      setImportModal({
        filename: baseName, csvTotalLabels, csvItemsPerLabel, csvBlockCols, csvBlockRows,
        currentBlockCols: layout.blockCols, currentBlockRows: layout.blockRows,
        currentItemsPerLabel: layout.itemsPerLabel, currentTotalLabels,
        matchType, matchingPresetName, csvRows: csvRows ?? [], csvHasHeader: has_header ?? false, newLayout,
      });
    } catch (e) {
      setStatusMsg(`CSV読込エラー: ${e}`);
    }
  };

  const handleImportModalYes = () => {
    if (!importModal) return;
    const { csvRows, csvHasHeader, newLayout, filename, matchType, matchingPresetName } = importModal;
    if (matchType === 1) {
      const presetIdx = presets.findIndex((p) => p.name === matchingPresetName);
      if (presetIdx >= 0) applyPreset(presetIdx);
    }
    if (hasExistingData()) {
      setImportModal(null);
      setOverwriteModal({ filename, csvRows, csvHasHeader, newLayout });
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

  // ペインリサイズ
  const handleResizeStart = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = side;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      if (resizing.current === "left") {
        setLeftPaneWidth(Math.max(200, Math.min(500, e.clientX)));
      } else {
        const total = window.innerWidth;
        setRightPaneWidth(Math.max(200, Math.min(500, total - e.clientX)));
      }
    };
    const handleMouseUp = () => {
      if (resizing.current) {
        resizing.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        autoSave();
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [autoSave]);

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
            className="px-3 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 text-white"
            onClick={handleOpenNewModal}
            title="白紙または残りラベルシートから新規作成"
          >＋ 新規作成</button>
          {reusableSheetId && (
            <button
              className="px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white"
              onClick={handleMarkPrinted}
              title="入力済みのラベルを物理的な使用済み位置として保存"
            >印刷済みに更新</button>
          )}
          <button
            className="px-3 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white"
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
            title="保存履歴"
          >📋 履歴</button>
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

      {/* メイン 3ペイン */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左ペイン */}
        <aside className="shrink-0 overflow-y-auto p-3 bg-slate-100 border-r border-slate-200"
          style={{ width: leftPaneWidth }}>
          <LayoutConfigPanel />
        </aside>
        {/* 左リサイズハンドル */}
        <div
          className="shrink-0 w-1 cursor-col-resize bg-transparent hover:bg-brand-400 active:bg-brand-500 transition-colors"
          onMouseDown={handleResizeStart("left")}
        />

        {/* 中央 */}
        <main className="flex-1 p-3 overflow-hidden">
          <OverviewCanvas />
        </main>

        {/* 右リサイズハンドル */}
        <div
          className="shrink-0 w-1 cursor-col-resize bg-transparent hover:bg-brand-400 active:bg-brand-500 transition-colors"
          onMouseDown={handleResizeStart("right")}
        />
        {/* 右ペイン */}
        <aside className="shrink-0 overflow-auto bg-slate-100 border-l border-slate-200"
          style={{ width: rightPaneWidth }}>
          {showHistory ? (
            <div className="p-3 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-700">保存履歴</h3>
                <button
                  className="text-xs text-slate-400 hover:text-slate-600"
                  onClick={() => setShowHistory(false)}
                >✕ 閉じる</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {historyList.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">履歴はありません</p>
                )}
                {historyList.map((entry) => {
                  let sizeLabel = "";
                  try {
                    const project = JSON.parse(entry.project_json) as ProjectData;
                    const ls = project.layout.labelSize;
                    if (ls && ls.widthMm && ls.heightMm) {
                      sizeLabel = `${ls.widthMm}×${ls.heightMm}mm`;
                    }
                  } catch { /* ignore parse error */ }
                  return (
                    <div key={entry.filename} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-slate-50 border border-slate-200">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-slate-700">{entry.name}</p>
                        <p className="text-slate-400 text-[10px]">{entry.timestamp}{sizeLabel && <span className="ml-2 text-amber-500">〔{sizeLabel}〕</span>}</p>
                      </div>
                      <button
                        className="text-blue-500 hover:text-blue-700 shrink-0"
                        onClick={() => handleRestoreHistory(entry)}
                        title="復元"
                      >開く</button>
                      <button
                        className="text-red-400 hover:text-red-600 shrink-0"
                        onClick={() => handleDeleteHistory(entry)}
                        title="削除"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <LabelEditor />
          )}
        </aside>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[460px] max-w-[92vw] rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-slate-800">新規作成</h2>
            <p className="mb-4 text-xs text-slate-500">現在の入力内容は新しい作業シートへ切り替わります。</p>

            <label className="mb-1 block text-xs font-medium text-slate-700">レイアウト</label>
            <select className="mb-4 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={newLayoutSource} onChange={(e) => { setNewLayoutSource(e.target.value); setSelectedReusableSheetId(""); }}>
              <option value="current">現在の設定（{layout.blockCols}×{layout.blockRows}面）</option>
              {presets.map((preset, index) => (
                <option key={`${preset.name}-${index}`} value={String(index)}>{preset.name}（{preset.layout.blockCols}×{preset.layout.blockRows}面）</option>
              ))}
            </select>

            <label className="mb-1 block text-xs font-medium text-slate-700">用紙</label>
            <div className="mb-3 space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="radio" checked={newSheetSource === "blank"} onChange={() => setNewSheetSource("blank")} />白紙シートから作成</label>
              <label className="flex items-center gap-2"><input type="radio" checked={newSheetSource === "reuse"} onChange={() => setNewSheetSource("reuse")} />保存済みの残りラベルシートを使用</label>
              <label className="flex items-center gap-2"><input type="radio" checked={newSheetSource === "history"} onChange={() => setNewSheetSource("history")} />保存履歴から残りシートを作成</label>
            </div>

            {newSheetSource === "blank" ? (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-slate-700">残りシート名（任意）</label>
                <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={newSheetName}
                  placeholder="例: A-ONE 31509・事務所棚" onChange={(e) => setNewSheetName(e.target.value)} />
                <p className="mt-1 text-[11px] text-slate-500">入力すると、印刷済み位置を次回以降に再利用できるシートとして登録します。</p>
              </div>
            ) : newSheetSource === "reuse" ? (
              <div className="mb-4">
                <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={selectedReusableSheetId}
                  onChange={(e) => setSelectedReusableSheetId(e.target.value)}>
                  <option value="">残りシートを選択</option>
                  {compatibleReusableSheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>{sheet.name}（残り {selectedNewLayout.blockCols * selectedNewLayout.blockRows - sheet.usedCells.length}/{selectedNewLayout.blockCols * selectedNewLayout.blockRows} 面）</option>
                  ))}
                </select>
                {compatibleReusableSheets.length === 0 && <p className="mt-1 text-xs text-amber-600">このレイアウトと一致する残りシートはありません。</p>}
              </div>
            ) : (
              <div className="mb-4">
                <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={selectedHistorySheetId}
                  onChange={(e) => setSelectedHistorySheetId(e.target.value)}>
                  <option value="">保存履歴を選択</option>
                  {compatibleHistorySheets.map(({ entry, usedCells }) => (
                    <option key={entry.filename} value={entry.filename}>{entry.name}（空き {selectedNewLayout.blockCols * selectedNewLayout.blockRows - usedCells.length}/{selectedNewLayout.blockCols * selectedNewLayout.blockRows} 面）</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">履歴内で本文が入っているラベルを使用済みとして登録します。</p>
                {compatibleHistorySheets.length === 0 && <p className="mt-1 text-xs text-amber-600">このレイアウトと一致する保存履歴はありません。</p>}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button className="rounded bg-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-300" onClick={() => setShowNewModal(false)}>キャンセル</button>
              <button className="rounded bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-40"
                disabled={(newSheetSource === "reuse" && !selectedReusableSheetId) || (newSheetSource === "history" && !selectedHistorySheetId)}
                onClick={handleCreateNewProject}>新規作成</button>
            </div>
          </div>
        </div>
      )}

      {/* 下部 */}
      <footer className="shrink-0 border-t border-slate-200">
        <ExportBar onSaveConfirm={handleShowSaveConfirm} />
        {statusMsg && (
          <div className="px-4 py-1 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
            {statusMsg}
          </div>
        )}
      </footer>

      {/* モーダル群… */}
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
                <p className="text-slate-700">構成が違うのでプリセット「{importModal.matchingPresetName}」に切り替えて読み込みますか？</p>
              )}
              {importModal.matchType === 2 && (
                <div className="space-y-1">
                  <p className="text-amber-700 font-medium">⚠ ラベル内行数が異なります</p>
                  <p className="text-slate-700">ブロック数は一致しますが、ラベル内行数が
                    <strong>{importModal.currentItemsPerLabel}行 → {importModal.csvItemsPerLabel}行</strong>に変更されます。</p>
                  <p className="text-slate-500">※ 行数が増えた場合は末尾に空行が追加されます。行数が減った場合は末尾のデータが切り捨てられます。</p>
                  <p className="text-slate-700">「{importModal.matchingPresetName}」の構成で読み込みますか？</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700" onClick={() => setImportModal(null)}>いいえ</button>
              <button className="px-4 py-1.5 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white" onClick={handleImportModalYes}>はい</button>
            </div>
          </div>
        </div>
      )}

      {overwriteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">上書き確認</h3>
            <p className="text-xs text-slate-600 mb-4">既存の入力データが上書きされます。よろしいですか？</p>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700" onClick={() => setOverwriteModal(null)}>いいえ</button>
              <button className="px-4 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white" onClick={handleOverwriteYes}>はい（上書き）</button>
            </div>
          </div>
        </div>
      )}

      {saveConfirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-[90vw]">
            <h3 className="text-sm font-bold text-slate-800 mb-3">保存確認</h3>
            <p className="text-xs text-slate-600 mb-4">
              ラベル情報を保存してから出力しますか？<br />
              「保存して出力」を選ぶと、今のラベルデータが履歴に保存された後にCSV/Excelが出力されます。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-1.5 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={() => setSaveConfirmModal(null)}
              >CSVのみ出力</button>
              <button
                className="px-4 py-1.5 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white"
                onClick={handleSaveConfirmYes}
              >保存して出力</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
