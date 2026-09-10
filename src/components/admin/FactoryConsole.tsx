"use client";

import { useState } from "react";
import { trackMetric } from "@/lib/track-metric";

/**
 * 工厂控制台（P4-T1）：一句话 → 生成品类卡 → 确认试运行。
 * 引擎与 API 既有（POST /api/ammo/generate：LLM→校验→组装→运行时注册）；
 * 本组件只做开品类操作面＋试运行确认（卡语言与意图卡同构，PriceAnchor 不适用故自立 FactoryCard）。
 * 诚实注记：注册落本机内存，重启失效；上架持久化＋10单/天限流随上线做。
 */

interface FactoryResult {
  ammoId: string;
  category: string;
  holographic: Record<string, unknown>;
}

/** 定价人话（纯函数，可单测）。 */
export function pricingText(h: Record<string, unknown>): string {
  const p = h.pricingModel as { kind?: string; amountYuan?: number; rateYuan?: number; minHours?: number; perSeatYuan?: number; minSeats?: number } | undefined;
  if (!p || typeof p.kind !== "string") return "见配置";
  if (p.kind === "FIXED") return `一口价 ¥${p.amountYuan ?? "?"}`;
  if (p.kind === "HOURLY") return `时薪 ¥${p.rateYuan ?? "?"}/时（≥${p.minHours ?? "?"}时）`;
  if (p.kind === "PER_SEAT") return `按位 ¥${p.perSeatYuan ?? "?"}/位（≥${p.minSeats ?? "?"}位）`;
  return "公式计价（见配置）";
}

/** 字符串数组收敛（纯函数，可单测）。 */
export function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export default function FactoryConsole() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FactoryResult | null>(null);
  const [pilots, setPilots] = useState<FactoryResult[]>([]);

  async function generate() {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ammo/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = (await res.json().catch(() => ({}))) as FactoryResult & { ok?: boolean; error?: string; errors?: string[] };
      if (!res.ok || data.ok === false) {
        setError(data.error ?? data.errors?.join("；") ?? `生成失败（${res.status}）`);
        return;
      }
      setResult({ ammoId: data.ammoId, category: data.category, holographic: data.holographic ?? {} });
    } catch {
      setError("网络异常，稍后重试");
    } finally {
      setBusy(false);
    }
  }

  function confirmPilot() {
    if (!result) return;
    setPilots((list) => (list.some((x) => x.ammoId === result.ammoId) ? list : [...list, result]));
    try {
      trackMetric("factory.generated", 1, { ammoId: result.ammoId });
    } catch {}
  }

  const h = result?.holographic ?? {};
  const fuze = (h.fuzePolicy as { kind?: string } | undefined)?.kind ?? "—";
  const hooks = strList(h.forwardHooks);
  const sensors = strList(h.requiredSensors);
  const fields = ((h.formSchema as { fields?: { key?: string }[] } | undefined)?.fields ?? [])
    .map((f) => f?.key)
    .filter((k): k is string => typeof k === "string");

  return (
    <div data-testid="factory-console" className="space-y-3">
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void generate();
          }}
          aria-label="一句话开品类"
          placeholder="如：上门给猫洗澡"
          className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
        />
        <button
          onClick={() => void generate()}
          disabled={busy || !prompt.trim()}
          aria-label="生成品类"
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
        >
          {busy ? "生成中…" : "生成品类"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-bold text-red-500">
          {error}
        </p>
      )}
      {result && (
        <div data-testid="factory-card" className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-3 text-sm">
          <p className="font-extrabold">
            {result.category}
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              试运行·本机有效
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-600">ID {result.ammoId}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>💰 定价：{pricingText(h)}</li>
            <li>🛡️ 风控引信：{fuze}</li>
            <li>🔗 履约环节：{hooks.length > 0 ? hooks.join(" / ") : "无"}</li>
            <li>📷 传感：{sensors.length > 0 ? sensors.join(" / ") : "无"}</li>
            <li>📋 验收字段：{fields.length > 0 ? fields.join("、") : "无"}</li>
          </ul>
          <button
            onClick={confirmPilot}
            aria-label="确认试运行"
            className="mt-2 w-full rounded-xl bg-emerald-500 py-2 text-sm font-extrabold text-white"
          >
            确认试运行
          </button>
          <p className="mt-1 text-[11px] text-slate-400">注册落本机内存，重启失效；上架持久化随上线做。</p>
        </div>
      )}
      {pilots.length > 0 && (
        <div data-testid="factory-pilots" className="rounded-2xl border border-slate-200 p-3 text-sm">
          <p className="text-xs font-bold text-slate-500">本机试运行品类（{pilots.length}）</p>
          {pilots.map((p) => (
            <p key={p.ammoId} className="mt-1 text-xs">
              {p.category} · {p.ammoId}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
