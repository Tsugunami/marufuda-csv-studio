import type { PresetTextItem } from "./types";

/** 全カテゴリのプリセットテキストから、各行のユニークな文言リストを抽出 */
export function getUniqueRowTexts(presetTexts: PresetTextItem[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of presetTexts) {
    for (const text of item.text) {
      const trimmed = text.trim();
      if (trimmed === "") continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/** 前方一致（NFKC正規化＋大文字小文字無視）で候補を絞り込む */
export function filterSuggestions(
  candidates: string[],
  inputValue: string
): string[] {
  if (!inputValue) return [];
  const normalizedInput = inputValue.normalize("NFKC").toLocaleLowerCase();
  return candidates.filter((candidate) => {
    const normalizedCandidate = candidate.normalize("NFKC").toLocaleLowerCase();
    return normalizedCandidate.startsWith(normalizedInput);
  });
}