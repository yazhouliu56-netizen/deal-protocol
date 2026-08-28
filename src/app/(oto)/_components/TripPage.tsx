"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { useAppStore } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import ProofCamera from "@/components/oto-ui/controls/ProofCamera";
import FulfillmentCenter from "@/components/waves/FulfillmentCenter";
import MyWaves from "@/components/waves/MyWaves";
import { CATEGORY_EMOJI } from "./categoryEmoji";
import type { ArbitrationPhotoEvidence } from "@/components/waves/ArbitrationSheet";

export default function TripPage({ proofShots = [], onProofShot }: { proofShots?: ArbitrationPhotoEvidence[]; onProofShot?: (shot: ArbitrationPhotoEvidence) => void }) {
  const bookings = useAppStore((s) => s.bookings);
  const setSelectedBooking = useAppStore((s) => s.setSelectedBooking);
  const setScreen = useAppStore((s) => s.setScreen);
  const waves = useWaveStore((s) => s.waves);
  const identity = useIdentityStore((s) => s.identity);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [cameraOrderNo, setCameraOrderNo] = useState("trip-001");
  useEffect(() => { lockEdgeGesture(photoOpen); }, [photoOpen]);
  const activeOrder = useMemo(() => {
    const mine = waves.filter((w) => w.authorId === identity.id && w.status !== "closed" && w.status !== "expired" && w.status !== "pending" && !w.removed);
    return mine[0] ?? null;
  }, [waves, identity.id]);
  function openOrder(bookingId: string) { setSelectedBooking(bookingId); setScreen("profile"); }
  const upcoming = bookings.filter((b) => b.status === "upcoming");
  return (
    <div className="pointer-events-auto">
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} whileTap={{ scale: 0.94 }} onClick={() => { const active = waves.find((w) => w.authorId === identity.id && w.status !== "closed" && w.status !== "expired"); setCameraOrderNo(`TRIP-${active?.id ?? "visit"}-${Date.now().toString(36)}`); setPhotoOpen(true); }} aria-label="拍照存证" className="fixed right-4 bottom-28 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full glass-panel border-brandCyan/40 text-xs font-bold text-white/90 shadow-[0_4px_20px_-4px_rgba(0,240,255,0.5)] active:scale-95 transition-transform">
        <Camera size={14} className="text-brandCyan" /> 拍照存证 {proofShots.length > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-xs font-bold text-white flex items-center justify-center font-tabular">{proofShots.length}</span>}
      </motion.button>
      <FulfillmentCenter evidencePhotos={proofShots} />
      {!activeOrder && (
        <div className="mt-2 glass-panel rounded-3xl p-6 flex flex-col items-center text-center" data-testid="trip-empty-state">
          <div className="relative w-20 h-20 flex items-center justify-center"><span className="absolute inset-0 rounded-full border border-brandCyan/30 animate-ping" /><span className="absolute inset-2.5 rounded-full border border-brandPurple/30" /><span className="text-2xl">📡</span></div>
          <p className="text-[12px] font-extrabold text-white/85 mt-3">当前暂无进行中行程</p>
          <p className="text-xs text-white/45 mt-1">去首页发单，或去雷达抢单 · 履约座舱在此实时接管</p>
          <button onClick={() => setScreen("home")} className="mt-3 px-4 py-2 rounded-xl btn-primary glow-purple-strong text-xs font-bold active:scale-95 transition-[filter,transform]">✨ 去首页发单</button>
        </div>
      )}
      <MyWaves />
      {bookings.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-semibold text-white/50 mb-2 flex items-center gap-1.5"><span className="w-1 h-3 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" /> 我的预订</span>
          <div className="flex justify-between items-baseline mb-2"><p className="text-xs text-white/40">共 {bookings.length} 个真实预订 · 点按进入订单详情</p><span className="text-xs px-2 py-0.5 rounded-full bg-brandCyan/15 border border-brandCyan/40 text-brandCyan font-bold">履约中枢</span></div>
          <div className="flex flex-col gap-2">{upcoming.map((b) => (<button key={b.id} onClick={() => openOrder(b.id)} className="w-full glass-panel rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"><div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">{CATEGORY_EMOJI[b.category] ?? "🎟️"}</div><div className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="text-[12.5px] font-bold truncate">{b.title}</span><span className="text-xs px-1.5 py-px rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple font-semibold shrink-0">待出行</span></span><p className="text-xs text-white/50 mt-0.5 truncate">{b.time} · {b.providerName}</p></div><span className="text-[12px] font-extrabold text-brandCyan shrink-0">{b.price}</span></button>))}{bookings.filter((b) => b.status !== "upcoming").map((b) => (<button key={b.id} onClick={() => openOrder(b.id)} className="w-full glass-panel rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"><div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">{CATEGORY_EMOJI[b.category] ?? "🎟️"}</div><div className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="text-[12.5px] font-bold truncate">{b.title}</span><span className={`text-xs px-1.5 py-px rounded-full font-semibold shrink-0 ${b.status === "cancelled" ? "bg-white/10 border border-white/20 text-white/50" : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"}`}>{b.status === "cancelled" ? "已取消" : "已完成"}</span></span><p className="text-xs text-white/50 mt-0.5 truncate">{b.time} · {b.providerName}</p></div><span className="text-[12px] font-extrabold text-brandCyan shrink-0">{b.price}</span></button>))}</div>
        </div>
      )}
      {bookings.length === 0 && (<div className="mt-4 glass-panel rounded-2xl p-4 text-center"><p className="text-xs text-white/40">还没有预订——去首页对 AI 说句需求，订单会汇入这里的履约中枢</p></div>)}
      {photoOpen && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setPhotoOpen(false)} /><motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"><div className="flex items-center justify-between mb-3"><h3 className="text-[13px] font-extrabold flex items-center gap-1.5"><Camera size={13} className="text-brandCyan" /> 拍照存证 · 时间地点水印</h3><button onClick={() => setPhotoOpen(false)} aria-label="关闭相机" className="text-white/40 hover:text-white">✕</button></div>{proofShots.length > 0 && <p className="text-xs text-emerald-300/80 mb-2">✅ 当前已存证 {proofShots.length} 张（含水印 + SHA-256 指纹）</p>}<ProofCamera orderNo={cameraOrderNo} geo={{ lat: 31.2304, lng: 121.4737, accuracyMeters: 25 }} onCaptured={(result) => { onProofShot?.({ photo: result.dataUrl, aiNote: `水印存证 · 时间地点注入 · 哈希 ${result.sha256.slice(0, 8)}` }); setPhotoOpen(false); }} /></motion.div></>)}
    </div>
  );
}
