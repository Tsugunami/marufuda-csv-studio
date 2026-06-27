import { useState } from "react";
import { LayoutConfigPanel } from "./components/LayoutConfigPanel";
import { OverviewCanvas } from "./components/OverviewCanvas";
import { LabelEditor } from "./components/LabelEditor";
import { ExportBar } from "./components/ExportBar";
import { useStore } from "./lib/store";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";

export default function App() {
  const { getProjectData, loadProjectData } = useStore();
  const [statusMsg, setStatusMsg] = useState("");

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
    </div>
  );
}
