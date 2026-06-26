import { isDelimiterRow } from "./delimiter";

/**
 * ラベルの行データ配列から、「～」を境に前後を入れ替えた配列を生成する。
 *
 * 空行は前後の末尾/先頭に維持し、有効データ範囲内で反転を行う。
 * 「～」が見つからない場合は null を返す。
 */
export function buildReversedLabel(
  source: string[],
  delimiter: string
): string[] | null {
  const n = source.length;
  const output: string[] = new Array(n).fill("");

  // 空白でない最初/最後の有効行を特定
  let firstUsed = -1;
  let lastUsed = -1;
  for (let i = 0; i < n; i++) {
    if (source[i].trim() !== "") {
      if (firstUsed === -1) firstUsed = i;
      lastUsed = i;
    }
  }

  if (firstUsed === -1) {
    return null; // 全空
  }

  // デリミタ行を検索
  let delimiterIndex = -1;
  for (let i = firstUsed; i <= lastUsed; i++) {
    if (isDelimiterRow(source[i], delimiter)) {
      delimiterIndex = i;
      break;
    }
  }

  if (delimiterIndex === -1) {
    return null; // デリミタなし
  }

  // 前後の空行は維持
  for (let i = 0; i < firstUsed; i++) {
    output[i] = source[i];
  }
  for (let i = lastUsed + 1; i < n; i++) {
    output[i] = source[i];
  }

  // [デリミタ後ろ部分] + [デリミタ] + [デリミタ前部分] の順で再構成
  let writeIndex = firstUsed;

  // デリミタ後ろ部分
  for (let i = delimiterIndex + 1; i <= lastUsed; i++) {
    output[writeIndex] = source[i];
    writeIndex++;
  }

  // デリミタ自身
  output[writeIndex] = source[delimiterIndex];
  writeIndex++;

  // デリミタ前部分
  for (let i = firstUsed; i < delimiterIndex; i++) {
    output[writeIndex] = source[i];
    writeIndex++;
  }

  return output;
}
