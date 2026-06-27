import { create } from "zustand";
import type {
  SheetGrid,
  Label,
  LayoutConfig,
  ExportConfig,
  ReverseDirection,
  Preset,
  SizePreset,
} from "./types";
import { getDelimiterRowIndex } from "./delimiter";
import { buildReversedLabel } from "./reverse";
import { DEFAULT_PRESETS } from "./presets";
import { DEFAULT_SIZE_PRESETS } from "./size-presets";

let labelIdCounter = 0;
function nextId(): string {
  labelIdCounter++;
  return `label-${labelIdCounter}`;
}

function createEmptyLabel(itemsPerLabel: number): Label {
  return {
    id: nextId(),
    rows: Array.from({ length: itemsPerLabel }, () => ({ text: "" })),
    useDelimiter: true,
  };
}

function createEmptyGrid(
  cols: number,
  rows: number,
  itemsPerLabel: number
): SheetGrid {
  const labels: Label[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Label[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(createEmptyLabel(itemsPerLabel));
    }
    labels.push(row);
  }
  return { cols, rows, labels };
}

function cloneGrid(grid: SheetGrid): SheetGrid {
  return {
    ...grid,
    labels: grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    ),
  };
}

/** 選択セルのキー */
function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

interface AppState {
  layout: LayoutConfig;
  grid: SheetGrid;
  selectedRow: number;
  selectedCol: number;
  selectedCells: Set<string>; // 複数選択
  exportConfig: ExportConfig;
  presets: typeof DEFAULT_PRESETS;
  sizePresets: SizePreset[];
  clipboard: string[] | null;
  clipboardMode: "copy" | "reverse" | null; // クリップボードの種類
  history: SheetGrid[]; // undo 用履歴
  historyIndex: number;

  setLayout: (layout: Partial<LayoutConfig>) => void;
  applyPreset: (index: number) => void;
  selectLabel: (row: number, col: number, ctrl?: boolean) => void;
  selectAll: () => void;
  updateLabelRow: (labelRow: number, text: string) => void;
  toggleLabelDelimiter: () => void;
  reverseTo: (direction: ReverseDirection) => void;
  reverseCopyToClipboard: () => void;
  copyTo: (direction: ReverseDirection) => void;
  copyToClipboard: () => void;
  pasteFromClipboard: () => void;
  clearSelected: () => void;
  undo: () => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
  addPreset: (name: string) => void;
  deletePreset: (index: number) => void;
  addSizePreset: (name: string) => void;
  deleteSizePreset: (index: number) => void;
  applySizePreset: (index: number) => void;
}

const initialLayout: LayoutConfig = DEFAULT_PRESETS[0].layout;

const initialGrid = createEmptyGrid(
  initialLayout.blockCols,
  initialLayout.blockRows,
  initialLayout.itemsPerLabel
);

function pushHistory(state: AppState): Partial<AppState> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(cloneGrid(state.grid));
  // 最大50件
  if (newHistory.length > 50) newHistory.shift();
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

export const useStore = create<AppState>((set, get) => ({
  layout: initialLayout,
  grid: initialGrid,
  selectedRow: 0,
  selectedCol: 0,
  selectedCells: new Set<string>(),
  exportConfig: {
    encoding: "shift_jis",
    withHeader: true,
    headerNames: [],
  },
  presets: DEFAULT_PRESETS,
  sizePresets: DEFAULT_SIZE_PRESETS,
  clipboard: null,
  clipboardMode: null,
  history: [cloneGrid(initialGrid)],
  historyIndex: 0,

  setLayout: (partial) => {
    const newLayout = { ...get().layout, ...partial };
    const newGrid = createEmptyGrid(
      newLayout.blockCols,
      newLayout.blockRows,
      newLayout.itemsPerLabel
    );
    const hist = pushHistory(get());
    set({
      ...hist,
      layout: newLayout,
      grid: newGrid,
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
    });
  },

  applyPreset: (index) => {
    const preset = get().presets[index];
    if (!preset) return;
    const newGrid = createEmptyGrid(
      preset.layout.blockCols,
      preset.layout.blockRows,
      preset.layout.itemsPerLabel
    );
    const hist = pushHistory(get());
    set({
      ...hist,
      layout: { ...preset.layout },
      grid: newGrid,
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
    });
  },

  selectLabel: (row, col, ctrl) => {
    const { selectedCells } = get();
    if (ctrl) {
      const key = cellKey(row, col);
      const next = new Set(selectedCells);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      set({ selectedRow: row, selectedCol: col, selectedCells: next });
    } else {
      set({
        selectedRow: row,
        selectedCol: col,
        selectedCells: new Set<string>([cellKey(row, col)]),
      });
    }
  },

  selectAll: () => {
    const { grid } = get();
    const all = new Set<string>();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        all.add(cellKey(r, c));
      }
    }
    set({ selectedCells: all });
  },

  updateLabelRow: (labelRow, text) => {
    const { grid, selectedRow, selectedCol } = get();
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    const label = newLabels[selectedRow]?.[selectedCol];
    if (label && labelRow >= 0 && labelRow < label.rows.length) {
      label.rows[labelRow].text = text;
    }
    const hist = pushHistory(get());
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  toggleLabelDelimiter: () => {
    const { grid, selectedRow, selectedCol } = get();
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({ ...l }))
    );
    const label = newLabels[selectedRow]?.[selectedCol];
    if (label) {
      label.useDelimiter = !(label.useDelimiter ?? true);
    }
    const hist = pushHistory(get());
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  reverseTo: (direction) => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    const useDelim = sourceLabel.useDelimiter ?? true;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
      : -1;
    const used = sourceLabel.rows.some(
      (row, i) => i !== delimIdx && row.text.trim() !== ""
    );
    const sourceTexts = sourceLabel.rows.map((r, i) =>
      i === delimIdx && used ? layout.delimiter : r.text
    );
    const reversed = buildReversedLabel(sourceTexts, layout.delimiter);
    if (!reversed) return;

    let targetRow = selectedRow;
    let targetCol = selectedCol;
    switch (direction) {
      case "right": targetCol = selectedCol + 1; break;
      case "left": targetCol = selectedCol - 1; break;
      case "down": targetRow = selectedRow + 1; break;
      case "up": targetRow = selectedRow - 1; break;
    }

    if (targetRow < 0 || targetRow >= grid.rows || targetCol < 0 || targetCol >= grid.cols) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    const targetLabel = newLabels[targetRow][targetCol];
    for (let i = 0; i < targetLabel.rows.length; i++) {
      targetLabel.rows[i].text = reversed[i] ?? "";
    }
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  reverseCopyToClipboard: () => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    const useDelim = sourceLabel.useDelimiter ?? true;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
      : -1;
    const used = sourceLabel.rows.some(
      (row, i) => i !== delimIdx && row.text.trim() !== ""
    );
    const sourceTexts = sourceLabel.rows.map((r, i) =>
      i === delimIdx && used ? layout.delimiter : r.text
    );
    const reversed = buildReversedLabel(sourceTexts, layout.delimiter);
    if (!reversed) return;
    set({ clipboard: reversed, clipboardMode: "reverse" });
  },

  copyTo: (direction) => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    let targetRow = selectedRow;
    let targetCol = selectedCol;
    switch (direction) {
      case "right": targetCol = selectedCol + 1; break;
      case "left": targetCol = selectedCol - 1; break;
      case "down": targetRow = selectedRow + 1; break;
      case "up": targetRow = selectedRow - 1; break;
    }

    if (targetRow < 0 || targetRow >= grid.rows || targetCol < 0 || targetCol >= grid.cols) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    const targetLabel = newLabels[targetRow][targetCol];
    const useDelim = sourceLabel.useDelimiter ?? true;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
      : -1;
    const used = sourceLabel.rows.some(
      (row, i) => i !== delimIdx && row.text.trim() !== ""
    );
    for (let i = 0; i < targetLabel.rows.length; i++) {
      if (i === delimIdx && used) {
        targetLabel.rows[i].text = layout.delimiter;
      } else {
        targetLabel.rows[i].text = sourceLabel.rows[i]?.text ?? "";
      }
    }
    targetLabel.useDelimiter = sourceLabel.useDelimiter;
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  copyToClipboard: () => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    const useDelim = sourceLabel.useDelimiter ?? true;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
      : -1;
    const used = sourceLabel.rows.some(
      (row, i) => i !== delimIdx && row.text.trim() !== ""
    );
    const texts = sourceLabel.rows.map((r, i) =>
      i === delimIdx && used ? layout.delimiter : r.text
    );
    set({ clipboard: texts, clipboardMode: "copy" });
  },

  pasteFromClipboard: () => {
    const { grid, selectedCells, clipboard } = get();
    if (!clipboard) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );

    // 複数選択されたセルすべてに貼り付け
    for (const key of selectedCells) {
      const [r, c] = key.split(",").map(Number);
      const targetLabel = newLabels[r]?.[c];
      if (!targetLabel) continue;
      for (let i = 0; i < targetLabel.rows.length; i++) {
        targetLabel.rows[i].text = clipboard[i] ?? "";
      }
    }
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  clearSelected: () => {
    const { grid, selectedCells } = get();
    if (selectedCells.size === 0) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    for (const key of selectedCells) {
      const [r, c] = key.split(",").map(Number);
      const targetLabel = newLabels[r]?.[c];
      if (!targetLabel) continue;
      for (let i = 0; i < targetLabel.rows.length; i++) {
        targetLabel.rows[i].text = "";
      }
    }
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const prevGrid = cloneGrid(history[newIndex]);
    set({ grid: prevGrid, historyIndex: newIndex });
  },

  setExportConfig: (partial) => {
    set({ exportConfig: { ...get().exportConfig, ...partial } });
  },

  addPreset: (name) => {
    const { layout, presets } = get();
    const newPreset: Preset = { name, layout: { ...layout } };
    set({ presets: [...presets, newPreset] });
  },

  deletePreset: (index) => {
    const { presets } = get();
    if (index < DEFAULT_PRESETS.length) return;
    set({ presets: presets.filter((_, i) => i !== index) });
  },

  addSizePreset: (name) => {
    const { layout, sizePresets } = get();
    const newSizePreset: SizePreset = {
      name,
      labelSize: { ...layout.labelSize },
    };
    set({ sizePresets: [...sizePresets, newSizePreset] });
  },

  deleteSizePreset: (index) => {
    const { sizePresets } = get();
    if (index < DEFAULT_SIZE_PRESETS.length) return;
    set({ sizePresets: sizePresets.filter((_, i) => i !== index) });
  },

  applySizePreset: (index) => {
    const { sizePresets } = get();
    const preset = sizePresets[index];
    if (!preset) return;
    set({ layout: { ...get().layout, labelSize: { ...preset.labelSize } } });
  },
}));

export { getDelimiterRowIndex };
