import type { SheetGrid, ExportConfig, LayoutConfig } from "./types";
import { getDelimiterRowIndex } from "./delimiter";
import { getLabelDisplayTexts } from "./label-utils";

/**
 * SheetGrid を CSV 用の2次元配列に変換する。
 * 1ラベル = 1行、各列 = ラベルの各行データ。
 * デリミタ行は「ラベルが使用中（1文字でも入力あり）の場合のみ」補完し、
 * 未使用ラベルのデリミタ行は空文字にする。
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

  // データ行: 左上→右下の順（行優先）
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const label = grid.labels[r]?.[c];
      if (!label) continue;
      const cells = getLabelDisplayTexts(label, layout);
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
