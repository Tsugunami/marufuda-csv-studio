// ===== 型定義 =====

/** 1ラベルの行データ */
export interface LabelRow {
  text: string;
}

/** 1ラベル（itemsPerLabel 行のデータ） */
export interface Label {
  id: string;
  rows: LabelRow[];
  useDelimiter?: boolean; // ラベルごとの接続詞使用フラグ（未設定時はtrue扱い）
  /** ラベル個別の接続詞寄せ（未設定時はレイアウト全体の設定を使用） */
  delimiterAlign?: DelimiterAlign;
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
  /** ラベルごとの接続詞ON/OFF状態 [row][col] 省略時は全てtrue扱い */
  labelDelimiters?: boolean[][];
}

/** サイズプリセット（ラベルサイズマージンサイズのみ） */
export interface SizePreset {
  name: string;
  labelSize: LabelSize;
}

/** 定型文プリセット（1ラベル分の行テキスト配列） */
export interface PresetTextItem {
  id: string;
  text: string[];
}
