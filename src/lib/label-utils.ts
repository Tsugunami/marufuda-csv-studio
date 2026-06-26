import type { Label, LayoutConfig } from "./types";
import { getDelimiterRowIndex } from "./delimiter";

/**
 * ラベルが「使用中」かどうかを判定する。
 * デリミタ行は無視し、ユーザー入力が1文字でもあれば使用中とみなす。
 */
export function isLabelUsed(label: Label, delimIdx: number): boolean {
  return label.rows.some(
    (row, i) => i !== delimIdx && row.text.trim() !== ""
  );
}

/**
 * ラベルの表示用テキストを行配列で取得する。
 * デリミタ行は「ラベルが使用中の場合のみ」layout.delimiter で補完し、
 * 未使用ラベル（1文字も入力がない）のデリミタ行は空文字にする。
 */
export function getLabelDisplayTexts(
  label: Label,
  layout: LayoutConfig
): string[] {
  const delimIdx = layout.delimiter
    ? getDelimiterRowIndex(layout.itemsPerLabel, layout.delimiterAlign)
    : -1;
  const used = isLabelUsed(label, delimIdx);
  return label.rows.map((row, i) => {
    if (i === delimIdx) {
      return used ? layout.delimiter : "";
    }
    return row.text;
  });
}

/**
 * ラベルの表示用テキストを1行に結合して返す（全体ビューの hasData 判定等用）。
 */
export function hasLabelData(label: Label, delimIdx: number): boolean {
  return isLabelUsed(label, delimIdx);
}
