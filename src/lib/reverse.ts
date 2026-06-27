import { isDelimiterRow } from "./delimiter";

/**
 * ラベルの行データ配列から、「～」を境に前後を入れ替えた配列を生成する。
 *
 * デリミタ位置は固定し、デリミタより前のブロックと後のブロックを入れ替える。
 * 空行は各ブロック内でそのまま維持される。
 * 「～」が見つからない場合は null を返す。
 *
 * 例:
 *   入力: [aaa, bbb, "", ～, DDD, EEE, ""]
 *   出力: [DDD, EEE, "", ～, aaa, bbb, ""]
 */
export function buildReversedLabel(
  source: string[],
  delimiter: string
): string[] | null {
  const n = source.length;
  const output: string[] = new Array(n).fill("");

  // デリミタ行を検索
  let delimiterIndex = -1;
  for (let i = 0; i < n; i++) {
    if (isDelimiterRow(source[i], delimiter)) {
      delimiterIndex = i;
      break;
    }
  }

  if (delimiterIndex === -1) {
    return null; // デリミタなし
  }

  // デリミタ以外にデータが存在するか確認
  let hasData = false;
  for (let i = 0; i < n; i++) {
    if (i !== delimiterIndex && source[i].trim() !== "") {
      hasData = true;
      break;
    }
  }
  if (!hasData) return null;

  // デリミタは元の位置に固定
  output[delimiterIndex] = source[delimiterIndex];

  // 前ブロック: indices 0..delimiterIndex-1
  // 後ブロック: indices delimiterIndex+1..n-1
  const beforeBlock = source.slice(0, delimiterIndex);
  const afterBlock = source.slice(delimiterIndex + 1);

  // 前ブロック領域に後ブロックの内容を配置
  for (let i = 0; i < beforeBlock.length; i++) {
    output[i] = afterBlock[i] ?? "";
  }

  // 後ブロック領域に前ブロックの内容を配置
  for (let i = 0; i < afterBlock.length; i++) {
    output[delimiterIndex + 1 + i] = beforeBlock[i] ?? "";
  }

  return output;
}
