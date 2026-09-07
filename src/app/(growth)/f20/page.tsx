"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collectGrowthAttribution,
  SmsLeadSheet,
  useLeadDemandSubmit,
  type LeadDraft,
} from "@/components/growth/sms-lead-sheet";
import { trackMetric } from "@/lib/track-metric";

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

  // 投流漏斗：浏览（渠道 tag 随归因走，console 口径先行）。
  useEffect(() => {
    const a = collectGrowthAttribution("f20");
    trackMetric("growth.page_view", 1, { page: "f20", channel: a.source });
  }, []);

  const collect = (): LeadDraft => ({ presetId, tuning });
  const applyDraft = (d: LeadDraft) => {
    if (F20_PRESETS.some((p) => p.id === d.presetId)) setPresetId(d.presetId);
    setTuning(d.tuning);
  };

  const { submit, sheetOpen, setSheetOpen, handleVerified, demandId } = useLeadDemandSubmit({
    pageKey: "f20",
    collect,
    buildPayload: (d) => {
      const preset = F20_PRESETS.find((p) => p.id === d.presetId) ?? F20_PRESETS[0];
      const extra = d.tuning.trim();
      return {
        title: buildF20DemandText(preset, ""),
        description: extra ? `${preset.name}：${extra}` : `${preset.name}（${preset.price}）`,
        category: "home-organizing",
        attribution: collectGrowthAttribution("f20"),
      };
    },
    applyDraft,
    setSubmitting,
    setDone,
    setError,
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h1 className="text-xl font-bold">上门收纳 · 衣橱整理</h1>
      <div className="grid gap-2">
        {F20_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPresetId(p.id);
              trackMetric("growth.preset_select", 1, { page: "f20", preset: p.id });
            }}
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
      {done && demandId && (
        <Link
          href={`/demands/${demandId}`}
          className="block rounded-xl border border-pink-200 bg-pink-50 p-3 text-center text-sm font-bold text-pink-700"
        >
          查看我的单子 · {demandId.slice(0, 8)}
        </Link>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <SmsLeadSheet open={sheetOpen} onOpenChange={setSheetOpen} onVerified={handleVerified} pageKey="f20" />
    </div>
  );
}
