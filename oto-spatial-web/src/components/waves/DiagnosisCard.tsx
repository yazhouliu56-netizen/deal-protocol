"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquareText } from "lucide-react";
import { mockDiagnose, type DiagnosisAdvice } from "@/base/ai/diagnostic";
import type { Wave } from "@/base/order/wave";

/**
 * S2 AI 主动诊断卡 — an active wave with zero claims (published ≥ 2min)
 * gets actionable advice instead of silence. The server LLM chain
 * (/api/diagnose) refines the wording when keys exist; the deterministic
 * local engine always produces something, so the card works offline.
 */
export default function DiagnosisCard({ wave }: { wave: Wave }) {
  const [advice, setAdvice] = useState<DiagnosisAdvice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const payload = {
      id: wave.id,
      budget: wave.budget,
      basics: wave.basics,
      customs: wave.customs,
      negotiable: wave.negotiable,
      capacity: wave.capacity,
      createdAt: wave.createdAt,
    };
    (async () => {
      let list: DiagnosisAdvice[] = [];
      try {
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = (await res.json()) as { advice?: DiagnosisAdvice[] };
          list = data.advice ?? [];
        }
      } catch {
        // offline → local rule engine
      }
      if (list.length === 0) {
        list = mockDiagnose(payload);
      }
      if (!cancelled) {
        setAdvice(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wave.id, wave.budget, wave.basics, wave.customs, wave.negotiable, wave.capacity, wave.createdAt]);

  if (loading) return null;
  if (advice.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-brandPurple/10 border border-brandPurple/30 p-3 space-y-2"
    >
      <p className="text-[10px] font-bold text-brandPurple flex items-center gap-1">
        <Sparkles size={11} /> AI 主动诊断 · 还没人响应
      </p>
      {advice.map((a, i) => (
        <div
          key={a.id ?? `${wave.id}-${a.kind}-${i}`}
          className="rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-2"
        >
          <p className="text-[10.5px] font-bold text-white/90 flex items-start gap-1.5">
            <MessageSquareText size={11} className="mt-0.5 shrink-0 text-brandCyan" />
            {a.title}
            {a.value && (
              <span className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brandCyan/15 border border-brandCyan/40 text-brandCyan">
                {a.value}
              </span>
            )}
          </p>
          <p className="text-[10px] text-white/60 mt-1 leading-relaxed">{a.body}</p>
        </div>
      ))}
    </motion.div>
  );
}