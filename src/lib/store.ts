import { create } from "zustand";
import type {
  SheetGrid,
  Label,
  LayoutConfig,
  ExportConfig,
  ReverseDirection,
} from "./types";
import { getDelimiterRowIndex } from "./delimiter";
import { buildReversedLabel } from "./reverse";
import { DEFAULT_PRESETS } from "./presets";

let labelIdCounter = 0;
function nextId(): string {
  labelIdCounter++;
  return `label-${labelIdCounter}`;
}

function createEmptyLabel(itemsPerLabel: number): Label {
  return {
    id: nextId(),
    rows: Array.from({ length: itemsPerLabel }, () => ({ text: "" })),
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
  // レイアウト
  layout: LayoutConfig;
  // シート
  grid: SheetGrid;
  // 選択中ラベル
  selectedRow: number;
  selectedCol: number;
  // 出力設定
  exportConfig: ExportConfig;
  // プリセット
  presets: typeof DEFAULT_PRESETS;

  // アクション
  setLayout: (layout: Partial<LayoutConfig>) => void;
  applyPreset: (index: number) => void;
  selectLabel: (row: number, col: number) => void;
  updateLabelRow: (labelRow: number, text: string) => void;
  reverseTo: (direction: ReverseDirection) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
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
    const newLabels = grid.labels.map((rowArr) => rowArr.map((l) => ({ ...l, rows: l.rows.map((r) => ({ ...r })) })));
    const label = newLabels[selectedRow]?.[selectedCol];
    if (label && labelRow >= 0 && labelRow < label.rows.length) {
      label.rows[labelRow].text = text;
    }
    set({ grid: { ...grid, labels: newLabels } });
  },

  reverseTo: (direction) => {
    const { grid, selectedRow, selectedCol, layout } = get();
    const sourceLabel = grid.labels[selectedRow]?.[selectedCol];
    if (!sourceLabel) return;

    // sourceTexts 構築時にデリミタ行を補完（readOnly行の text は空のため）
    const delimIdx = layout.delimiter
      ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
      : -1;
    const sourceTexts = sourceLabel.rows.map((r, i) =>
      i === delimIdx ? layout.delimiter : r.text
    );
    const reversed = buildReversedLabel(sourceTexts, layout.delimiter);
    if (!reversed) return;

    // 反転先座標
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
      return; // 範囲外
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

  setExportConfig: (partial) => {
    set({ exportConfig: { ...get().exportConfig, ...partial } });
  },
}));

export { getDelimiterRowIndex };
