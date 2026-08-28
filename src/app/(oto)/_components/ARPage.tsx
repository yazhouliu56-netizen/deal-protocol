"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Info, Rotate3d, Star } from "lucide-react";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { useAppStore } from "@/store/useAppStore";
import GlassCard from "@/components/oto-ui/GlassCard";
import GlassIconButton from "@/components/oto-ui/GlassIconButton";
import ProofCamera from "@/components/oto-ui/controls/ProofCamera";
import { toast } from "@/base/platform/toast";
import type { ArbitrationPhotoEvidence } from "@/components/waves/ArbitrationSheet";

const SWATCHES = [{ color: "#7B61FF", label: "紫罗兰" }, { color: "#00A3FF", label: "天蓝" }, { color: "#4ADE80", label: "草绿" }, { color: "#F472B6", label: "粉红" }];
const AR_SCENE_POINTS = [{ id: "arena", emoji: "🏸", name: "星羽羽毛球馆", meta: "场地空 3 片 · 空调 · 近地铁", rating: 4.8, price: "¥80/小时", distance: "1.2 km", draft: "周六晚上想找人打羽毛球，业余水平", x: "70%", y: "22%" }, { id: "photo", emoji: "📷", name: "滨江街拍点位", meta: "日系摄影师常驻 · 日落光线绝佳", rating: 4.9, price: "¥499/套", distance: "800 m", draft: "想约摄影师拍一组日系写真", x: "24%", y: "62%" }, { id: "clean", emoji: "🧹", name: "王姐保洁 · 上门", meta: "10 年经验 · 好评王 · 自备工具", rating: 5.0, price: "¥180/次", distance: "2.0 km", draft: "周末找个保洁上门", x: "74%", y: "58%" }];

export default function ARPage({ proofShots, onProofShot }: { proofShots: ArbitrationPhotoEvidence[]; onProofShot: (shot: ArbitrationPhotoEvidence) => void }) {
  const selectedExperience = useAppStore((s) => s.selectedExperience);
  const activeSwatch = useAppStore((s) => s.activeSwatch);
  const setActiveSwatch = useAppStore((s) => s.setActiveSwatch);
  const showInfo = useAppStore((s) => s.showInfo);
  const toggleShowInfo = useAppStore((s) => s.toggleShowInfo);
  const resetView = useAppStore((s) => s.resetView);
  const cart = useAppStore((s) => s.cart);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const setScreen = useAppStore((s) => s.setScreen);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const [mode, setMode] = useState<"scene" | "preview">("scene");
  const [activePoint, setActivePoint] = useState<null | (typeof AR_SCENE_POINTS)[number]>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  useEffect(() => { lockEdgeGesture(photoOpen); }, [photoOpen]);
  const addedToCart = cart.includes(selectedExperience.id);
  const [cameraOrderNo, setCameraOrderNo] = useState(() => `AR-${selectedExperience.id}-${Date.now().toString(36)}`);
  function goMatch(draft: string) { setAiDraft(draft); setScreen("home"); }
  return (
    <div className="flex-1 w-full flex flex-col items-center relative min-h-0 pointer-events-auto">
      <div className="flex items-center gap-1.5 z-20 shrink-0 mb-2 pointer-events-auto">{([{ id: "scene", label: "📸 场景探索", hint: "对准真实场景找服务" }, { id: "preview", label: "✨ 体验预览", hint: "全息 3D 体验" }] as const).map((m) => (<button key={m.id} onClick={() => { setMode(m.id); setActivePoint(null); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === m.id ? "btn-primary glow-purple-strong" : "glass-panel text-white/60 hover:text-white"}`}>{m.label}</button>))}</div>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center relative">
        {mode === "scene" ? (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 scene-grid" />
            <div className="absolute left-[8%] top-[18%] text-[64px] opacity-25 blur-[2px]">🏢</div>
            <div className="absolute right-[6%] top-[30%] text-[48px] opacity-20 blur-[3px]">🌳</div>
            <div className="absolute left-[15%] bottom-[12%] text-[56px] opacity-20 blur-[2px]">🏠</div>
            <div className="absolute inset-x-6 top-4 bottom-6 rounded-2xl border border-white/15 pointer-events-none"><span className="absolute -top-[7px] left-3 px-1 text-xs tracking-[0.3em] text-white/40 bg-black/30 rounded">AR 取景框</span></div>
            <div className="absolute inset-0 pointer-events-auto">{AR_SCENE_POINTS.map((p) => (<button key={p.id} onClick={() => setActivePoint(p)} aria-label={p.name} className="absolute flex flex-col items-center group active:scale-95 transition-transform" style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}><span className={`w-3.5 h-3.5 rounded-full ${activePoint?.id === p.id ? "bg-emerald-400" : "bg-brandCyan"} animate-ping-once`} /><span className="mt-1.5 px-2 py-1 rounded-full glass-panel text-xs font-bold text-white/90 whitespace-nowrap">{p.emoji} {p.name}</span><span className="mt-0.5 text-xs text-white/45">{p.distance}</span></button>))}</div>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 pointer-events-none"><div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50"><Rotate3d size={13} className="text-brandCyan" /><span className="text-xs tracking-wide">拖拽鼠标/手指 360° 旋转查看 3D 模型</span></div></div>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5 z-20 pointer-events-auto"><span className="text-xs tracking-[0.25em] text-white/40 font-medium mb-0.5">材质</span>{SWATCHES.map((s) => (<button key={s.color} onClick={() => setActiveSwatch(s.color)} aria-label={s.label} className={`w-6 h-6 rounded-full transition-transform ${activeSwatch === s.color ? "scale-110 ring-2 ring-white/60 ring-offset-2 ring-offset-black/40" : "opacity-80 hover:opacity-100"}`} style={{ backgroundColor: s.color }} />))}</div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 pointer-events-auto"><GlassIconButton size="sm" aria-label="重置视角" onClick={resetView} className="text-brandCyan font-bold text-xs glow-cyan">360</GlassIconButton><GlassIconButton size="sm" aria-label="查看详情" onClick={toggleShowInfo}><Info size={14} /></GlassIconButton><GlassIconButton size="sm" aria-label="拍照存证" onClick={() => { setCameraOrderNo(`AR-${selectedExperience.id}-${Date.now().toString(36)}`); setPhotoOpen(true); }} className="relative"><Camera size={14} />{proofShots.length > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-xs font-bold text-white flex items-center justify-center">{proofShots.length}</span>}</GlassIconButton></div>
          </>
        )}
      </div>
      <div className="w-full z-20 space-y-3 shrink-0 pointer-events-auto">
        {mode === "scene" ? (
          <>{activePoint ? (<motion.div key={activePoint.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="glass-panel p-4 rounded-3xl animate-float-slow"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl glass-panel flex items-center justify-center text-xl shrink-0">{activePoint.emoji}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-1.5"><h3 className="font-bold text-[14px] truncate">{activePoint.name}</h3><span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-400 shrink-0"><Star size={10} className="fill-yellow-400" />{activePoint.rating}</span></div><p className="text-xs text-white/55 mt-0.5 truncate">{activePoint.meta}</p><p className="text-xs text-brandCyan font-bold mt-0.5">{activePoint.price} · 距你 {activePoint.distance}</p></div></div><button onClick={() => goMatch(activePoint.draft)} className="w-full mt-3 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]">找 AI 撮合 →</button></motion.div>) : (<div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-2 animate-float-slow"><span className="text-xs">📡</span><p className="text-xs text-white/60">对准真实场景，点击光点探索附近可撮合服务</p></div>)}</>
        ) : (
          <>
            <AnimatePresence>{showInfo && (<motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: 10, height: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden"><GlassCard className="p-3.5 rounded-2xl"><p className="text-xs text-white/80 leading-relaxed">{selectedExperience.description}</p></GlassCard></motion.div>)}</AnimatePresence>
            <div className="glass-panel p-4 rounded-3xl animate-float-slow"><div className="flex justify-between items-start mb-1"><div><h3 className="font-bold text-[15px]">{selectedExperience.title} · {selectedExperience.location}</h3><p className="text-xs text-white/60 mt-0.5">{selectedExperience.subtitle} · {selectedExperience.price}</p></div><span className="flex items-center gap-1 text-xs font-semibold text-yellow-400 shrink-0"><Star size={11} className="fill-yellow-400" /> {selectedExperience.rating}</span></div><div className="flex gap-3"><button onClick={() => goMatch(`想预约 ${selectedExperience.title} · ${selectedExperience.location} 的体验工作坊`)} className="flex-1 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]">预约工作坊</button><button onClick={() => toggleCart(selectedExperience.id)} className={`flex-1 py-2.5 rounded-2xl glass-panel font-bold text-xs transition-colors ${addedToCart ? "border-emerald-400/60 text-emerald-300 glow-cyan" : "hover:border-white/60"}`}>{addedToCart ? "已加入" : "心愿单"}</button></div></div>
          </>
        )}
      </div>
      {photoOpen && (<><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setPhotoOpen(false)} /><motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"><div className="flex items-center justify-between mb-3"><h3 className="text-[13px] font-extrabold flex items-center gap-1.5"><Camera size={13} className="text-brandCyan" /> 拍照存证 · 时间地点水印</h3><button onClick={() => setPhotoOpen(false)} aria-label="关闭相机" className="text-white/40 hover:text-white">✕</button></div>{proofShots.length > 0 && <p className="text-xs text-emerald-300/80 mb-2">✅ 当前已存证 {proofShots.length} 张（含水印 + SHA-256 指纹）</p>}<ProofCamera orderNo={cameraOrderNo} geo={{ lat: 31.2304, lng: 121.4737, accuracyMeters: 25 }} onCaptured={(result) => { onProofShot({ photo: result.dataUrl, aiNote: `水印存证 · 时间地点注入 · 哈希 ${result.sha256.slice(0, 8)}` }); setPhotoOpen(false); toast("✅ 存证照片已生成 · 时间地点水印 + 哈希指纹已记录", "success"); }} /></motion.div></>)}
    </div>
  );
}
