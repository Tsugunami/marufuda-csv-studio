import { create } from "zustand";
import type {
  SheetGrid,
  Label,
  LayoutConfig,
  ExportConfig,
  ReverseDirection,
  Preset,
  SizePreset,
  PresetTextItem,
  DelimiterAlign,
} from "./types";
import { getDelimiterRowIndex, isDelimiterText } from "./delimiter";
import { buildReversedLabel } from "./reverse";
import { DEFAULT_PRESETS } from "./presets";
import { DEFAULT_SIZE_PRESETS } from "./size-presets";
import { DEFAULT_PRESET_TEXTS } from "./preset-texts";

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

/** プロジェクト保存・再開用データ */
export interface ProjectData {
  version: number;
  grid: SheetGrid;
  layout: LayoutConfig;
  presets: Preset[];
  sizePresets: SizePreset[];
  presetTexts: PresetTextItem[];
  exportConfig: ExportConfig;
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
  presetTexts: PresetTextItem[];
  clipboard: string[] | null;
  clipboardMode: "copy" | "reverse" | null; // クリップボードの種類
    history: SheetGrid[]; // undo 用履歴
  historyIndex: number;
  csvFilename: string; // 出力CSVファイル名

  setLayout: (layout: Partial<LayoutConfig>) => void;
  applyPreset: (index: number) => void;
  selectLabel: (row: number, col: number, multi?: boolean, range?: boolean) => void;
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
  overwritePreset: (index: number) => void;
  addPresetText: (texts: string[]) => void;
  deletePresetText: (id: string) => void;
  reorderPresetTexts: (from: number, to: number) => void;
  resetPresetTexts: () => void;
  applyPresetTextToSelected: (texts: string[], rowIndex?: number, cursorStart?: number, cursorEnd?: number) => void;
  addSizePreset: (name: string) => void;
  deleteSizePreset: (index: number) => void;
  applySizePreset: (index: number) => void;
  resetPresets: () => void;
  resetSizePresets: () => void;
  setCsvFilename: (name: string) => void;
  importCsvData: (rows: string[][], hasHeader: boolean, newLayout?: LayoutConfig) => boolean;
  hasExistingData: () => boolean;
  getProjectData: () => ProjectData;
  loadProjectData: (data: ProjectData) => void;
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
  presetTexts: DEFAULT_PRESET_TEXTS,
  clipboard: null,
  clipboardMode: null,
    history: [cloneGrid(initialGrid)],
  historyIndex: 0,
  csvFilename: "",

    setLayout: (partial) => {
    const oldLayout = get().layout;
    const newLayout = { ...oldLayout, ...partial };
    const structChanged =
      oldLayout.blockCols !== newLayout.blockCols ||
      oldLayout.blockRows !== newLayout.blockRows ||
      oldLayout.itemsPerLabel !== newLayout.itemsPerLabel;

    if (structChanged) {
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
    } else {
      // ブロック構造が変わらない場合はデータを保持
      set({ layout: newLayout });
    }
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

        selectLabel: (row, col, multi, range) => {
    const { selectedCells, selectedRow, selectedCol } = get();
    if (range) {
      // Shift+クリック: 前回選択セルから今回クリックセルまでの矩形範囲をすべて選択
      const minRow = Math.min(selectedRow, row);
      const maxRow = Math.max(selectedRow, row);
      const minCol = Math.min(selectedCol, col);
      const maxCol = Math.max(selectedCol, col);
      const next = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          next.add(cellKey(r, c));
        }
      }
      set({ selectedRow: row, selectedCol: col, selectedCells: next });
    } else if (multi) {
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
        // 貼り付け後はクリップボードをクリアしてコピーボタンに戻す
    set({ ...hist, grid: { ...grid, labels: newLabels }, clipboard: null, clipboardMode: null });
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
    set({ presets: presets.filter((_, i) => i !== index) });
  },

  overwritePreset: (index) => {
    const { layout, presets } = get();
    const preset = presets[index];
    if (!preset) return;
    const updated = [...presets];
    updated[index] = { ...preset, layout: { ...layout } };
    set({ presets: updated });
  },

  addPresetText: (texts) => {
    const { presetTexts, layout } = get();
    const padded = Array.from({ length: layout.itemsPerLabel }, (_, i) => texts[i] ?? "");
    const item: PresetTextItem = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: padded,
    };
    set({ presetTexts: [...presetTexts, item] });
  },

  deletePresetText: (id) => {
    const { presetTexts } = get();
    set({ presetTexts: presetTexts.filter((p) => p.id !== id) });
  },

  reorderPresetTexts: (from, to) => {
    const { presetTexts } = get();
    const updated = [...presetTexts];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    set({ presetTexts: updated });
  },

  resetPresetTexts: () => {
    set({ presetTexts: [...DEFAULT_PRESET_TEXTS] });
  },

  applyPresetTextToSelected: (texts, rowIndex, cursorStart, cursorEnd) => {
    const { grid, selectedRow, selectedCol } = get();
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    const label = newLabels[selectedRow]?.[selectedCol];
    if (!label) return;
    const targetRow = rowIndex !== undefined && rowIndex >= 0 && rowIndex < label.rows.length
      ? rowIndex : 0;
    const current = label.rows[targetRow].text;
    const start = cursorStart ?? current.length;
    const end = cursorEnd ?? start;
    // カーソル位置に挿入（選択範囲があれば置換）
    label.rows[targetRow].text = current.slice(0, start) + (texts[0] ?? "") + current.slice(end);
    const hist = pushHistory(get());
    set({ ...hist, grid: { ...grid, labels: newLabels } });
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
    set({ sizePresets: sizePresets.filter((_, i) => i !== index) });
  },

      applySizePreset: (index) => {
    const { sizePresets, setLayout } = get();
    const preset = sizePresets[index];
    if (!preset) return;
    setLayout({ labelSize: { ...preset.labelSize } });
  },

  resetPresets: () => {
    set({ presets: [...DEFAULT_PRESETS] });
  },

    resetSizePresets: () => {
    set({ sizePresets: [...DEFAULT_SIZE_PRESETS] });
  },

  setCsvFilename: (name) => {
    set({ csvFilename: name });
  },

  hasExistingData: () => {
    const { grid } = get();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const label = grid.labels[r]?.[c];
        if (!label) continue;
        if (label.rows.some((row) => row.text.trim() !== "")) return true;
      }
    }
    return false;
  },

    importCsvData: (rows, hasHeader, newLayout) => {
    const state = get();
    const layout = newLayout ? { ...newLayout } : { ...state.layout };
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const itemsPerLabel = layout.itemsPerLabel;
    const blockCols = layout.blockCols;
    const blockRows = layout.blockRows;
    const totalLabels = blockCols * blockRows;

    // データ行数が totalLabels 未満の場合でも許容（不足分は空ラベルで埋める）
    if (dataRows.length > totalLabels) return false;

    // 第1パス: 最初のデリミタを検出し、delimiter と delimiterAlign を決定
    let detectedDelimiter: string | null = null;
    let detectedAlign: DelimiterAlign | null = null;

    for (let i = 0; i < dataRows.length && detectedDelimiter === null; i++) {
      const csvRow = dataRows[i] || [];
      for (let j = 0; j < csvRow.length && j < itemsPerLabel; j++) {
        if (isDelimiterText(csvRow[j])) {
          detectedDelimiter = csvRow[j].trim();
          if (itemsPerLabel % 2 === 1) {
            detectedAlign = "center";
          } else {
            const half = itemsPerLabel / 2;
            if (j === half - 1) {
              detectedAlign = "self";
            } else if (j === half) {
              detectedAlign = "partner";
            } else {
              detectedAlign = layout.delimiterAlign;
            }
          }
          break;
        }
      }
    }

    // 検出したデリミタと寄せをレイアウトに反映
    if (detectedDelimiter !== null) {
      layout.delimiter = detectedDelimiter;
    }
    if (detectedAlign !== null) {
      layout.delimiterAlign = detectedAlign;
    }

    // デリミタ挿入位置の計算
    const expectedDelimIdx = layout.delimiter
      ? getDelimiterRowIndex(itemsPerLabel, layout.delimiterAlign)
      : -1;

    // 第2パス: グリッド構築
    const labels: Label[][] = [];
    for (let r = 0; r < blockRows; r++) {
      const row: Label[] = [];
      for (let c = 0; c < blockCols; c++) {
        const idx = r * blockCols + c;
        const csvRow = dataRows[idx] || [];

        // このラベルにデリミタが含まれているかチェック
        let hasDelim = false;
        let delimPos = -1;
        for (let i = 0; i < itemsPerLabel; i++) {
          if (isDelimiterText(csvRow[i] ?? "")) {
            hasDelim = true;
            delimPos = i;
            break;
          }
        }

        const labelRows = Array.from({ length: itemsPerLabel }, (_, i) => {
          const text = csvRow[i] ?? "";
          // デリミタ行のテキストはクリア（表示時に layout.delimiter で自動補完される）
          if (hasDelim && i === delimPos) {
            return { text: "" };
          }
          return { text };
        });

        row.push({
          id: nextId(),
          rows: labelRows,
          useDelimiter: hasDelim,
        });
      }
      labels.push(row);
    }
    const newGrid: SheetGrid = { cols: blockCols, rows: blockRows, labels };

    const hist = {
      history: [cloneGrid(newGrid)],
      historyIndex: 0,
    };
    set({
      ...hist,
      layout,
      grid: newGrid,
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
      clipboard: null,
      clipboardMode: null,
    });
    return true;
  },

  getProjectData: () => {
    const { grid, layout, presets, sizePresets, presetTexts, exportConfig } = get();
    return {
      version: 2,
      grid: cloneGrid(grid),
      layout: { ...layout },
      presets: presets.map((p) => ({ name: p.name, layout: { ...p.layout } })),
      sizePresets: sizePresets.map((p) => ({
        name: p.name,
        labelSize: { ...p.labelSize },
      })),
      presetTexts: presetTexts.map((p) => ({ id: p.id, text: [...p.text] })),
      exportConfig: { ...exportConfig },
    };
  },

  loadProjectData: (data) => {
    const newGrid = cloneGrid(data.grid);
    set({
      grid: newGrid,
      layout: { ...data.layout },
      presets: data.presets.map((p) => ({ name: p.name, layout: { ...p.layout } })),
      sizePresets: data.sizePresets.map((p) => ({
        name: p.name,
        labelSize: { ...p.labelSize },
      })),
      presetTexts: data.presetTexts
        ? data.presetTexts.map((p: any) => ({ id: p.id, text: [...p.text] }))
        : [],
      exportConfig: { ...data.exportConfig },
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
      clipboard: null,
      clipboardMode: null,
      history: [cloneGrid(newGrid)],
      historyIndex: 0,
    });
  },
}));

export { getDelimiterRowIndex };
