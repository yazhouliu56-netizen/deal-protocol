"use client";
import DuoEmpty from "@/components/oto-ui/DuoEmpty";
import { DUO_SETTLE } from "@/lib/duo-motion";
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
  const goHomeTab = useAppStore((s) => s.goHomeTab);
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
  // Batch③-2：三空卡合一。fullyEmpty（无在途/无我发/无预订）只 render 一张统一空卡；
  // 非全空时各区按原语义展示（mywaves/booking 空卡保留，testid 零漂移）。
  const hasMyWaves = useMemo(
    () => waves.some((w) => w.authorId === identity.id),
    [waves, identity.id],
  );
  const fullyEmpty = !activeOrder && !hasMyWaves && bookings.length === 0;
  // 拍照存证按"有可证之物"显隐：全空访客态不再悬浮无单可拍的按钮。
  const canCertify = !fullyEmpty || proofShots.length > 0;
  function openOrder(bookingId: string) { setSelectedBooking(bookingId); setScreen("profile"); }
  const upcoming = bookings.filter((b) => b.status === "upcoming");
  if (fullyEmpty) {
    return (
      <div className="pointer-events-auto">
        <div className="mt-2" data-testid="trip-empty-unified">
          <DuoEmpty
            mascot="beast-empty"
            title="还没有行程"
            desc="去首页说句话——需求、预订、履约都会汇入这里"
            action="✨ 去首页发单"
            onAction={() => goHomeTab("demand")}
            testId="trip-empty-unified"
            launchTestId="trip-empty-unified-launch"
          />
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-auto">
      {canCertify && (
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...DUO_SETTLE, delay: 0.35 }} onClick={() => { const active = waves.find((w) => w.authorId === identity.id && w.status !== "closed" && w.status !== "expired"); setCameraOrderNo(`TRIP-${active?.id ?? "visit"}-${Date.now().toString(36)}`); setPhotoOpen(true); }} aria-label="拍照存证" className="fixed right-4 bottom-28 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white border border-[var(--color-duo-swan)] border-brandCyan/40 text-xs font-bold text-[var(--color-duo-eel)] shadow-[0_4px_20px_-4px_rgba(0,240,255,0.5)] active:translate-y-px active:brightness-[0.97] transition-[transform,filter]">
        <Camera size={14} className="text-brandCyan" /> 拍照存证 {proofShots.length > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-xs font-bold text-white flex items-center justify-center font-tabular">{proofShots.length}</span>}
      </motion.button>
      )}
      <FulfillmentCenter evidencePhotos={proofShots} />
      {!activeOrder && (
        <div className="mt-2" data-testid="trip-empty-state">
          <DuoEmpty
            mascot="capy-sleepy"
            title="当前暂无进行中行程"
            desc="去首页发单，或去雷达抢单 · 履约座舱在此实时接管"
            action="✨ 去首页发单"
            onAction={() => goHomeTab("demand")}
            testId="trip-empty-state"
            launchTestId="trip-empty-launch"
          />
        </div>
      )}
      <MyWaves />
      {bookings.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-semibold text-[var(--color-duo-hare)] mb-2 flex items-center gap-1.5"><span className="w-1 h-3 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" /> 我的预订</span>
          <div className="flex justify-between items-baseline mb-2"><p className="text-xs text-[var(--color-duo-hare)]">共 {bookings.length} 个真实预订 · 点按进入订单详情</p><span className="text-xs px-2 py-0.5 rounded-full bg-brandCyan/15 border border-brandCyan/40 text-brandCyan font-bold">履约中枢</span></div>
          <div className="flex flex-col gap-2">{upcoming.map((b) => (<button key={b.id} onClick={() => openOrder(b.id)} className="w-full bg-white border border-[var(--color-duo-swan)] rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-[colors,transform,filter] active:translate-y-px active:brightness-[0.97]"><div className="w-10 h-10 rounded-xl bg-white border border-[var(--color-duo-swan)] flex items-center justify-center text-lg shrink-0">{CATEGORY_EMOJI[b.category] ?? "🎟️"}</div><div className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="text-xs font-bold truncate">{b.title}</span><span className="text-xs px-1.5 py-px rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple font-semibold shrink-0">待出行</span></span><p className="text-xs text-[var(--color-duo-wolf)] mt-0.5 truncate">{b.time} · {b.providerName}</p></div><span className="text-[12px] font-extrabold text-brandCyan shrink-0">{b.price}</span></button>))}{bookings.filter((b) => b.status !== "upcoming").map((b) => (<button key={b.id} onClick={() => openOrder(b.id)} className="w-full bg-white border border-[var(--color-duo-swan)] rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-[colors,transform,filter] active:translate-y-px active:brightness-[0.97]"><div className="w-10 h-10 rounded-xl bg-white border border-[var(--color-duo-swan)] flex items-center justify-center text-lg shrink-0">{CATEGORY_EMOJI[b.category] ?? "🎟️"}</div><div className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="text-xs font-bold truncate">{b.title}</span><span className={`text-xs px-1.5 py-px rounded-full font-semibold shrink-0 ${b.status === "cancelled" ? "bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] text-[var(--color-duo-hare)]" : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"}`}>{b.status === "cancelled" ? "已取消" : "已完成"}</span></span><p className="text-xs text-[var(--color-duo-wolf)] mt-0.5 truncate">{b.time} · {b.providerName}</p></div><span className="text-[12px] font-extrabold text-brandCyan shrink-0">{b.price}</span></button>))}</div>
        </div>
      )}
      {bookings.length === 0 && (<div className="mt-4"><DuoEmpty mascot="beast-empty" desc="还没有预订——去首页对 AI 说句需求，订单会汇入这里的履约中枢" action="去首页看看" onAction={() => goHomeTab("demand")} testId="booking-empty-state" launchTestId="booking-empty-launch" /></div>)}
      {photoOpen && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50" onClick={() => setPhotoOpen(false)} /><motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="fixed inset-x-3 bottom-24 z-50 bg-white border border-[var(--color-duo-swan)] shadow-sm rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"><div className="flex items-center justify-between mb-3"><h3 className="text-[13px] font-extrabold flex items-center gap-1.5"><Camera size={13} className="text-brandCyan" /> 拍照存证 · 时间地点水印</h3><button onClick={() => setPhotoOpen(false)} aria-label="关闭相机" className="text-[var(--color-duo-hare)] hover:text-[var(--color-duo-eel)]">✕</button></div>{proofShots.length > 0 && <p className="text-xs text-[var(--color-duo-green-dark)] mb-2">✅ 当前已存证 {proofShots.length} 张（含水印 + SHA-256 指纹）</p>}<ProofCamera orderNo={cameraOrderNo} geo={{ lat: 31.2304, lng: 121.4737, accuracyMeters: 25 }} onCaptured={(result) => { onProofShot?.({ photo: result.dataUrl, aiNote: `水印存证 · 时间地点注入 · 哈希 ${result.sha256.slice(0, 8)}` }); setPhotoOpen(false); }} /></motion.div></>)}
    </div>
  );
}
