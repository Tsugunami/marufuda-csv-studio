import type { SizePreset } from "./types";

/** 初期同梱サイズプリセット */
export const DEFAULT_SIZE_PRESETS: SizePreset[] = [
  { name: "標準 (38.1×21.2)", labelSize: { widthMm: 38.1, heightMm: 21.2 } },
  { name: "KDDI (48×25)", labelSize: { widthMm: 48, heightMm: 25 } },
  { name: "横長 (63.5×17)", labelSize: { widthMm: 63.5, heightMm: 17 } },
];