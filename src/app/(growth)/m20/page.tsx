"use client";

import { useState } from "react";
import {
  SmsLeadSheet,
  useLeadDemandSubmit,
  type LeadDraft,
} from "@/components/growth/sms-lead-sheet";

/** 男盘 · 上门电脑装机与维护（pc-assembly · C3_TECH_B2B）增长单页。 */
export interface GrowthPreset {
  id: string;
  name: string;
  price: string;
}

export const M20_PRESETS: GrowthPreset[] = [
  { id: "m20-clean", name: "全套清灰装机", price: "¥80 起" },
  { id: "m20-system", name: "系统与驱动维护", price: "¥50" },
  { id: "m20-water", name: "水冷定制装机", price: "¥150 起" },
];

export const M20_CATEGORY_TAG = "【pc-assembly·上门装机】";

export function buildM20DemandText(preset: GrowthPreset, tuning: string): string {
  const extra = tuning.trim();
  return `${M20_CATEGORY_TAG}${preset.name}（${preset.price}）${extra ? `，补充：${extra}` : ""}`;
}

export default function M20Page() {
  const [presetId, setPresetId] = useState(M20_PRESETS[0].id);
  const [tuning, setTuning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collect = (): LeadDraft => ({ presetId, tuning });
  const applyDraft = (d: LeadDraft) => {
    if (M20_PRESETS.some((p) => p.id === d.presetId)) setPresetId(d.presetId);
    setTuning(d.tuning);
  };

  const { submit, sheetOpen, setSheetOpen, handleVerified } = useLeadDemandSubmit({
    pageKey: "m20",
    collect,
    buildPayload: (d) => {
      const preset = M20_PRESETS.find((p) => p.id === d.presetId) ?? M20_PRESETS[0];
      const extra = d.tuning.trim();
      return {
        title: buildM20DemandText(preset, ""),
        description: extra ? `${preset.name}：${extra}` : `${preset.name}（${preset.price}）`,
        category: "pc-assembly",
      };
    },
    applyDraft,
    setSubmitting,
    setDone,
    setError,
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h1 className="text-xl font-bold">电脑装机 · 上门服务</h1>
      <div className="grid gap-2">
        {M20_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            className={`rounded-xl border p-3 text-left text-sm ${
              p.id === presetId ? "border-indigo-600 bg-indigo-50" : "border-slate-200"
            }`}
          >
            <span className="font-bold">{p.name}</span>
            <span className="ml-2 text-indigo-600">{p.price}</span>
          </button>
        ))}
      </div>
      <textarea
        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        rows={2}
        placeholder="一句话补充：如自带水冷、周六下午上门"
        value={tuning}
        onChange={(e) => setTuning(e.target.value)}
      />
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <p>🛡️ 自备防静电工具 · 现场增项先确认后加价（≤50% 熔断）</p>
        <p>🔒 资金全额官方托管 · 硬件场景险 · 弄坏包赔</p>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={submitting || done}
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {done ? "已下单 · 师傅正在赶来" : submitting ? "下单中…" : "一键极速下单"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SmsLeadSheet open={sheetOpen} onOpenChange={setSheetOpen} onVerified={handleVerified} />
    </div>
  );
}
