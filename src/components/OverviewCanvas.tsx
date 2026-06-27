import { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";
import { getLabelDisplayTexts, isLabelUsed } from "../lib/label-utils";

export function OverviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { grid, selectedRow, selectedCol, selectLabel, layout } = useStore();
  const [zoom, setZoom] = useState(1);

  // アスペクト比を維持しつつ、全行が見えるセルサイズを計算
  const rowLineH = 11;
  const cellHeaderH = 6;
  const minCellH = cellHeaderH + layout.itemsPerLabel * rowLineH + 6;
  const aspect = layout.labelSize.heightMm / layout.labelSize.widthMm;

  const baseW = 90;
  const cellW = Math.max(baseW, minCellH / aspect);
  const cellH = cellW * aspect;
  const padding = 20;
  // サイズ表示用の余白（上・左）
  const sizeMargin = 18;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (grid.cols * cellW + padding * 2 + sizeMargin) * zoom;
    const h = (grid.rows * cellH + padding * 2 + sizeMargin) * zoom;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(padding + sizeMargin, padding + sizeMargin);

    // 左上ブロックのサイズ表示（幅: 上、高さ: 左）
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    // 幡表示（1つ目のセルの上）
    ctx.fillText(
      `← ${layout.labelSize.widthMm}mm →`,
      cellW / 2,
      -4
    );
    // 高さ表示（1つ目のセルの左）
    ctx.save();
    ctx.translate(-6, cellH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "bottom";
    ctx.fillText(`← ${layout.labelSize.heightMm}mm →`, 0, 0);
    ctx.restore();
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const label = grid.labels[r]?.[c];
        const isSelected = r === selectedRow && c === selectedCol;
        // ラベルごとの delimIdx を計算
        const labelUseDelim = label ? (label.useDelimiter ?? true) : true;
        const labelDelimIdx = labelUseDelim && layout.delimiter
          ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
          : -1;
        const hasData = label ? isLabelUsed(label, labelDelimIdx) : false;

        // 背景
        if (isSelected) ctx.fillStyle = "#dbeafe";
        else if (hasData) ctx.fillStyle = "#f0fdf4";
        else ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, cellW - 2, cellH - 2);

        // 枠
        ctx.strokeStyle = isSelected ? "#2563eb" : "#cbd5e1";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(x, y, cellW - 2, cellH - 2);

        // 行データプレビュー（センター揃え）
        if (label) {
          const displayTexts = getLabelDisplayTexts(label, layout);
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const centerX = x + (cellW - 2) / 2;
          for (let i = 0; i < displayTexts.length; i++) {
            const text = displayTexts[i];
            if (text.trim() === "") continue;
            const isDelim = i === labelDelimIdx;
            ctx.fillStyle = isDelim ? "#ef4444" : "#475569";
            const displayText = text.length > 10 ? text.slice(0, 10) + "…" : text;
            const lineY = y + cellHeaderH + rowLineH / 2 + i * rowLineH;
            ctx.fillText(displayText, centerX, lineY);
          }
          ctx.textAlign = "start";
          ctx.textBaseline = "alphabetic";
        }
      }
    }

    ctx.restore();
  }, [grid, selectedRow, selectedCol, zoom, layout, cellW, cellH, padding, rowLineH, cellHeaderH, sizeMargin]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX / zoom - padding - sizeMargin;
    const y = (e.clientY - rect.top) * scaleY / zoom - padding - sizeMargin;

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

  // itemsPerLabel が変わったときに zoom をリセット
  useEffect(() => {
    setZoom(1);
  }, [layout.itemsPerLabel]);

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-lg border border-slate-200">
      {/* ツールバー */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white rounded-t-lg">
        <span className="text-xs font-medium text-slate-600">全体ビュー</span>
        <span className="text-xs text-slate-400">
          ({layout.labelSize.widthMm}×{layout.labelSize.heightMm}mm)
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}>+</button>
          <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.2).toFixed(2)))}>−</button>
          <button className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={() => setZoom(1)}>fit</button>
        </div>
      </div>

      {/* キャンバス */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2" onWheel={handleWheel}>
        <canvas ref={canvasRef} onClick={handleClick} className="cursor-pointer" style={{ display: "block" }} />
      </div>

      {/* 選択情報 */}
      <div className="px-3 py-1.5 border-t border-slate-200 bg-white rounded-b-lg text-xs text-slate-600">
        選択: {selectedRow + 1}-{selectedCol + 1} （{grid.cols * grid.rows}面中）
      </div>
    </div>
  );
}
