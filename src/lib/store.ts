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

const DEFAULT_PRESET_TEXT_CATEGORY = "基本";
const FALLBACK_PRESET_TEXT_CATEGORY = "未分類";

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

export function createEmptyGrid(
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

function normalizePresetTextCategory(category?: string): string {
  const normalized = category?.trim();
  return normalized ? normalized : FALLBACK_PRESET_TEXT_CATEGORY;
}

function normalizePresetTextItem(item: PresetTextItem): PresetTextItem {
  return {
    id: item.id,
    text: [...item.text],
    category: normalizePresetTextCategory(item.category),
  };
}

function uniquePresetTextCategories(items: PresetTextItem[], selectedCategory?: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const pushCategory = (category: string | undefined) => {
    const normalized = normalizePresetTextCategory(category);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };
  if (selectedCategory) pushCategory(selectedCategory);
  for (const item of items) {
    pushCategory(item.category);
  }
  if (result.length === 0) result.push(DEFAULT_PRESET_TEXT_CATEGORY);
  return result;
}

function normalizePresetTextCategories(categories: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const category of categories) {
    const normalized = normalizePresetTextCategory(category);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  if (result.length === 0) result.push(DEFAULT_PRESET_TEXT_CATEGORY);
  return result;
}

function movePresetTextItem(
  items: PresetTextItem[],
  id: string,
  targetCategory: string,
  targetIndex?: number
): PresetTextItem[] {
  const normalizedTargetCategory = normalizePresetTextCategory(targetCategory);
  const sourceIndex = items.findIndex((item) => item.id === id);
  if (sourceIndex < 0) return items;

  const nextItems = items.map((item) => normalizePresetTextItem(item));
  const [moved] = nextItems.splice(sourceIndex, 1);
  moved.category = normalizedTargetCategory;

  const categoryItems = nextItems.filter((item) => normalizePresetTextCategory(item.category) === normalizedTargetCategory);
  const insertIndex = targetIndex === undefined
    ? categoryItems.length
    : Math.max(0, Math.min(targetIndex, categoryItems.length));

  if (insertIndex >= categoryItems.length) {
    const lastIndex = nextItems.reduce((last, item, index) => {
      return normalizePresetTextCategory(item.category) === normalizedTargetCategory ? index : last;
    }, -1);
    if (lastIndex === -1) {
      nextItems.push(moved);
      return nextItems;
    }
    nextItems.splice(lastIndex + 1, 0, moved);
    return nextItems;
  }

  let seen = 0;
  for (let i = 0; i < nextItems.length; i++) {
    if (normalizePresetTextCategory(nextItems[i].category) !== normalizedTargetCategory) continue;
    if (seen === insertIndex) {
      nextItems.splice(i, 0, moved);
      return nextItems;
    }
    seen++;
  }

  nextItems.push(moved);
  return nextItems;
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
  presetTextCategories?: string[];
  exportConfig: ExportConfig;
  reusableSheetId?: string | null;
  usedCells?: string[];
}

interface AppState {
  layout: LayoutConfig;
  grid: SheetGrid;
  selectedRow: number;
  selectedCol: number;
  selectedCells: Set<string>; // 複数選択
  usedCells: Set<string>; // 物理的に使用済みのラベル位置
  reusableSheetId: string | null;
  exportConfig: ExportConfig;
  presets: typeof DEFAULT_PRESETS;
  sizePresets: SizePreset[];
  presetTexts: PresetTextItem[];
  presetTextCategories: string[];
  selectedPresetTextCategory: string;
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
  reorderPresets: (from: number, to: number) => void;
  addPresetText: (texts: string[]) => void;
  deletePresetText: (id: string) => void;
  reorderPresetTexts: (from: number, to: number) => void;
  reorderPresetTextCategories: (from: number, to: number) => void;
  resetPresetTexts: () => void;
  addPresetTextCategory: () => void;
  deletePresetTextCategory: (category: string) => void;
  setPresetTextCategory: (category: string) => void;
  renamePresetTextCategory: (from: string, to: string) => void;
  movePresetText: (id: string, targetCategory: string, targetIndex?: number) => void;
  applyPresetTextToSelected: (texts: string[], rowIndex?: number, cursorStart?: number, cursorEnd?: number) => void;
  addSizePreset: (name: string) => void;
  deleteSizePreset: (index: number) => void;
  applySizePreset: (index: number) => void;
  resetPresets: () => void;
  resetSizePresets: () => void;
  setCsvFilename: (name: string) => void;
  importCsvData: (rows: string[][], hasHeader: boolean, newLayout?: LayoutConfig) => boolean;
  hasExistingData: () => boolean;
  startNewProject: (layout: LayoutConfig, usedCells?: string[], reusableSheetId?: string | null) => void;
  markFilledCellsUsed: () => string[];
  getProjectData: () => ProjectData;
  loadProjectData: (data: ProjectData, keepPresets?: boolean) => void;
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
  usedCells: new Set<string>(),
  reusableSheetId: null,
  exportConfig: {
    encoding: "shift_jis",
    withHeader: true,
    headerNames: [],
  },
  presets: DEFAULT_PRESETS,
  sizePresets: DEFAULT_SIZE_PRESETS,
  presetTexts: DEFAULT_PRESET_TEXTS,
  presetTextCategories: [DEFAULT_PRESET_TEXT_CATEGORY],
  selectedPresetTextCategory: DEFAULT_PRESET_TEXT_CATEGORY,
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
      oldLayout.itemsPerLabel !== newLayout.itemsPerLabel ||
      oldLayout.labelSize.widthMm !== newLayout.labelSize.widthMm ||
      oldLayout.labelSize.heightMm !== newLayout.labelSize.heightMm;

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
        usedCells: structChanged ? new Set<string>() : get().usedCells,
        reusableSheetId: structChanged ? null : get().reusableSheetId,
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
    // ラベルごとの接続詞状態を復元（保存されていないプリセットは全ONのまま）
    if (preset.labelDelimiters) {
      for (let r = 0; r < newGrid.labels.length; r++) {
        for (let c = 0; c < newGrid.labels[r].length; c++) {
          const rowData = preset.labelDelimiters[r];
          if (rowData && c < rowData.length) {
            newGrid.labels[r][c].useDelimiter = rowData[c];
          }
        }
      }
    }
    const hist = pushHistory(get());
    set({
      ...hist,
      layout: { ...preset.layout },
      grid: newGrid,
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
      usedCells: new Set<string>(),
      reusableSheetId: null,
    });
  },

        selectLabel: (row, col, multi, range) => {
    const { selectedCells, selectedRow, selectedCol, usedCells } = get();
    if (usedCells.has(cellKey(row, col))) return;
    if (range) {
      // Shift+クリック: 前回選択セルから今回クリックセルまでの矩形範囲をすべて選択
      const minRow = Math.min(selectedRow, row);
      const maxRow = Math.max(selectedRow, row);
      const minCol = Math.min(selectedCol, col);
      const maxCol = Math.max(selectedCol, col);
      const next = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (!usedCells.has(cellKey(r, c))) next.add(cellKey(r, c));
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
    const { grid, usedCells } = get();
    const all = new Set<string>();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!usedCells.has(cellKey(r, c))) all.add(cellKey(r, c));
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
    const state = get();
    const { grid, selectedRow, selectedCol, selectedCells } = state;
    // 複数選択があればその全セル、なければ現在の単一セル
    const targetKeys =
      selectedCells.size > 0
        ? selectedCells
        : new Set<string>([`${selectedRow},${selectedCol}`]);
    if (targetKeys.size === 0) return;

    // 最初のターゲットから新しいON/OFF状態を決定
    const firstKey = targetKeys.values().next().value as string;
    const [fr, fc] = firstKey.split(",").map(Number);
    const firstLabel = grid.labels[fr]?.[fc];
    if (!firstLabel) return;
    const newState = !(firstLabel.useDelimiter ?? true);

    // clearSelected と同じ deep clone パターン
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );

    for (const key of targetKeys) {
      const [r, c] = key.split(",").map(Number);
      const targetLabel = newLabels[r]?.[c];
      if (!targetLabel) continue;
      targetLabel.useDelimiter = newState;
    }

    const hist = pushHistory(get());
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  reverseTo: (direction) => {
    const { grid, selectedRow, selectedCol, layout, usedCells } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    const useDelim = sourceLabel.useDelimiter ?? true;
    const sourceAlign = sourceLabel.delimiterAlign ?? layout.delimiterAlign;
    // デリミタ位置を計算（～はテキスト保存されていないため buildReversedLabel 非使用）
    if (!useDelim || !layout.delimiter) return;
    const delimIdx = getDelimiterRowIndex(layout.itemsPerLabel, sourceAlign);

    // 前ブロック rows[0..delimIdx-1]、後ブロック rows[delimIdx+1..n-1]
    // 反転時はブロック内の上下も反転させる（行0↔行n-1 のミラー）
    const n = layout.itemsPerLabel;
    const beforeRows = sourceLabel.rows.slice(0, delimIdx).map((r) => ({ text: r.text })).reverse();
    const afterRows = sourceLabel.rows.slice(delimIdx + 1).map((r) => ({ text: r.text })).reverse();

    let targetRow = selectedRow;
    let targetCol = selectedCol;
    switch (direction) {
      case "right": targetCol = selectedCol + 1; break;
      case "left": targetCol = selectedCol - 1; break;
      case "down": targetRow = selectedRow + 1; break;
      case "up": targetRow = selectedRow - 1; break;
    }
    if (targetRow < 0 || targetRow >= grid.rows || targetCol < 0 || targetCol >= grid.cols) return;
    if (usedCells.has(cellKey(targetRow, targetCol))) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    const targetLabel = newLabels[targetRow][targetCol];
    // デリミタ位置を反転
    const newAlign = sourceAlign === "self" ? "partner" : sourceAlign === "partner" ? "self" : sourceAlign;
    const newDelimIdx = getDelimiterRowIndex(n, newAlign);
    // 新しい並び: [afterRows][delimiter(空)][beforeRows]
    const newRows: { text: string }[] = [];
    let ai = 0, bi = 0;
    for (let i = 0; i < n; i++) {
      if (i === newDelimIdx) {
        newRows.push({ text: "" }); // ～は保存しない
      } else if (i < newDelimIdx) {
        newRows.push(afterRows[ai] ?? { text: "" });
        ai++;
      } else {
        newRows.push(beforeRows[bi] ?? { text: "" });
        bi++;
      }
    }
    targetLabel.rows = newRows;
    targetLabel.delimiterAlign = newAlign;
    targetLabel.useDelimiter = true;
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  reverseCopyToClipboard: () => {
    const { grid, selectedRow, selectedCol, layout, usedCells } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    const useDelim = sourceLabel.useDelimiter ?? true;
    const sourceAlign = sourceLabel.delimiterAlign ?? layout.delimiterAlign;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, sourceAlign)
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
    const { grid, selectedRow, selectedCol, layout, usedCells } = get();
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
    if (usedCells.has(cellKey(targetRow, targetCol))) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );
    const targetLabel = newLabels[targetRow][targetCol];
    const useDelim = sourceLabel.useDelimiter ?? true;
    const sourceAlign = sourceLabel.delimiterAlign ?? layout.delimiterAlign;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, sourceAlign)
      : -1;
    const used = sourceLabel.rows.some(
      (row, i) => i !== delimIdx && row.text.trim() !== ""
    );
    for (let i = 0; i < targetLabel.rows.length; i++) {
      // デリミタ文字はテキスト保存しない（表示時に自動補完）
      targetLabel.rows[i].text = (i === delimIdx && used) ? "" : (sourceLabel.rows[i]?.text ?? "");
    }
    targetLabel.useDelimiter = sourceLabel.useDelimiter;
    targetLabel.delimiterAlign = sourceLabel.delimiterAlign;
    set({ ...hist, grid: { ...grid, labels: newLabels } });
  },

  copyToClipboard: () => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    const useDelim = sourceLabel.useDelimiter ?? true;
    const sourceAlign = sourceLabel.delimiterAlign ?? layout.delimiterAlign;
    const delimIdx = useDelim && layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, sourceAlign)
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
    const { grid, selectedCells, clipboard, usedCells } = get();
    if (!clipboard) return;

    const hist = pushHistory(get());
    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );

    // 複数選択されたセルすべてに貼り付け（デリミタ文字は保存しない）。
    // クリップボードは保持し、連続貼り付けを可能にする。
    for (const key of selectedCells) {
      const [r, c] = key.split(",").map(Number);
      if (usedCells.has(key)) continue;
      const targetLabel = newLabels[r]?.[c];
      if (!targetLabel) continue;
      for (let i = 0; i < targetLabel.rows.length; i++) {
        const text = clipboard[i] ?? "";
        targetLabel.rows[i].text = isDelimiterText(text) ? "" : text;
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
    const { layout, presets, grid } = get();
    // ラベルごとの接続詞状態を保存
    const labelDelimiters = grid.labels.map((rowArr) =>
      rowArr.map((l) => l.useDelimiter ?? true)
    );
    const newPreset: Preset = { name, layout: { ...layout }, labelDelimiters };
    set({ presets: [...presets, newPreset] });
  },

    deletePreset: (index) => {
    const { presets } = get();
    set({ presets: presets.filter((_, i) => i !== index) });
  },

  overwritePreset: (index) => {
    const { layout, presets, grid } = get();
    const preset = presets[index];
    if (!preset) return;
    const labelDelimiters = grid.labels.map((rowArr) =>
      rowArr.map((l) => l.useDelimiter ?? true)
    );
    const updated = [...presets];
    updated[index] = { ...preset, layout: { ...layout }, labelDelimiters };
    set({ presets: updated });
  },

  reorderPresets: (from, to) => {
    const { presets } = get();
    const updated = [...presets];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    set({ presets: updated });
  },

  addPresetText: (texts) => {
    const { presetTexts, layout, selectedPresetTextCategory } = get();
    const padded = Array.from({ length: layout.itemsPerLabel }, (_, i) => texts[i] ?? "");
    const item: PresetTextItem = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: padded,
      category: normalizePresetTextCategory(selectedPresetTextCategory),
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

  reorderPresetTextCategories: (from, to) => {
    const { presetTextCategories } = get();
    const updated = [...presetTextCategories];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    set({ presetTextCategories: updated });
  },

  addPresetTextCategory: () => {
    const { presetTextCategories } = get();
    let index = presetTextCategories.length + 1;
    let next = `カテゴリ${index}`;
    while (presetTextCategories.some((category) => normalizePresetTextCategory(category) === next)) {
      index += 1;
      next = `カテゴリ${index}`;
    }
    set({
      presetTextCategories: normalizePresetTextCategories([...presetTextCategories, next]),
      selectedPresetTextCategory: next,
    });
  },

  deletePresetTextCategory: (category) => {
    const normalized = normalizePresetTextCategory(category);
    const { presetTextCategories, presetTexts, selectedPresetTextCategory } = get();
    const remainingCategories = normalizePresetTextCategories(presetTextCategories.filter((item) => normalizePresetTextCategory(item) !== normalized));
    const remainingTexts = presetTexts.filter((item) => normalizePresetTextCategory(item.category) !== normalized);
    const nextSelected = selectedPresetTextCategory === normalized
      ? remainingCategories[0] ?? DEFAULT_PRESET_TEXT_CATEGORY
      : selectedPresetTextCategory;
    set({
      presetTextCategories: remainingCategories,
      presetTexts: remainingTexts,
      selectedPresetTextCategory: nextSelected,
    });
  },

  setPresetTextCategory: (category) => {
    set({ selectedPresetTextCategory: normalizePresetTextCategory(category) });
  },

  renamePresetTextCategory: (from, to) => {
    const normalizedFrom = normalizePresetTextCategory(from);
    const normalizedTo = normalizePresetTextCategory(to);
    if (normalizedFrom === normalizedTo) return;
    const { presetTexts, presetTextCategories, selectedPresetTextCategory } = get();
    const nextPresetTexts = presetTexts.map((item) => {
      const normalizedItemCategory = normalizePresetTextCategory(item.category);
      if (normalizedItemCategory !== normalizedFrom) return normalizePresetTextItem(item);
      return {
        ...normalizePresetTextItem(item),
        category: normalizedTo,
      };
    });
    const nextCategories = normalizePresetTextCategories(
      presetTextCategories.map((item) => (normalizePresetTextCategory(item) === normalizedFrom ? normalizedTo : item))
    );
    set({
      presetTexts: nextPresetTexts,
      presetTextCategories: nextCategories,
      selectedPresetTextCategory: selectedPresetTextCategory === normalizedFrom ? normalizedTo : selectedPresetTextCategory,
    });
  },

  movePresetText: (id, targetCategory, targetIndex) => {
    const { presetTexts } = get();
    set({ presetTexts: movePresetTextItem(presetTexts, id, targetCategory, targetIndex) });
  },

  resetPresetTexts: () => {
    set({
      presetTexts: [...DEFAULT_PRESET_TEXTS],
      presetTextCategories: [DEFAULT_PRESET_TEXT_CATEGORY],
      selectedPresetTextCategory: DEFAULT_PRESET_TEXT_CATEGORY,
    });
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

  startNewProject: (layout, usedCellKeys = [], reusableSheetId = null) => {
    const grid = createEmptyGrid(layout.blockCols, layout.blockRows, layout.itemsPerLabel);
    set({
      layout: { ...layout, labelSize: { ...layout.labelSize } },
      grid,
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
      usedCells: new Set(usedCellKeys),
      reusableSheetId,
      clipboard: null,
      clipboardMode: null,
      history: [cloneGrid(grid)],
      historyIndex: 0,
      csvFilename: "",
    });
  },

  markFilledCellsUsed: () => {
    const { grid, usedCells } = get();
    const next = new Set(usedCells);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.labels[r][c].rows.some((row) => row.text.trim() !== "")) next.add(cellKey(r, c));
      }
    }
    set({ usedCells: next, selectedCells: new Set<string>() });
    return [...next];
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
      usedCells: new Set<string>(),
      reusableSheetId: null,
    });
    return true;
  },

  getProjectData: () => {
    const { grid, layout, presets, sizePresets, presetTexts, presetTextCategories, exportConfig, usedCells, reusableSheetId } = get();
    return {
      version: 4,
      grid: cloneGrid(grid),
      layout: { ...layout },
      presets: presets.map((p) => ({
        name: p.name,
        layout: { ...p.layout },
        labelDelimiters: p.labelDelimiters,
      })),
      sizePresets: sizePresets.map((p) => ({
        name: p.name,
        labelSize: { ...p.labelSize },
      })),
      presetTexts: presetTexts.map((p) => ({ id: p.id, text: [...p.text], category: normalizePresetTextCategory(p.category) })),
      presetTextCategories: [...presetTextCategories],
      exportConfig: { ...exportConfig },
      reusableSheetId,
      usedCells: [...usedCells],
    };
  },

  loadProjectData: (data, keepPresets) => {
    const newGrid = cloneGrid(data.grid);
    // keepPresets=true のときはプリセットラベルを上書きしない（履歴/CSV読込）
    const loadedPresetTexts = keepPresets
      ? get().presetTexts
      : data.presetTexts
        ? data.presetTexts.map((p: any) => normalizePresetTextItem({ id: p.id, text: [...p.text], category: p.category }))
        : [...DEFAULT_PRESET_TEXTS];
    const loadedCategories = keepPresets
      ? get().presetTextCategories
      : data.presetTextCategories
        ? normalizePresetTextCategories(data.presetTextCategories)
        : uniquePresetTextCategories(loadedPresetTexts);
    set({
      grid: newGrid,
      layout: { ...data.layout },
      presets: data.presets.map((p: any) => ({
        name: p.name,
        layout: { ...p.layout },
        labelDelimiters: p.labelDelimiters,
      })),
      sizePresets: data.sizePresets.map((p) => ({
        name: p.name,
        labelSize: { ...p.labelSize },
      })),
      presetTexts: loadedPresetTexts,
      presetTextCategories: loadedCategories,
      selectedPresetTextCategory: loadedCategories[0] ?? get().selectedPresetTextCategory,
      exportConfig: { ...data.exportConfig },
      selectedRow: 0,
      selectedCol: 0,
      selectedCells: new Set<string>(),
      clipboard: null,
      clipboardMode: null,
      reusableSheetId: data.reusableSheetId ?? null,
      usedCells: new Set(data.usedCells ?? []),
      history: [cloneGrid(newGrid)],
      historyIndex: 0,
    });
  },
}));

export { getDelimiterRowIndex };
