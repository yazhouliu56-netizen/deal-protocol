"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Check, Users } from "lucide-react";
import QRCode from "qrcode";
import type { Wave } from "@/base/order/wave";

/**
 * 拼位裂变 ShareKit — 纯本地实现。
 * - 复制分享文案（URL 带 wave 参数 + 邀请口令）
 * - 真二维码（qrcode 本地 canvas 生成，离线可用；扫码直达 /?wave=&via=）
 * - 展示真实裂变数 fissionCount（仅"回应/成局"计，防自刷）
 */
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
  const [qrFailed, setQrFailed] = useState(false);
  const count = wave.fissionCount ?? 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 打开时在本地 canvas 生成真二维码（无网络请求，离线可用）。
  useEffect(() => {
    const c = canvasRef.current;
    if (!open || !c) return;
    setQrFailed(false);
    QRCode.toCanvas(c, shareUrl(wave), { width: 224, margin: 1 })
      .catch(() => setQrFailed(true));
  }, [open, wave]);

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
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-panel-interactive text-xs font-bold text-brandCyan hover:border-brandCyan/50 transition-colors"
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
          <p className="text-xs font-bold text-white/80">
            邀请拼位 · 拉新
          </p>
          <p className="text-xs leading-relaxed text-white/45">
            别人通过你的分享加入并回应/成交，才计裂变
            <span className="text-brandCyan">（分享本身不计，防自刷）</span>。
          </p>

          {/* 真二维码：扫码直达分享局 */}
          <div className="flex justify-center">
            {qrFailed ? (
              <span className="w-28 h-28 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-white/40 px-2 text-center">
                二维码生成失败，请用「复制分享文案」
              </span>
            ) : (
              <canvas
                ref={canvasRef}
                className="w-28 h-28 rounded-lg bg-white p-1.5"
                role="img"
                aria-label="拼位邀请二维码"
              />
            )}
          </div>

          <button
            onClick={copy}
            className="w-full py-2 rounded-xl btn-primary text-xs font-bold glow-purple-strong flex items-center justify-center gap-1.5"
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