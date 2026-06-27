// ===== 型定義 =====

/** 1ラベルの行データ */
export interface LabelRow {
  text: string;
}

/** 1ラベル（itemsPerLabel 行のデータ） */
export interface Label {
  id: string;
  rows: LabelRow[];
}

/** シート全体 = ブロック格子 */
export interface SheetGrid {
  cols: number; // blockCols: 横方向のラベル数
  rows: number; // blockRows: 縦方向のラベル数
  labels: Label[][]; // [row][col] の2次元
}

/** 「～」の寄せ方向（偶数行時） */
export type DelimiterAlign = "center" | "self" | "partner";

/** ラベルの物理サイズ（mm）— 全体ビューのアスペクト比に反映 */
export interface LabelSize {
  widthMm: number; // ラベル幅 mm
  heightMm: number; // ラベル高さ mm
}

/** レイアウト設定 */
export interface LayoutConfig {
  blockCols: number; // ◯列
  blockRows: number; // ◯行
  itemsPerLabel: number; // 1ラベルあたり行数
  delimiter: string; // "～" | "~" | "→" | "" (none)
  delimiterAlign: DelimiterAlign;
  labelSize: LabelSize; // ラベル物理サイズ
}

/** 出力設定 */
export interface ExportConfig {
  encoding: "shift_jis" | "utf8" | "utf8_bom";
  withHeader: boolean;
  headerNames: string[]; // 空配列なら自動生成
}

/** 反転方向 */
export type ReverseDirection = "right" | "left" | "up" | "down";

/** プリセット */
export interface Preset {
  name: string;
  layout: LayoutConfig;
}

/** サイズプリセット（ラベルサイズマージンサイズのみ） */
export interface SizePreset {
  name: string;
  labelSize: LabelSize;
}
