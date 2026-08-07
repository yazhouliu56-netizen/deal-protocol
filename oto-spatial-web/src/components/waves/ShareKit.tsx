"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Check, Users } from "lucide-react";
import type { Wave } from "@/lib/wave";

/**
 * 拼位裂变 ShareKit — 纯本地实现。
 * - 复制分享文案（URL 带 wave 参数 + 邀请口令）
 * - 伪二维码（确定性 grid，离线可用；真码 P8 接第三方库）
 * - 展示真实裂变数 fissionCount（仅"回应/成局"计，防自刷）
 */
function fakeQr(seed: string, size = 21): boolean[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  let x = 0x811c9dc5;
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    x ^= (h >> (i % 17)) & 1;
    x = Math.imul(x, 0x01000193) >>> 0;
    cells.push((x >>> 0) % 97 < 46);
  }
  return cells;
}

function shareUrl(wave: Wave): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/?wave=${encodeURIComponent(wave.id)}&via=${encodeURIComponent(wave.authorId)}`;
}

function shareText(wave: Wave): string {
  return `【拼位邀请】${wave.basics.category} · ${wave.basics.time} @ ${wave.basics.area}，人均 ¥${wave.budget}，差 ${wave.capacity - 1} 人成局。点链接来拼位：${shareUrl(wave)}`;
}

export default function ShareKit({ wave }: { wave: Wave }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const count = wave.fissionCount ?? 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(wave));
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareText(wave);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-panel-interactive text-[9.5px] font-bold text-brandCyan hover:border-brandCyan/50 transition-colors"
        aria-label="分享拼位 · 拉新裂变"
        aria-expanded={open}
      >
        <Share2 size={10} />
        邀请拼位
        {count > 0 && (
          <span className="flex items-center gap-0.5 text-white/60">
            · <Users size={9} /> {count}
          </span>
        )}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute right-0 top-full mt-2 z-30 w-56 rounded-2xl glass-panel p-3 space-y-2.5 shadow-2xl"
        >
          <p className="text-[10px] font-bold text-white/80">
            邀请拼位 · 拉新
          </p>
          <p className="text-[9px] leading-relaxed text-white/45">
            别人通过你的分享加入并回应/成交，才计裂变
            <span className="text-brandCyan">（分享本身不计，防自刷）</span>。
          </p>

          {/* 伪二维码 */}
          <div className="flex justify-center">
            <svg
              viewBox="0 0 21 21"
              className="w-28 h-28 rounded-lg bg-white p-1.5"
              role="img"
              aria-label="拼位邀请二维码（模拟）"
            >
              {fakeQr(wave.id).map((on, i) => {
                const x = i % 21;
                const y = Math.floor(i / 21);
                if (!on) return null;
                return (
                  <rect key={i} x={x} y={y} width={1} height={1} fill="#0d1025" />
                );
              })}
            </svg>
          </div>

          <button
            onClick={copy}
            className="w-full py-2 rounded-xl btn-primary text-[10px] font-bold glow-purple-strong flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check size={11} /> 已复制
              </>
            ) : (
              <>
                <Share2 size={11} /> 复制分享文案
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}