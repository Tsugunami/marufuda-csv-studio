import type { DelimiterAlign } from "./types";

/** デリミタとして認識する文字（半角・全角） */
const DELIMITER_CHARS = ["～", "~"];

/**
 * テキストがデリミタ（半角~ / 全角～）かどうかを判定する。
 * 前後の空白を除去して判定する。
 */
export function isDelimiterText(text: string): boolean {
  const t = text.trim();
  if (t === "") return false;
  return DELIMITER_CHARS.includes(t);
}

/**
 * 「～」デリミタを挿入すべき行 index（0始まり）を計算する。
 *
 * - 奇数行: 真ん中 (floor(n/2))
 * - 偶数行:
 *   - center  → n/2 - 1（上側）
 *   - self    → n/2 - 1（自分側=上の末尾）
 *   - partner → n/2（相手側=下の先頭）
 */
export function getDelimiterRowIndex(
  itemsPerLabel: number,
  align: DelimiterAlign
): number {
  const n = itemsPerLabel;
  if (n % 2 === 1) {
    // 奇数: 真ん中
    return Math.floor(n / 2);
  }
  // 偶数
  switch (align) {
    case "center":
      return n / 2 - 1;
    case "self":
      return n / 2 - 1;
    case "partner":
      return n / 2;
  }
}

/**
 * 指定行がデリミタ行かどうかを判定する。
 */
export function isDelimiterRow(
  text: string,
  delimiter: string
): boolean {
  if (!delimiter) return false;
  const t = text.trim();
  return t === delimiter || t === "~" || t === "～";
}
