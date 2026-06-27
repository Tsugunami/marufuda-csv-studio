import type { Preset } from "./types";

/** 初期同梱レイアウトプリセット（ブロック構成＋接続詞設定） */
export const DEFAULT_PRESETS: Preset[] = [
  {
    name: "通常7行70面",
    layout: {
      blockCols: 7,
      blockRows: 10,
      itemsPerLabel: 7,
      delimiter: "～",
      delimiterAlign: "center",
      labelSize: { widthMm: 38.1, heightMm: 21.2 },
    },
  },
  {
    name: "KDDI 8行40面",
    layout: {
      blockCols: 5,
      blockRows: 8,
      itemsPerLabel: 8,
      delimiter: "～",
      delimiterAlign: "center",
      labelSize: { widthMm: 48, heightMm: 25 },
    },
  },
  {
    name: "95面5行",
    layout: {
      blockCols: 5,
      blockRows: 19,
      itemsPerLabel: 5,
      delimiter: "～",
      delimiterAlign: "center",
      labelSize: { widthMm: 38.1, heightMm: 21.2 },
    },
  },
  {
    name: "95面4行",
    layout: {
      blockCols: 5,
      blockRows: 19,
      itemsPerLabel: 4,
      delimiter: "～",
      delimiterAlign: "center",
      labelSize: { widthMm: 38.1, heightMm: 21.2 },
    },
  },
  {
    name: "横長4行",
    layout: {
      blockCols: 5,
      blockRows: 8,
      itemsPerLabel: 4,
      delimiter: "～",
      delimiterAlign: "center",
      labelSize: { widthMm: 63.5, heightMm: 17 },
    },
  },
  {
    name: "6行(自分寄せ)",
    layout: {
      blockCols: 5,
      blockRows: 8,
      itemsPerLabel: 6,
      delimiter: "～",
      delimiterAlign: "self",
      labelSize: { widthMm: 48, heightMm: 25 },
    },
  },
  {
    name: "6行(相手寄せ)",
    layout: {
      blockCols: 5,
      blockRows: 8,
      itemsPerLabel: 6,
      delimiter: "～",
      delimiterAlign: "partner",
      labelSize: { widthMm: 48, heightMm: 25 },
    },
  },
];
