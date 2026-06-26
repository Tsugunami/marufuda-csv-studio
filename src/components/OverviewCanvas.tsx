import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";

export function OverviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { grid, selectedRow, selectedCol, selectLabel, layout } = useStore();
  const [zoom, setZoom] = useState(1);

  const cellW = 90;
  const cellH = 70;
  const padding = 20;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (grid.cols * cellW + padding * 2) * zoom;
    const h = (grid.rows * cellH + padding * 2) * zoom;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(padding, padding);

    const delimIdx = layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
      : -1;

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const label = grid.labels[r]?.[c];
        const isSelected = r === selectedRow && c === selectedCol;
        const hasData = label?.rows.some((row) => row.text.trim() !== "");

        // 背景
        if (isSelected) {
          ctx.fillStyle = "#dbeafe";
        } else if (hasData) {
          ctx.fillStyle = "#f0fdf4";
        } else {
          ctx.fillStyle = "#ffffff";
        }
        ctx.fillRect(x, y, cellW - 2, cellH - 2);

        // 枠
        ctx.strokeStyle = isSelected ? "#2563eb" : "#cbd5e1";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(x, y, cellW - 2, cellH - 2);

        // ラベル番号
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText(`${r + 1}-${c + 1}`, x + 4, y + 12);

        // 行データプレビュー
        if (label) {
          ctx.font = "9px sans-serif";
          const maxPreview = Math.min(label.rows.length, 5);
          for (let i = 0; i < maxPreview; i++) {
            const text = label.rows[i].text;
            if (text.trim() === "") continue;
            const isDelim = i === delimIdx;
            ctx.fillStyle = isDelim ? "#ef4444" : "#475569";
            const displayText = text.length > 10 ? text.slice(0, 10) + "…" : text;
            ctx.fillText(displayText, x + 4, y + 26 + i * 11);
          }
        }
      }
    }

    ctx.restore();
  }, [grid, selectedRow, selectedCol, zoom, layout, cellW, cellH, padding]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX / zoom - padding;
    const y = (e.clientY - rect.top) * scaleY / zoom - padding;

    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    if (row >= 0 && row < grid.rows && col >= 0 && col < grid.cols) {
      selectLabel(row, col);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(3, Math.max(0.3, +(z + delta).toFixed(2))));
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-lg border border-slate-200">
      {/* ツールバー */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white rounded-t-lg">
        <span className="text-xs font-medium text-slate-600">全体ビュー</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
          >
            +
          </button>
          <span className="text-xs text-slate-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.2).toFixed(2)))}
          >
            −
          </button>
          <button
            className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={() => setZoom(1)}
          >
            fit
          </button>
        </div>
      </div>

      {/* キャンバス */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-2"
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="cursor-pointer"
          style={{ display: "block" }}
        />
      </div>

      {/* 選択情報 */}
      <div className="px-3 py-1.5 border-t border-slate-200 bg-white rounded-b-lg text-xs text-slate-600">
        選択: {selectedRow + 1}-{selectedCol + 1} （{grid.cols * grid.rows}面中）
      </div>
    </div>
  );
}
