import type { SheetGrid, ExportConfig, LayoutConfig } from "./types";
import { getDelimiterRowIndex } from "./delimiter";

/**
 * SheetGrid を CSV 用の2次元配列に変換する。
 * 1ラベル = 1行、各列 = ラベルの各行データ。
 * デリミタ行（readOnlyでtextが空）は layout.delimiter で補完する。
 */
export function buildCsvMatrix(
  grid: SheetGrid,
  config: ExportConfig,
  layout: LayoutConfig
): string[][] {
  const rows: string[][] = [];

  const delimIdx = layout.delimiter
    ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
    : -1;

  // ヘッダ行
  if (config.withHeader) {
    const itemsPerLabel = grid.labels[0]?.[0]?.rows.length ?? 0;
    let headers: string[];
    if (config.headerNames && config.headerNames.length === itemsPerLabel) {
      headers = [...config.headerNames];
    } else {
      headers = Array.from(
        { length: itemsPerLabel },
        (_, i) => `項目${i + 1}`
      );
    }
    rows.push(headers);
  }

  // データ行: 左上→右下の順（行優先）
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const label = grid.labels[r]?.[c];
      if (!label) continue;
      const cells = label.rows.map((row, i) =>
        i === delimIdx ? layout.delimiter : row.text
      );
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * CSV文字列を構築する（フロント側プレビュー用）。
 * Rust 側でもエスケープを行うが、プレビュー表示用に同じロジックを用意。
 */
export function buildCsvText(matrix: string[][]): string {
  return matrix
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(","))
    .join("\r\n");
}

function escapeCsvField(s: string): string {
  const needsQuote =
    s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}
