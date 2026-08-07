"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { geoOf, toMapXy, type GeoPoint } from "@/lib/geo";
import { useWaveStore } from "@/store/useWaveStore";

/**
 * S1 匿名光点热力图 — "live city signal" panel on the radar feed.
 * Active waves are projected onto a CSS-grid map as anonymous glowing dots
 * (aggregate view — own signal included, no identity revealed). Dot
 * size/intensity scales with hotness, so "hot spots" read at a glance.
 */
const MAP_ORIGIN: GeoPoint = { lat: 30.5728, lng: 104.0668 };
const SPAN_LNG = 0.5;
const SPAN_LAT = 0.35;

const LOCALITIES: { x: number; y: number; label: string }[] = [
  { x: 0.5, y: 0.5, label: "市中心" },
  { x: 0.32, y: 0.62, label: "高新区" },
  { x: 0.66, y: 0.38, label: "锦江区" },
  { x: 0.44, y: 0.32, label: "金牛区" },
  { x: 0.7, y: 0.65, label: "龙泉驿" },
];

export default function SpatialHeatMap() {
  const waves = useWaveStore((s) => s.waves);

  const dots = useMemo(() => {
    return waves
      .filter((w) => w.status === "active" && !w.removed)
      .map((w) => {
        const p = geoOf(w, MAP_ORIGIN);
        const xy = toMapXy(p, MAP_ORIGIN, SPAN_LNG, SPAN_LAT);
        const hot = Math.max(0, Math.min(1, (w.hotness ?? 0) / 8));
        return { id: w.id, x: xy.x, y: xy.y, hot, category: w.basics.category };
      });
  }, [waves]);

  if (dots.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MapPin size={12} className="text-brandCyan" />
        <span className="text-[10px] font-bold text-white/60">
          匿名热力 · 附近活跃信号波
        </span>
        <span className="ml-auto text-[10px] text-white/35">
          {dots.length} 条 · 位置模糊
        </span>
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
        {/* heat dots — anonymous: size/intensity only, no identity */}
        {dots.map((d) => (
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