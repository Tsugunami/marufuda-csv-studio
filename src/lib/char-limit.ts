/**
 * ラベルサイズと行数から1行あたりの最大文字数（全角換算）を計算する。
 * 
 * 全角1文字 = 1、半角1文字 = 0.5、全角スペース=1、半角スペース=0.5 として換算。
 * 
 * 実測ベース（ラベル屋さんによる自動文字詰めを考慮）:
 * - 35×12mm / 5行 → 「光集約ユニット(144)#3-□9〜10」(全角換算17.5) が限界 → max=17
 * - 20×20mm / 7行 → 「Eキャビネット-S」(全角換算7) が限界 → max=7
 * 
 * 理論値と実測値の差は、ラベル屋さんが autoFontSize で自動縮小しているため。
 * 実測ベースの補正係数を乗算して調整する。
 */

// フォントサイズ計算（alym_export.rs と同じロジック）
export function calcFontSizePt(labelHeightMm: number, itemsPerLabel: number): number {
  const rowHeight = labelHeightMm / itemsPerLabel;
  const pt = rowHeight * 0.85 / 0.3528;
  return Math.round(pt * 10) / 10;
}

/** 全角換算文字数を計算（全角=1, 半角=0.5） */
export function countFullwidthChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    // 半角スペースは半角文字として扱い、全角スペースだけを全角1文字とする。
    if (ch === '　') { count += 1; continue; }
    const code = ch.charCodeAt(0);
    // 半角範囲: 0x20-0x7E, 0xFF61-0xFF9F (半角カタカナ)
    if ((code >= 0x20 && code <= 0x7E) || (code >= 0xFF61 && code <= 0xFF9F)) {
      count += 0.5;
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * 1行あたりの最大文字数（全角換算）を計算
 * 
 * 実測値ベースの簡易計算式:
 *   最大文字数 = (有効幅mm × 1.2) ÷ 行高mm
 * 
 * 係数1.2はラベル屋さんのautoFontSizeによる自動縮小を補正。
 * 
 * 検証:
 * 利用者による実測結果に合わせ、計算値に1文字ぶんの余裕を加える。
 */
export function calcMaxCharsPerLine(
  labelWidthMm: number,
  labelHeightMm: number,
  itemsPerLabel: number
): number {
  const rowHeight = labelHeightMm / itemsPerLabel;
  const usableWidthMm = labelWidthMm - 1.32;
  const maxChars = Math.floor(usableWidthMm * 1.2 / rowHeight) + 1;
  return Math.max(3, maxChars);
}

/**
 * バリデーション結果
 */
export interface CharLimitResult {
  ok: boolean;
  maxChars: number;
  currentChars: number;
  fullwidthCount: number;
  labelWidthMm: number;
  labelHeightMm: number;
  fontSizePt: number;
}

/**
 * 1行のテキストの文字数制限チェック
 */
export function validateCharLimit(
  text: string,
  labelWidthMm: number,
  labelHeightMm: number,
  itemsPerLabel: number
): CharLimitResult {
  const maxChars = calcMaxCharsPerLine(labelWidthMm, labelHeightMm, itemsPerLabel);
  const fullwidthCount = countFullwidthChars(text);
  return {
    ok: Math.ceil(fullwidthCount) <= maxChars,
    maxChars,
    currentChars: text.length,
    fullwidthCount,
    labelWidthMm,
    labelHeightMm,
    fontSizePt: calcFontSizePt(labelHeightMm, itemsPerLabel),
  };
}
