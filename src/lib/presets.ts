import type { Preset } from "./types";

/** 初期同梱プリセット */
export const DEFAULT_PRESETS: Preset[] = [
  {
    name: "通常7行70面",
    layout: {
      blockCols: 7,
      blockRows: 10,
      itemsPerLabel: 7,
      delimiter: "～",
      delimiterAlign: "center",
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
    },
  },
];
