import { useRef, useState, useCallback, useEffect, useMemo } from "react";

const DRAG_THRESHOLD = 5;
import { useStore } from "../lib/store";
import { getDelimiterRowIndex } from "../lib/delimiter";
import { getLabelDisplayTexts, isLabelUsed } from "../lib/label-utils";
import { calcFontSizePt, countFullwidthChars, validateCharLimit } from "../lib/char-limit";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

interface ContextMenuState {
  x: number;
  y: number;
  row: number;
  col: number;
}

export function OverviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const selectionRef = useRef<{ start: number; end: number; row: number }>({ start: 0, end: 0, row: -1 });
  const {
    grid, selectedRow, selectedCol, selectedCells, selectLabel, selectAll, layout,
    clearSelected, undo, clipboard, clipboardMode,
    copyToClipboard, reverseCopyToClipboard, pasteFromClipboard,
    copyTo, reverseTo, setLayout, updateLabelRow, toggleLabelDelimiter,
    presetTexts, presetTextCategories, selectedPresetTextCategory,
    setPresetTextCategory, renamePresetTextCategory,
    addPresetText, deletePresetText, addPresetTextCategory, deletePresetTextCategory,
    movePresetText, reorderPresetTextCategories, reorderPresetTexts, applyPresetTextToSelected,
  } = useStore();
  const [zoom, setZoom] = useState(1);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingLine, setEditingLine] = useState<number>(-1);
  const [reorderMode, setReorderMode] = useState(false);
  const [presetTextZoom, setPresetTextZoom] = useState(1);
  const [newPresetText, setNewPresetText] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryDraft, setEditingCategoryDraft] = useState("");
  const [draggedPresetTextId, setDraggedPresetTextId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategoryIndex, setDragOverCategoryIndex] = useState<number | null>(null);
  const [dragOverTextIndex, setDragOverTextIndex] = useState<number | null>(null);

  // HTML5 D&D の dataTransfer.getData() は WebView2 で空を返すため ref で管理
  const dragDataRef = useRef<{ type: 'text'; id: string } | { type: 'category'; id: string } | null>(null);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const dragMoved = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });

  const normalizeCategory = (category?: string) => category?.trim() || "未分類";

  const categories = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    const push = (category: string) => {
      const normalized = normalizeCategory(category);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    };
    presetTextCategories.forEach((category) => push(category));
    presetTexts.forEach((item) => push(item.category ?? "未分類"));
    if (!seen.has(normalizeCategory(selectedPresetTextCategory))) {
      result.push(normalizeCategory(selectedPresetTextCategory));
    }
    return result.length > 0 ? result : ["基本"];
  }, [presetTexts, presetTextCategories, selectedPresetTextCategory]);

  const activePresetTextCategory = categories.includes(selectedPresetTextCategory)
    ? selectedPresetTextCategory
    : categories[0];

  const visiblePresetTexts = useMemo(() => {
    return presetTexts.filter((item) => normalizeCategory(item.category) === activePresetTextCategory);
  }, [presetTexts, activePresetTextCategory]);

  useEffect(() => {
    if (selectedPresetTextCategory !== activePresetTextCategory) {
      setPresetTextCategory(activePresetTextCategory);
    }
  }, [activePresetTextCategory, selectedPresetTextCategory, setPresetTextCategory]);

  const rowLineH = 11;
  const minCellH = layout.itemsPerLabel * rowLineH;
  const aspect = layout.labelSize.heightMm / layout.labelSize.widthMm;

  const baseW = 90;
  const cellW = Math.max(baseW, minCellH / aspect);
  const cellH = cellW * aspect;
  const padding = 20;
  const sizeMargin = 18;
  const labelMargin = 22;

  // --- Edit mode helpers ---
  const editingLabel = editingCell ? grid.labels[editingCell.row]?.[editingCell.col] : null;
  const editingUseDelim = editingLabel ? (editingLabel.useDelimiter ?? true) : true;
  const editingDelimIdx = editingUseDelim && layout.delimiter
    ? getDelimiterRowIndex(layout.itemsPerLabel, editingLabel?.delimiterAlign ?? layout.delimiterAlign)
    : -1;
  // 行番号を残した編集欄でも、最長行を横に見切れず確認できるようにする。
  // 通常表示と同じ物理フォントサイズを基準に、必要なときだけ縮小する。
  const editingMaxChars = editingLabel
    ? Math.max(1, ...editingLabel.rows.map((row) => countFullwidthChars(row.text)))
    : 1;
  const viewFontSize = calcFontSizePt(layout.labelSize.heightMm, layout.itemsPerLabel)
    * 0.3528 * (cellW / layout.labelSize.widthMm);
  const editingFontSize = Math.max(
    5,
    Math.min(viewFontSize, (cellW - 16) / (editingMaxChars * 1.1)),
  ) * zoom;

  const isEvenRows = layout.itemsPerLabel % 2 === 0;
  const effectiveAlign = isEvenRows && editingLabel?.delimiterAlign === 'center'
    ? 'self' : (editingLabel?.delimiterAlign ?? layout.delimiterAlign);

  const getDelimiterState = (): 'center' | 'self' | 'partner' | 'none' => {
    if (!editingUseDelim) return 'none';
    // 偶数行の場合は「中」を「上」に読み替えて表示
    if (isEvenRows && effectiveAlign === 'center') return 'self';
    return effectiveAlign;
  };

  const delimiterCycle = useCallback(() => {
    const current = getDelimiterState();
    if (isEvenRows) {
      // 偶数行: 無 → 上 → 下 → 無
      switch (current) {
        case 'none':
          toggleLabelDelimiter();
          setLayout({ delimiterAlign: 'self' });
          break;
        case 'self':
          setLayout({ delimiterAlign: 'partner' });
          break;
        case 'partner':
          toggleLabelDelimiter();
          break;
      }
    } else {
      // 奇数行: 無 → 中 → 無
      switch (current) {
        case 'none':
          toggleLabelDelimiter();
          setLayout({ delimiterAlign: 'center' });
          break;
        case 'center':
          toggleLabelDelimiter();
          break;
      }
    }
  }, [editingUseDelim, effectiveAlign, setLayout, toggleLabelDelimiter, isEvenRows]);

  const getDelimiterDisplay = (state: 'center' | 'self' | 'partner' | 'none') => {
    const d = layout.delimiter || '～';
    switch (state) {
      case 'center': return d + '中';
      case 'self': return d + '上';
      case 'partner': return d + '下';
      case 'none': return '無し';
    }
  };

  // --- Overlay position in viewport-relative coords (fixed) ---
  const getOverlayStyle = (): React.CSSProperties => {
    if (!editingCell || !containerRef.current || !canvasRef.current) return { display: 'none' };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (padding + sizeMargin + labelMargin + editingCell.col * cellW) * zoom / scaleX;
    const y = (padding + sizeMargin + labelMargin + editingCell.row * cellH) * zoom / scaleY;
    return {
      position: 'fixed' as const,
      left: `${rect.left + x}px`,
      top: `${rect.top + y}px`,
      width: `${(cellW - 1) * zoom / scaleX}px`,
      height: `${(cellH - 1) * zoom / scaleY}px`,
    };
  };

  // --- Draw ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (grid.cols * cellW + padding * 2 + sizeMargin + labelMargin) * zoom;
    const h = (grid.rows * cellH + padding * 2 + sizeMargin + labelMargin) * zoom;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(padding + sizeMargin + labelMargin, padding + sizeMargin + labelMargin);

    const drawLabelText = (x: number, y: number, label: NonNullable<typeof grid.labels[number][number]>, delimIdx: number) => {
      const displayTexts = getLabelDisplayTexts(label, layout);
      const rowH = (cellH - 1) / displayTexts.length;
      const fontSize = calcFontSizePt(layout.labelSize.heightMm, layout.itemsPerLabel)
        * 0.3528 * (cellW / layout.labelSize.widthMm);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, y + 1, cellW - 2, cellH - 2);
      ctx.clip();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fontSize}px \"Noto Sans JP\", sans-serif`;
      const centerX = x + cellW / 2;
      for (let i = 0; i < displayTexts.length; i++) {
        const text = displayTexts[i];
        if (text.trim() === "") continue;
        ctx.fillStyle = i === delimIdx ? "#ef4444" : "#475569";
        ctx.fillText(text, centerX, y + 0.5 + rowH * i + rowH / 2);
      }
      ctx.restore();
    };

    // 左上ブロックのサイズ表示（列番号・行番号より外側）
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${layout.labelSize.widthMm}mm`, cellW / 2, -(labelMargin + 8));
    ctx.font = "8px sans-serif";
    ctx.fillText("← →", cellW / 2, -(labelMargin + 8) + 12);

    ctx.save();
    ctx.translate(-(labelMargin + 14), cellH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "10px sans-serif";
    ctx.fillText(`${layout.labelSize.heightMm}mm`, 0, 0);
    ctx.font = "8px sans-serif";
    ctx.fillText("← →", 0, 12);
    ctx.restore();

    // 列番号（上部）
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let c = 0; c < grid.cols; c++) {
      ctx.fillText(`${c + 1}`, c * cellW + (cellW - 1) / 2, -4);
    }

    // 行番号（左側）
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let r = 0; r < grid.rows; r++) {
      ctx.fillText(`${r + 1}`, -4, r * cellH + (cellH - 1) / 2);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const label = grid.labels[r]?.[c];
        const isSelected = r === selectedRow && c === selectedCol;
        const isMultiSelected = selectedCells.has(cellKey(r, c));
        const isEditing = editingCell !== null && r === editingCell.row && c === editingCell.col;
        const labelUseDelim = label ? (label.useDelimiter ?? true) : true;
        const labelDelimIdx = labelUseDelim && layout.delimiter
          ? getDelimiterRowIndex(layout.itemsPerLabel, label.delimiterAlign ?? layout.delimiterAlign)
          : -1;
        const hasData = label ? isLabelUsed(label, labelDelimIdx) : false;

        if (editingCell && !isEditing) {
          // 編集モード中は他セルを半透明オーバーレイでグレーアウト（元の表示が透けて見える）
          // まず通常描画
          if (isMultiSelected && !isSelected) ctx.fillStyle = "#fef3c7";
          else if (isSelected) ctx.fillStyle = "#dbeafe";
          else if (hasData) ctx.fillStyle = "#f0fdf4";
          else ctx.fillStyle = "#ffffff";
          ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
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
          ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
          // テキストも通常描画
          if (label) {
            drawLabelText(x, y, label, labelDelimIdx);
          }
          // 上から半透明レイヤーを重ねる
          ctx.fillStyle = "rgba(226,232,240,0.75)";
          ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
          continue;
        }

        // 通常描画（編集モードではない or 編集中のセル自身）
        if (isMultiSelected && !isSelected) ctx.fillStyle = "#fef3c7";
        else if (isSelected) ctx.fillStyle = "#dbeafe";
        else if (hasData) ctx.fillStyle = "#f0fdf4";
        else ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

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
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

        // 編集中セルの文字はオーバーレイに任せる
        if (isEditing) continue;

        if (label) {
          drawLabelText(x, y, label, labelDelimIdx);
        }
      }
    }

    if (clipboard) {
      ctx.fillStyle = clipboardMode === "reverse" ? "#7c3aed" : "#ea580c";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const modeText = clipboardMode === "reverse" ? "反転コピー済み" : "コピー済み";
      ctx.fillText(`📋 ${modeText} — セル選択後に貼付ボタン`, 0, -labelMargin);
    }

    ctx.restore();
  }, [grid, selectedRow, selectedCol, selectedCells, zoom, layout, cellW, cellH, padding, sizeMargin, labelMargin, clipboard, clipboardMode, editingCell]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getCellFromEvent = (e: React.MouseEvent): { row: number; col: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX / zoom - padding - sizeMargin - labelMargin;
    const y = (e.clientY - rect.top) * scaleY / zoom - padding - sizeMargin - labelMargin;
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    if (row >= 0 && row < grid.rows && col >= 0 && col < grid.cols) {
      return { row, col };
    }
    return null;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    const cell = getCellFromEvent(e);
    if (cell) {
      // 編集中に別セルをクリック → 編集終了して選択切り替え
      if (editingCell && (cell.row !== editingCell.row || cell.col !== editingCell.col)) {
        setEditingCell(null);
      }
      selectLabel(cell.row, cell.col, e.ctrlKey || e.metaKey, e.shiftKey);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellFromEvent(e);
    if (cell) {
      selectLabel(cell.row, cell.col, false, false);
      setEditingCell({ row: cell.row, col: cell.col });
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (cell) {
      selectLabel(cell.row, cell.col);
      setCtxMenu({ x: e.clientX, y: e.clientY, row: cell.row, col: cell.col });
    }
  };

  const closeContextMenu = useCallback(() => {
    setCtxMenu(null);
  }, []);

  useEffect(() => {
    if (ctxMenu) {
      window.addEventListener("click", closeContextMenu);
      return () => window.removeEventListener("click", closeContextMenu);
    }
  }, [ctxMenu, closeContextMenu]);

  // Escape で編集モード終了
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingCell) {
        setEditingCell(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingCell]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
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

  // スクロール時にオーバーレイ位置更新
  const [, setScrollPos] = useState(0);
  const handleScroll = useCallback(() => {
    setScrollPos((s) => s + 1); // force re-render
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copyToClipboard();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        pasteFromClipboard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelected, undo, selectAll, copyToClipboard, pasteFromClipboard]);

  useEffect(() => {
    setZoom(1);
  }, [layout.itemsPerLabel]);

  const fitToWidth = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerW = container.clientWidth - 4;
    const baseCanvasW = grid.cols * cellW + padding * 2 + sizeMargin + labelMargin;
    const newZoom = Math.max(0.3, Math.min(3, +(containerW / baseCanvasW).toFixed(2)));
    setZoom(newZoom);
    container.scrollLeft = 0;
    container.scrollTop = 0;
  };

  const canCopyRight = selectedCol < grid.cols - 1;
  const canCopyLeft = selectedCol > 0;
  const canCopyUp = selectedRow > 0;
  const canCopyDown = selectedRow < grid.rows - 1;

  const ctxMenuItem = (label: string, onClick: () => void, disabled = false, hot?: string) => (
    <button
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
        disabled ? "text-slate-300 cursor-default" : "text-slate-700 hover:bg-slate-100"
      }`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onClick();
          setCtxMenu(null);
        }
      }}
    >
      <span>{label}</span>
      {hot && <span className="text-slate-400 text-[10px]">{hot}</span>}
    </button>
  );

  const ctxMenuDivider = () => <div className="border-t border-slate-100 my-1" />;

  const currentDelimState = getDelimiterState();

  const overlayStyle = getOverlayStyle();

  const handleAddPresetText = useCallback(() => {
    const value = newPresetText.trim();
    if (!value) return;
    const texts = value.split(",").map((s) => s.trim());
    addPresetText(texts);
    setNewPresetText("");
  }, [addPresetText, newPresetText]);

  const handleCategoryRenameCommit = useCallback(() => {
    if (!editingCategory) return;
    const nextName = normalizeCategory(editingCategoryDraft);
    if (nextName && nextName !== editingCategory) {
      renamePresetTextCategory(editingCategory, nextName);
      if (activePresetTextCategory === editingCategory) {
        setPresetTextCategory(nextName);
      }
    }
    setEditingCategory(null);
  }, [activePresetTextCategory, editingCategory, editingCategoryDraft, renamePresetTextCategory, setPresetTextCategory]);

  const handleCategoryDrop = useCallback((category: string) => {
    const data = dragDataRef.current;
    if (!data || data.type !== 'text') return;
    movePresetText(data.id, category);
    setPresetTextCategory(category);
    dragDataRef.current = null;
    setDraggedPresetTextId(null);
    setDragOverCategory(null);
  }, [movePresetText, setPresetTextCategory]);

  const handleCategoryReorderDrop = useCallback((targetIndex: number) => {
    const data = dragDataRef.current;
    if (!data || data.type !== 'category') return;
    const fromIndex = categories.indexOf(data.id);
    if (fromIndex < 0 || fromIndex === targetIndex) {
      dragDataRef.current = null;
      setDraggedCategory(null);
      setDragOverCategoryIndex(null);
      return;
    }
    reorderPresetTextCategories(fromIndex, targetIndex);
    dragDataRef.current = null;
    setDraggedCategory(null);
    setDragOverCategoryIndex(null);
  }, [categories, reorderPresetTextCategories]);

  const handleCategoryDelete = useCallback((category: string) => {
    const normalized = normalizeCategory(category);
    const confirmed = window.confirm(
      `カテゴリ「${normalized}」を削除します。\nこのカテゴリ内のラベルもすべて削除されます。\nよろしいですか？`
    );
    if (!confirmed) return;
    deletePresetTextCategory(normalized);
    if (activePresetTextCategory === normalized) {
      const nextCategory = categories.find((item) => item !== normalized) ?? "基本";
      setPresetTextCategory(nextCategory);
    }
  }, [activePresetTextCategory, categories, deletePresetTextCategory, setPresetTextCategory]);

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-lg border border-slate-200">
      {/* プリセットラベル郡 */}
      <div className="border-b border-slate-200 bg-white rounded-t-lg">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-[10px] text-slate-400 shrink-0">📋</span>
          <button
            className={`shrink-0 rounded border px-2 py-1 text-[10px] ${reorderMode ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-500 hover:bg-slate-100"}`}
            onClick={() => {
              setEditingCategory(null);
              setReorderMode((v) => !v);
            }}
            title="並び替えモード"
          >
            ⇅
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            <button className="rounded border border-slate-300 px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 leading-none"
              onClick={() => setPresetTextZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))}>A+</button>
            <span className="text-[10px] text-slate-400 w-7 text-center">{Math.round(presetTextZoom * 100)}%</span>
            <button className="rounded border border-slate-300 px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 leading-none"
              onClick={() => setPresetTextZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}>A−</button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap flex-1">
            {categories.map((category, categoryIndex) => {
              const isActive = category === activePresetTextCategory;
              const isDraggingOver = dragOverCategoryIndex === categoryIndex;
              const isEditing = reorderMode && editingCategory === category;
              if (isEditing) {
                return (
                  <input
                    key={category}
                    autoFocus
                    value={editingCategoryDraft}
                    onChange={(e) => setEditingCategoryDraft(e.target.value)}
                    onBlur={handleCategoryRenameCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCategoryRenameCommit();
                      if (e.key === "Escape") setEditingCategory(null);
                    }}
                    className="shrink-0 min-w-24 rounded-full border border-brand-400 bg-brand-50 px-3 py-1 text-xs text-brand-800 outline-none"
                  />
                );
              }

              return (
                <div
                  key={category}
                  draggable={reorderMode}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition ${
                    isActive
                      ? "border-brand-400 bg-brand-50 text-brand-800 font-semibold"
                      : isDraggingOver
                      ? "border-brand-300 bg-brand-100 text-brand-800"
                      : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
                  } ${reorderMode ? "cursor-grab active:cursor-grabbing" : ""}`}
                  onClick={() => setPresetTextCategory(category)}
                  onDoubleClick={() => {
                    if (!reorderMode) return;
                    setEditingCategory(category);
                    setEditingCategoryDraft(category);
                  }}
                  onDragStart={(e) => {
                    if (!reorderMode) return;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", category);
                    dragDataRef.current = { type: 'category', id: category };
                    setDraggedCategory(category);
                  }}
                  onDragEnd={() => {
                    dragDataRef.current = null;
                    setDraggedCategory(null);
                    setDragOverCategoryIndex(null);
                  }}
                  onDragOver={(e) => {
                    if (!reorderMode) return;
                    const data = dragDataRef.current;
                    if (!data) return;
                    if (data.type === 'category' && data.id === category) return;
                    e.preventDefault();
                    setDragOverCategoryIndex(categoryIndex);
                  }}
                  onDragLeave={() => {
                    if (dragOverCategoryIndex === categoryIndex) setDragOverCategoryIndex(null);
                  }}
                  onDrop={(e) => {
                    if (!reorderMode) return;
                    e.preventDefault();
                    const data = dragDataRef.current;
                    if (!data) return;
                    if (data.type === 'text') {
                      handleCategoryDrop(category);
                    } else if (data.type === 'category') {
                      handleCategoryReorderDrop(categoryIndex);
                    }
                  }}
                  title={reorderMode ? "ドラッグで並び替え / ダブルクリックで改名" : "カテゴリを切り替え"}
                >
                  {reorderMode && (
                    <span className="cursor-grab text-slate-400 hover:text-brand-600">☰</span>
                  )}
                  <span>{category}</span>
                  {reorderMode && (
                    <button
                      type="button"
                      className="rounded-full px-1 py-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategoryDelete(category);
                      }}
                      title="カテゴリとそのラベルを削除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {reorderMode && (
              <button
                type="button"
                className="shrink-0 rounded-full border border-dashed border-brand-300 bg-brand-50 px-3 py-1 text-xs text-brand-700 hover:bg-brand-100"
                onClick={addPresetTextCategory}
                title="新しいカテゴリを追加"
              >
                ＋
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 shrink-0">
            <input
              type="text"
              value={newPresetText}
              onChange={(e) => setNewPresetText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddPresetText();
                }
              }}
              placeholder={`${activePresetTextCategory} に追加`}
              className="w-32 bg-transparent text-xs outline-none placeholder:text-slate-400"
            />
            <button
              className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700"
              onClick={handleAddPresetText}
            >
              追加
            </button>
          </div>
        </div>
        {reorderMode && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between pb-2 text-xs text-amber-700">
              <span className="font-semibold">並び替え中</span>
              <span>タブをドラッグで並び替え / ラベルをドラッグでカテゴリ移動</span>
            </div>
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              タブの削除は、そのカテゴリに属するラベルも一緒に削除されます。
            </div>
          </div>
        )}
        <div className="px-3 py-2 border-t border-slate-100">
          {reorderMode ? (
            <div className="flex items-start gap-1 flex-wrap pb-1">
              {visiblePresetTexts.length === 0 ? (
                <span className="text-xs text-slate-400 shrink-0">このカテゴリにはまだラベルがありません</span>
              ) : (
                visiblePresetTexts.map((p, index) => {
                  const labelText = p.text.filter((t) => t.trim()).join("／") || "(空)";
                  const isDragOverLeft = dragOverTextIndex === index;
                  const isDragOverRight = dragOverTextIndex === index + 1;
                  return (
                    <div key={p.id} className="inline-flex items-center relative">
                      {/* ドロップ位置インジケータ（左側） */}
                      {isDragOverLeft && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-500 rounded-full z-10" />
                      )}
                      <div
                        draggable
                        className={`group inline-flex max-w-full items-center gap-1 whitespace-normal break-words rounded-full border px-2 py-1 leading-tight text-slate-700 cursor-grab active:cursor-grabbing ${
                          isDragOverLeft || isDragOverRight
                            ? "border-brand-400 bg-brand-50 shadow-sm ring-1 ring-brand-300"
                            : "border-slate-300 bg-slate-100 hover:bg-slate-200"
                        }`}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", p.id);
                          dragDataRef.current = { type: 'text', id: p.id };
                          setDraggedPresetTextId(p.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const idx = x < rect.width / 2 ? index : index + 1;
                          setDragOverTextIndex(idx);
                        }}
                        onDragLeave={() => {
                          setDragOverTextIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const data = dragDataRef.current;
                          if (!data || data.type !== 'text') return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const targetIdx = x < rect.width / 2 ? index : index + 1;
                          // 同じカテゴリ内での並び替え: グローバルインデックスを計算
                          const fromGlobal = presetTexts.findIndex((pt) => pt.id === data.id);
                          if (fromGlobal < 0) return;
                          const currentCatItems = presetTexts.filter((pt) => normalizeCategory(pt.category) === activePresetTextCategory);
                          const beforeCount = presetTexts.filter((pt) => normalizeCategory(pt.category) !== activePresetTextCategory || presetTexts.indexOf(pt) < presetTexts.indexOf(currentCatItems[0])).length;
                          const toGlobal = beforeCount + targetIdx;
                          if (fromGlobal === toGlobal || fromGlobal + 1 === toGlobal) {
                            // 動かなくてもエラーにしない
                            dragDataRef.current = null;
                            setDraggedPresetTextId(null);
                            setDragOverTextIndex(null);
                            return;
                          }
                          reorderPresetTexts(fromGlobal, toGlobal > fromGlobal ? toGlobal - 1 : toGlobal);
                          dragDataRef.current = null;
                          setDraggedPresetTextId(null);
                          setDragOverTextIndex(null);
                        }}
                        onDragEnd={() => {
                          dragDataRef.current = null;
                          setDraggedPresetTextId(null);
                          setDragOverCategory(null);
                          setDragOverTextIndex(null);
                        }}
                        style={{ fontSize: `${Math.max(8, 14 * presetTextZoom)}px` }}
                      >
                        <span className="text-slate-400 group-hover:text-brand-600">☰</span>
                        <span>{labelText}</span>
                        <button
                          type="button"
                          className="rounded-full px-1 py-0 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePresetText(p.id);
                          }}
                          title="削除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="flex items-start gap-1 flex-wrap pb-1">
              {visiblePresetTexts.length === 0 ? (
                <span className="text-xs text-slate-400 shrink-0">このカテゴリにはまだラベルがありません</span>
              ) : (
                visiblePresetTexts.map((p) => {
                  const labelText = p.text.filter((t) => t.trim()).join("／") || "(空)";
                  return (
                    <button
                      key={p.id}
                      style={{ fontSize: `${Math.max(8, 14 * presetTextZoom)}px` }}
                      className={`max-w-full whitespace-normal break-words rounded-full border px-3 py-1 leading-tight ${
                        editingCell
                          ? "border-brand-300 bg-brand-50 text-brand-800 font-medium hover:bg-brand-100"
                          : "border-slate-300 bg-slate-100 text-slate-600"
                      }`}
                      onClick={() => {
                        if (!editingCell) return;
                        const rowIdx = selectionRef.current.row >= 0 ? selectionRef.current.row : (editingLine >= 0 ? editingLine : 0);
                        const start = selectionRef.current.row === rowIdx ? selectionRef.current.start : undefined;
                        const end = selectionRef.current.row === rowIdx ? selectionRef.current.end : undefined;
                        applyPresetTextToSelected(p.text, rowIdx, start, end);
                        const inp = inputRefs.current[rowIdx];
                        if (inp) {
                          inp.focus();
                          const insertLen = (p.text[0] ?? "").length;
                          const pos = (start ?? 0) + insertLen;
                          inp.setSelectionRange(pos, pos);
                        }
                      }}
                      title={editingCell ? "クリックでカーソル位置に貼付" : "編集モードでのみ使用可能"}
                    >
                      {labelText}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 全体ビューヘッダ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white">
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
            onClick={fitToWidth}>fit</button>
          <span className="text-slate-300 mx-1">|</span>
          <button className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-100"
            onClick={undo} title="元に戻す (Ctrl+Z)">↩ 戻す</button>
          <button className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
            onClick={clearSelected} title="選択セルをクリア (Del)">🗑 クリア</button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto p-2 cursor-grab active:cursor-grabbing select-none"
        style={{ position: "relative" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{ display: "block" }}
        />

        {/* 編集モード オーバーレイ */}
        {editingCell && editingLabel && (
          <>
            {/* デリミタ切替ボタン（枠外上部、単一バッジ） */}
            <div
              className="absolute z-50"
              style={{
                left: `calc(${overlayStyle.left} + ${overlayStyle.width} / 2 - 28px)`,
                top: `calc(${overlayStyle.top} - 36px)`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="font-bold rounded-full border-2 border-brand-600 bg-white text-brand-700 shadow-md hover:bg-brand-50 leading-none"
                style={{ padding: '4px 12px', fontSize: '25px', whiteSpace: 'nowrap' }}
                onClick={delimiterCycle}
              >
                {getDelimiterDisplay(currentDelimState)}
              </button>
            </div>
            {/* セル編集オーバーレイ */}
            <div
              ref={overlayRef}
              className="z-40 bg-white border-2 border-brand-600 rounded shadow-lg overflow-hidden"
              style={overlayStyle}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {editingLabel.rows.map((row, i) => {
                const isDelim = i === editingDelimIdx;
                const readOnly = isDelim && editingUseDelim && !!layout.delimiter;
                const displayValue = isDelim && editingUseDelim && !!layout.delimiter
                  ? layout.delimiter
                  : row.text;
                return (
                  <div key={i} className="flex items-center"
                    style={{ height: `${(100 / layout.itemsPerLabel).toFixed(2)}%` }}>
                    <span className="text-[8px] text-slate-400 text-right px-0.5 shrink-0"
                      style={{ width: `${12 * zoom}px`, fontSize: `${Math.max(6, 10 * zoom)}px` }}>
                      {i + 1}
                    </span>
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      readOnly={readOnly}
                      className={`flex-1 border-0 px-1 text-xs focus:outline-none focus:bg-blue-50 min-w-0 ${
                        readOnly
                          ? "bg-red-50 text-red-600 font-bold text-center"
                          : !validateCharLimit(row.text, layout.labelSize.widthMm, layout.labelSize.heightMm, layout.itemsPerLabel).ok
                          ? "bg-red-50 text-red-700"
                          : "bg-transparent"
                      }`}
                      style={{ fontSize: `${editingFontSize}px`, height: '100%' }}
                      value={displayValue}
                      onChange={(e) => updateLabelRow(i, e.target.value)}
                      onFocus={() => {
                        setEditingLine(i);
                        selectionRef.current.row = i;
                        const inp = inputRefs.current[i];
                        if (inp) {
                          selectionRef.current.start = inp.selectionStart ?? 0;
                          selectionRef.current.end = inp.selectionEnd ?? 0;
                        }
                        if (selectedRow !== editingCell.row || selectedCol !== editingCell.col) {
                          selectLabel(editingCell.row, editingCell.col);
                        }
                      }}
                      onSelect={() => {
                        const inp = inputRefs.current[i];
                        if (inp) {
                          selectionRef.current = { start: inp.selectionStart ?? 0, end: inp.selectionEnd ?? 0, row: i };
                        }
                      }}
                      onMouseUp={() => {
                        const inp = inputRefs.current[i];
                        if (inp) {
                          selectionRef.current = { start: inp.selectionStart ?? 0, end: inp.selectionEnd ?? 0, row: i };
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditingCell(null);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-slate-200 bg-white rounded-b-lg text-xs text-slate-600">
        選択: {selectedRow + 1}-{selectedCol + 1}
        {editingCell && " (編集モード)"}
        {selectedCells.size > 1 && ` (複数: ${selectedCells.size}セル)`}
        （{grid.cols * grid.rows}面中）
        <span className="ml-2 text-slate-400">ダブルクリックで編集 | 右クリックでメニュー | Ctrl/Shift+クリックで複数選択 | ドラッグで移動 | Delでクリア | Ctrl+Zで戻す</span>
      </div>

      {/* 右クリックメニュー */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenuItem("コピー", () => copyToClipboard())}
          {ctxMenuDivider()}
          {ctxMenuItem("右にコピー", () => copyTo("right"), !canCopyRight)}
          {ctxMenuItem("左にコピー", () => copyTo("left"), !canCopyLeft)}
          {ctxMenuItem("上にコピー", () => copyTo("up"), !canCopyUp)}
          {ctxMenuItem("下にコピー", () => copyTo("down"), !canCopyDown)}
          {ctxMenuDivider()}
          {ctxMenuItem("反転コピー", () => reverseCopyToClipboard())}
          {ctxMenuDivider()}
          {ctxMenuItem("右に反転コピー", () => reverseTo("right"), !canCopyRight)}
          {ctxMenuItem("左に反転コピー", () => reverseTo("left"), !canCopyLeft)}
          {ctxMenuItem("上に反転コピー", () => reverseTo("up"), !canCopyUp)}
          {ctxMenuItem("下に反転コピー", () => reverseTo("down"), !canCopyDown)}
          {clipboard && ctxMenuDivider()}
          {clipboard && clipboardMode === "copy" &&
            ctxMenuItem("貼り付け", () => pasteFromClipboard())
          }
          {clipboard && clipboardMode === "reverse" &&
            ctxMenuItem("反転貼り付け", () => pasteFromClipboard())
          }
        </div>
      )}
    </div>
  );
}
