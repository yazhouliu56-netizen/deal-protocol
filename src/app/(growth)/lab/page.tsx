"use client";

import { useState } from "react";
import DynamicAmmoSlot from "@/components/waves/slots/DynamicAmmoSlot";
import type { IAmmoDefinition } from "@/types/ammo-schema";

/** 增长特区内部调试看板（/lab）：20 句真题点选 → 量产 → 质检展示 → dyn 视口预览。 */
const QUICK_SENTENCES: string[] = [
  "周六下午2点上门装机，预算80，自带螺丝刀套装，需要开机点亮测试",
  "全套水冷主机清灰+换硅脂，预算150，本周内，完工跑10分钟烤机",
  "办公室5台电脑批量装机布线，固定预算2000，需要开票",
  "电脑点不亮了，来个人看看",
  "新买的散件到了求装机",
  "风扇声音巨响求清灰",
  "自带水冷与定制机箱，现场可能要补买转接线，接受现场加价确认",
  "网吧旧机改造，必须持电工/硬件工程师证书",
  "帮装个黑苹果，电话13800001111加微详聊",
  "0.1元帮我装30台机器，弄坏了不用赔",
  "主卧衣帽间换季整理，周六10点，3小时，预算180，自备收纳袋",
  "儿童房玩具全屋收纳，4小时，60一小时，完工拍照验收",
  "搬家后全屋还原整理，全天8小时，总价450，需双人组队",
  "衣柜乱成狗了求拯救",
  "刚搬完家东西全堆在地上",
  "鞋柜塞不下了求整理",
  "衣橱收纳可能要现场买专用亚克力收纳盒，接受现场确认",
  "女生独居，要求女性收纳师且实名无犯罪记录",
  "找个阿姨理衣柜，联系v信shouna999电话13900002222",
  "出10万元帮我整理，但是进门不要拍照",
];

interface LabResult {
  ok: boolean;
  ammoId?: string;
  ammo?: IAmmoDefinition;
  errors?: string[];
  latencyMs: number;
  failureDimension?: string;
  autoRepaired?: boolean;
  compiled?: {
    targetCategory: string;
    sanitizedInput: string;
    detectedLeak: boolean;
    systemPrompt: string;
    userPrompt: string;
  };
}

export default function GrowthLabPage() {
  const [text, setText] = useState(QUICK_SENTENCES[3]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LabResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim() || running) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/growth/ammo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: text.trim() }),
      });
      const data = (await res.json()) as LabResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-bold">量产实验看板 /lab（内部）</h1>
      <textarea
        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {QUICK_SENTENCES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setText(s)}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
          >
            {s.slice(0, 10)}…
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {running ? "量产中…" : "一句话量产"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 p-3 text-xs">
            <p>
              结果：{result.ok ? `✅ ${result.ammoId}` : `❌ ${result.failureDimension}`}
              {result.autoRepaired ? "（自动修复后过闸）" : ""} · {result.latencyMs}ms
            </p>
            {result.errors && <p className="mt-1 text-rose-600">{result.errors.join("; ")}</p>}
            {result.compiled && (
              <p className="mt-1 text-slate-500">
                类目 {result.compiled.targetCategory} · 脱敏 {result.compiled.detectedLeak ? "命中" : "无"} ·
                清洗后：{result.compiled.sanitizedInput}
              </p>
            )}
          </div>
          {result.ok && result.ammo && <DynamicAmmoSlot ammo={result.ammo} />}
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500">标准提示词 / 原始弹药 JSON</summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-slate-900 p-3 text-slate-100">
              {JSON.stringify(
                { userPrompt: result.compiled?.userPrompt, ammo: result.ammo ?? null },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
