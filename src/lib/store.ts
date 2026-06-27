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

interface AppState {
  layout: LayoutConfig;
  grid: SheetGrid;
  selectedRow: number;
  selectedCol: number;
  exportConfig: ExportConfig;
  presets: typeof DEFAULT_PRESETS;
  sizePresets: SizePreset[];
  clipboard: string[] | null;

  setLayout: (layout: Partial<LayoutConfig>) => void;
  applyPreset: (index: number) => void;
  selectLabel: (row: number, col: number) => void;
  updateLabelRow: (labelRow: number, text: string) => void;
  toggleLabelDelimiter: () => void;
  reverseTo: (direction: ReverseDirection) => void;
  copyTo: (direction: ReverseDirection) => void;
  copyToClipboard: () => void;
  pasteFromClipboard: () => void;
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

export const useStore = create<AppState>((set, get) => ({
  layout: initialLayout,
  grid: initialGrid,
  selectedRow: 0,
  selectedCol: 0,
  exportConfig: {
    encoding: "shift_jis",
    withHeader: true,
    headerNames: [],
  },
  presets: DEFAULT_PRESETS,
  sizePresets: DEFAULT_SIZE_PRESETS,
  clipboard: null,

  setLayout: (partial) => {
    const newLayout = { ...get().layout, ...partial };
    const newGrid = createEmptyGrid(
      newLayout.blockCols,
      newLayout.blockRows,
      newLayout.itemsPerLabel
    );
    set({
      layout: newLayout,
      grid: newGrid,
      selectedRow: 0,
      selectedCol: 0,
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
    set({
      layout: { ...preset.layout },
      grid: newGrid,
      selectedRow: 0,
      selectedCol: 0,
    });
  },

  selectLabel: (row, col) => {
    set({ selectedRow: row, selectedCol: col });
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
    set({ grid: { ...grid, labels: newLabels } });
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
    set({ grid: { ...grid, labels: newLabels } });
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
      case "right":
        targetCol = selectedCol + 1;
        break;
      case "left":
        targetCol = selectedCol - 1;
        break;
      case "down":
        targetRow = selectedRow + 1;
        break;
      case "up":
        targetRow = selectedRow - 1;
        break;
    }

    if (
      targetRow < 0 ||
      targetRow >= grid.rows ||
      targetCol < 0 ||
      targetCol >= grid.cols
    ) {
      return;
    }

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

    set({ grid: { ...grid, labels: newLabels } });
  },

  copyTo: (direction) => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    let targetRow = selectedRow;
    let targetCol = selectedCol;
    switch (direction) {
      case "right":
        targetCol = selectedCol + 1;
        break;
      case "left":
        targetCol = selectedCol - 1;
        break;
      case "down":
        targetRow = selectedRow + 1;
        break;
      case "up":
        targetRow = selectedRow - 1;
        break;
    }

    if (
      targetRow < 0 ||
      targetRow >= grid.rows ||
      targetCol < 0 ||
      targetCol >= grid.cols
    ) {
      return;
    }

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

    set({ grid: { ...grid, labels: newLabels } });
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
    set({ clipboard: texts });
  },

  pasteFromClipboard: () => {
    const { grid, selectedRow, selectedCol, clipboard } = get();
    if (!clipboard) return;

    const newLabels = grid.labels.map((rowArr) =>
      rowArr.map((l) => ({
        ...l,
        rows: l.rows.map((r) => ({ ...r })),
      }))
    );

    const targetLabel = newLabels[selectedRow]?.[selectedCol];
    if (!targetLabel) return;

    for (let i = 0; i < targetLabel.rows.length; i++) {
      targetLabel.rows[i].text = clipboard[i] ?? "";
    }

    set({ grid: { ...grid, labels: newLabels } });
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
