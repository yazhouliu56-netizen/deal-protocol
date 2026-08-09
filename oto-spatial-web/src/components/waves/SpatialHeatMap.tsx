"use client";
import { useMemo, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { MapPin, RotateCw } from "lucide-react";
import { geoOf, toMapXy, type GeoPoint } from "@/lib/geo";
import { isLowPower, webglSupported } from "@/lib/performance";
import { useWaveStore } from "@/store/useWaveStore";
import {
  AMBIENT_POIS,
  buildMapDots,
  mapTier,
  MAP_CENTER,
  resolveMapTier,
  type MapOverride,
  type MapTier,
} from "@/lib/mapConfig";
import { cycleMapPref, useMapPref } from "@/lib/mapPref";
import MapView from "./MapView";

/**
 * S1→P3 匿名光点热力图升级面板 — "live city signal" on the radar feed.
 *
 * - Strong devices (WebGL + memory OK): real map (MapLibre + OpenFreeMap,
 *   3D perspective, ADR-0004) with anonymous glowing dots for active waves.
 * - Low power / no WebGL: falls back to the S1 CSS-grid city signal (same
 *   anonymity semantics, zero third-party tiles). Never a blank card.
 */

const MAP_ORIGIN: GeoPoint = { lat: MAP_CENTER.lat, lng: MAP_CENTER.lng };
const SPAN_LNG = 0.5;
const SPAN_LAT = 0.35;

const LOCALITIES: { x: number; y: number; label: string }[] = [
  { x: 0.5, y: 0.5, label: "市中心" },
  { x: 0.32, y: 0.62, label: "高新区" },
  { x: 0.66, y: 0.38, label: "锦江区" },
  { x: 0.44, y: 0.32, label: "金牛区" },
  { x: 0.7, y: 0.65, label: "龙泉驿" },
];

/** 模式切换开关（自动 → 强制 3D → 强制简约网格）。 */
function ModeToggle({
  count,
  pref,
}: {
  count: number;
  pref: MapOverride;
}) {
  return (
    <span className="ml-auto flex items-center gap-2">
      <span className="text-[10px] text-white/35">{count} 条 · 位置模糊</span>
      <button
        type="button"
        onClick={() => cycleMapPref()}
        title={
          pref === "auto"
            ? "跟随设备性能（可点击切换）"
            : pref === "3d"
              ? "强制 3D 地图（点击切换）"
              : "强制简约网格（点击切换）"
        }
        aria-label="地图显示模式切换"
        className="rounded-full border border-white/10 p-1 hover:bg-white/10"
      >
        <RotateCw size={10} className="text-white/60" />
      </button>
    </span>
  );
}

export default function SpatialHeatMap() {
  const waves = useWaveStore((s) => s.waves);

  // tier 依赖浏览器探针（deviceMemory / WebGL / reduced-motion），SSR 与
  // 首帧客户端不一致会触发 React hydration 错误 —— mounted 用官方推荐的
  // useSyncExternalStore（server 快照 = false）达到同构，浏览器挂载后再判定。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
const pref = useMapPref();
  const tier: MapTier | null = mounted
    ? resolveMapTier(
        mapTier({ lowPower: isLowPower(), webgl: webglSupported() }),
        pref
      )
    : null;

  const cssDots = useMemo(
    () =>
      waves
        .filter((w) => w.status === "active" && !w.removed)
        .map((w) => {
          const p = geoOf(w, MAP_ORIGIN);
          return {
            id: w.id,
            x: toMapXy(p, MAP_ORIGIN, SPAN_LNG, SPAN_LAT).x,
            y: toMapXy(p, MAP_ORIGIN, SPAN_LNG, SPAN_LAT).y,
            hot: Math.max(0, Math.min(1, (w.hotness ?? 0) / 8)),
            category: w.basics.category,
          };
        }),
    [waves]
  );
  const ambientCss = useMemo(
    () =>
      AMBIENT_POIS.map((p) => toMapXy(p, MAP_ORIGIN, SPAN_LNG, SPAN_LAT)),
    []
  );
  const dots = useMemo(
    () =>
      buildMapDots(
        waves.map((w) => ({
          id: w.id,
          status: w.status,
          removed: w.removed,
          hotness: w.hotness,
          category: w.basics?.category,
          position: geoOf(w, MAP_ORIGIN),
        }))
      ),
    [waves]
  );

  if (tier === null) {
    // SSR/首帧同构占位（等高容器，避免水合错位 + 布局跳动）
    return (
      <div className="mt-3">
        <div className="h-56 rounded-2xl overflow-hidden border border-white/10 bg-[#0d1025]/80" />
      </div>
    );
  }

  if (tier === "3d") {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={12} className="text-brandCyan" />
          <span className="text-[10px] font-bold text-white/60">
            附近信号 · 3D 地图
          </span>
          <ModeToggle count={dots.length} pref={pref} />
        </div>
        <div className="relative h-56 rounded-2xl overflow-hidden border border-white/10 bg-[#0d1025]/80">
          <MapView dots={dots} ambient={AMBIENT_POIS} className="absolute inset-0" />
        </div>
      </div>
    );
  }

  // CSS-grid fallback (S1 original) — no map engine, no network tiles
  if (cssDots.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MapPin size={12} className="text-brandCyan" />
        <span className="text-[10px] font-bold text-white/60">
          匿名热力 · 附近活跃信号波
        </span>
        <ModeToggle count={cssDots.length} pref={pref} />
      </div>
      <div className="relative h-28 rounded-2xl overflow-hidden border border-white/10 bg-[#0d1025]/80">
        {/* city grid */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(123,97,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(123,97,255,0.12) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* locality labels */}
        {LOCALITIES.map((l) => (
          <span
            key={l.label}
            className="absolute text-[8px] text-white/30 font-medium"
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              transform: "translate(-50%, 50%)",
            }}
          >
            {l.label}
          </span>
        ))}
        {/* ambient city-life dots (cold-start density, no identity) */}
        {ambientCss.map((p, i) => (
          <span
            key={`amb-${i}`}
            className="absolute rounded-full bg-white/20"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: 3,
              height: 3,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
        {/* heat dots — anonymous: size/intensity only, no identity */}
        {cssDots.map((d) => (
          <motion.button
            key={d.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.55 + d.hot * 0.4 }}
            transition={{
              delay: (d.id.length % 5) * 0.05,
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            title={d.category}
            aria-label={`活跃信号波：${d.category}`}
            className="absolute rounded-full pointer-events-auto"
            style={{
              left: `${d.x * 100}%`,
              top: `${d.y * 100}%`,
              width: 10 + d.hot * 16,
              height: 10 + d.hot * 16,
              transform: "translate(-50%, -50%)",
              background:
                d.hot > 0.5
                  ? "radial-gradient(circle, rgba(0,240,255,0.95), rgba(123,97,255,0.35) 65%, transparent)"
                  : "radial-gradient(circle, rgba(0,240,255,0.7), rgba(123,97,255,0.2) 65%, transparent)",
              boxShadow:
                d.hot > 0.5
                  ? "0 0 14px rgba(0,240,255,0.9)"
                  : "0 0 8px rgba(0,240,255,0.5)",
            }}
          />
        ))}
      </div>
    </div>
  );
}