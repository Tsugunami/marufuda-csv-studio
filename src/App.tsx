import { LayoutConfigPanel } from "./components/LayoutConfigPanel";
import { OverviewCanvas } from "./components/OverviewCanvas";
import { LabelEditor } from "./components/LabelEditor";
import { ExportBar } from "./components/ExportBar";

export default function App() {
  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <header className="flex items-center px-4 py-2 bg-slate-800 text-white">
        <h1 className="text-base font-bold">丸札CSVスタジオ</h1>
        <span className="ml-2 text-xs text-slate-400">
          A-ONE ラベル屋さん™ 差し込み印刷用 CSV 作成ツール
        </span>
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
      </footer>
    </div>
  );
}
