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
 * ラベルごとの useDelimiter フラグ・delimiterAlign を考慮する。
 */
export function getLabelDisplayTexts(
  label: Label,
  layout: LayoutConfig
): string[] {
  const useDelim = label.useDelimiter ?? true;
  const align = label.delimiterAlign ?? layout.delimiterAlign;
  const delimIdx = useDelim && layout.delimiter
    ? getDelimiterRowIndex(layout.itemsPerLabel, align)
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
