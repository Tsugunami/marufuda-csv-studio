import { useRef, useState, useCallback, useEffect } from "react";

// ドラッグとクリックを区別する閾値（px）
const DRAG_THRESHOLD = 5;
import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";
import { getLabelDisplayTexts, isLabelUsed } from "../lib/label-utils";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function OverviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    grid, selectedRow, selectedCol, selectedCells, selectLabel, selectAll, layout,
    clearSelected, undo, clipboard, clipboardMode,
  } = useStore();
  const [zoom, setZoom] = useState(1);

  // ドラッグ（つまみ移動）用の状態
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const dragMoved = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });

  // アスペクト比を維持しつつ、全行が見えるセルサイズを計算
  const rowLineH = 11;
  const cellHeaderH = 6;
  const minCellH = cellHeaderH + layout.itemsPerLabel * rowLineH + 6;
  const aspect = layout.labelSize.heightMm / layout.labelSize.widthMm;

  const baseW = 90;
  const cellW = Math.max(baseW, minCellH / aspect);
  const cellH = cellW * aspect;
  const padding = 20;
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

    // 左上ブロックのサイズ表示
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`← ${layout.labelSize.widthMm}mm →`, cellW / 2, -4);
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
        const isMultiSelected = selectedCells.has(cellKey(r, c));
        const labelUseDelim = label ? (label.useDelimiter ?? true) : true;
        const labelDelimIdx = labelUseDelim && layout.delimiter
          ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
          : -1;
        const hasData = label ? isLabelUsed(label, labelDelimIdx) : false;

        // 背景
        if (isMultiSelected && !isSelected) ctx.fillStyle = "#fef3c7";
        else if (isSelected) ctx.fillStyle = "#dbeafe";
        else if (hasData) ctx.fillStyle = "#f0fdf4";
        else ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, cellW - 2, cellH - 2);

        // 枠
        if (isSelected) {
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
        } else if (isMultiSelected) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
        }
        ctx.strokeRect(x, y, cellW - 2, cellH - 2);

        // 行データプレビュー
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

    // クリップボード状態の表示
    if (clipboard) {
      ctx.fillStyle = clipboardMode === "reverse" ? "rgba(139,92,246,0.15)" : "rgba(249,115,22,0.15)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = clipboardMode === "reverse" ? "#7c3aed" : "#ea580c";
      const modeText = clipboardMode === "reverse" ? "反転コピー済み" : "コピー済み";
      ctx.fillText(`📋 ${modeText} — セル選択後に貼付ボタン`, padding + sizeMargin, -sizeMargin + 2);
    }

    ctx.restore();
  }, [grid, selectedRow, selectedCol, selectedCells, zoom, layout, cellW, cellH, padding, rowLineH, cellHeaderH, sizeMargin, clipboard, clipboardMode]);

  useEffect(() => {
    draw();
  }, [draw]);

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // ドラッグで移動した場合はクリックとして扱わない
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
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
      selectLabel(row, col, e.ctrlKey || e.metaKey || e.shiftKey);
    }
  };

  // ドラッグ開始（つまみ移動）
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    // 中クリック（ボタン1）または左クリック（ボタン0）でドラッグ
    isDragging.current = true;
    dragMoved.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const container = containerRef.current;
    if (!container) return;
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragMoved.current = true;
    }
    container.scrollLeft = dragStart.current.scrollLeft - dx;
    container.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(3, Math.max(0.3, +(z + delta).toFixed(2))));
    }
  };

    // キーボードショートカット（入力フィールドフォーカス中は無効）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isInputField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      if (isInputField) return;

      if (e.key === "Delete" || e.key === "Del") {
        e.preventDefault();
        clearSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelected, undo, selectAll]);

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
          <span className="text-slate-300 mx-1">|</span>
          <button className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={undo} title="元に戻す (Ctrl+Z)">↩ 戻す</button>
          <button className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
            onClick={clearSelected} title="選択セルをクリア (Del)">🗑 クリア</button>
        </div>
      </div>

            {/* キャンバス */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}>
        <canvas ref={canvasRef} onClick={handleClick} style={{ display: "block" }} />
      </div>

      {/* 選択情報 */}
      <div className="px-3 py-1.5 border-t border-slate-200 bg-white rounded-b-lg text-xs text-slate-600">
        選択: {selectedRow + 1}-{selectedCol + 1}
        {selectedCells.size > 1 && ` (複数: ${selectedCells.size}セル)`}
        （{grid.cols * grid.rows}面中）
        <span className="ml-2 text-slate-400">Ctrl/Shift+クリックで複数選択 | ドラッグで移動 | Delでクリア | Ctrl+Zで元に戻す</span>
      </div>
    </div>
  );
}
