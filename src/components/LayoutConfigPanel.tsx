import { useStore } from "../lib/store";

export function LayoutConfigPanel() {
  const { layout, setLayout, presets, applyPreset } = useStore();

  const isEven = layout.itemsPerLabel % 2 === 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
      <h2 className="text-sm font-bold text-slate-700 border-b pb-2">
        レイアウト設定
      </h2>

      {/* プリセット */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          プリセット
        </label>
        <select
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value=""
          onChange={(e) => {
            if (e.target.value !== "") {
              applyPreset(Number(e.target.value));
            }
          }}
        >
          <option value="">-- プリセットを選択 --</option>
          {presets.map((p, i) => (
            <option key={i} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* ブロック構成 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            ブロック列数
          </label>
          <input
            type="number"
            min={1}
            max={20}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.blockCols}
            onChange={(e) =>
              setLayout({ blockCols: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            ブロック行数
          </label>
          <input
            type="number"
            min={1}
            max={30}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={layout.blockRows}
            onChange={(e) =>
              setLayout({ blockRows: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
      </div>

      {/* 1ラベルあたり行数 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          1ラベルあたり行数
        </label>
        <input
          type="number"
          min={1}
          max={20}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={layout.itemsPerLabel}
          onChange={(e) =>
            setLayout({
              itemsPerLabel: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
        <p className="text-xs text-slate-500 mt-1">
          総ラベル数: {layout.blockCols * layout.blockRows} 面
        </p>
      </div>

      {/* デリミタ */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          デリミタ文字
        </label>
        <input
          type="text"
          maxLength={3}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={layout.delimiter}
          onChange={(e) => setLayout({ delimiter: e.target.value })}
          placeholder="～"
        />
      </div>

      {/* ～寄せ */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          「～」の寄せ（偶数行時）
        </label>
        <select
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
          value={layout.delimiterAlign}
          disabled={!isEven}
          onChange={(e) =>
            setLayout({
              delimiterAlign: e.target.value as "center" | "self" | "partner",
            })
          }
        >
          <option value="center">中央（上側）</option>
          <option value="self">自分側に寄せる（上）</option>
          <option value="partner">相手側に寄せる（下）</option>
        </select>
        {!isEven && (
          <p className="text-xs text-slate-400 mt-1">
            奇数行のため中央固定
          </p>
        )}
      </div>
    </div>
  );
}
