import { useState, useRef, useEffect, useCallback } from "react";

interface SuggestionDropdownProps {
  inputValue: string;
  candidates: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
  inputElement: HTMLInputElement | null;
}

export function SuggestionDropdown({
  inputValue,
  candidates,
  onSelect,
  onClose,
  inputElement,
}: SuggestionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  // 候補が変わったら選択をリセット
  useEffect(() => {
    setSelectedIndex(0);
  }, [candidates]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (composingRef.current || e.isComposing) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (candidates.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % candidates.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
      } else if (e.key === "Enter" && candidates.length > 0) {
        e.preventDefault();
        onSelect(candidates[selectedIndex]);
        onClose();
      }
    },
    [candidates, selectedIndex, onSelect, onClose]
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
  }, []);

  useEffect(() => {
    if (!inputElement) return;
    inputElement.addEventListener("keydown", handleKeyDown);
    inputElement.addEventListener("compositionstart", handleCompositionStart);
    inputElement.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      inputElement.removeEventListener("keydown", handleKeyDown);
      inputElement.removeEventListener("compositionstart", handleCompositionStart);
      inputElement.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [inputElement, handleKeyDown, handleCompositionStart, handleCompositionEnd]);

  // 選択中の候補をスクロール位置に追従
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (candidates.length === 0 || !inputValue) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border border-slate-300 bg-white shadow-lg max-h-40 overflow-y-auto"
      ref={listRef}
      onMouseDown={(e) => e.preventDefault()}
    >
      {candidates.map((candidate, index) => (
        <button
          key={candidate}
          className={`w-full text-left px-2 py-1 text-xs truncate hover:bg-brand-50 ${
            index === selectedIndex ? "bg-brand-100 text-brand-800" : "text-slate-700"
          }`}
          onMouseDown={() => {
            onSelect(candidate);
            onClose();
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}
