"use client";

import { useState } from "react";

/** 女盘 · 上门衣橱收纳与全屋整理（home-organizing · C2_IN_HOME）增长单页。 */
export interface GrowthPreset {
  id: string;
  name: string;
  price: string;
}

export const F20_PRESETS: GrowthPreset[] = [
  { id: "f20-season", name: "换季衣橱整理 3h", price: "¥180" },
  { id: "f20-whole", name: "全屋收纳 5h", price: "¥300" },
  { id: "f20-moving", name: "搬家还原 8h", price: "¥450" },
];

export const F20_CATEGORY_TAG = "【home-organizing·上门收纳】";

export function buildF20DemandText(preset: GrowthPreset, tuning: string): string {
  const extra = tuning.trim();
  return `${F20_CATEGORY_TAG}${preset.name}（${preset.price}）${extra ? `，补充：${extra}` : ""}`;
}

export default function F20Page() {
  const [presetId, setPresetId] = useState(F20_PRESETS[0].id);
  const [tuning, setTuning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const preset = F20_PRESETS.find((p) => p.id === presetId) ?? F20_PRESETS[0];
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: buildF20DemandText(preset, tuning) }),
      });
      if (!res.ok) throw new Error("发单失败，请重试");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h1 className="text-xl font-bold">上门收纳 · 衣橱整理</h1>
      <div className="grid gap-2">
        {F20_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            className={`rounded-xl border p-3 text-left text-sm ${
              p.id === presetId ? "border-pink-600 bg-pink-50" : "border-slate-200"
            }`}
          >
            <span className="font-bold">{p.name}</span>
            <span className="ml-2 text-pink-600">{p.price}</span>
          </button>
        ))}
      </div>
      <textarea
        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        rows={2}
        placeholder="一句话补充：如周六上午、要女性收纳师"
        value={tuning}
        onChange={(e) => setTuning(e.target.value)}
      />
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <p>🛡️ 入户强背调（公安核验）· 女性收纳师可选</p>
        <p>📸 完工双拍前后对比验收 · 72h 质保 · 资金官方托管</p>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={submitting || done}
        className="w-full rounded-xl bg-pink-600 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {done ? "已下单 · 收纳师正在赶来" : submitting ? "下单中…" : "一键极速下单"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
