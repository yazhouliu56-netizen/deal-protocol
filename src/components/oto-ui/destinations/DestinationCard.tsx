"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import HoloCard, { HoloBoundary } from "@/components/oto-ui/3d/HoloCard";
import OtoBadge from "@/components/oto-ui/OtoBadge";
import { isLowPower } from "@/base/platform/performance";
import type { OTOExperience } from "@/lib/mockData";

/** IntersectionObserver-powered lazy loader (photo above-the-fold). */
function useInView<T extends HTMLElement>(margin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { rootMargin: margin }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [margin]);
  return { ref, inView };
}

/** Lazy-loaded sunny destination photo with shimmer skeleton + fade-in. */
function DestinationCardImage({
  url,
  onReady,
}: {
  url: string;
  onReady?: () => void;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const img = new Image();
    img.onload = () => {
      setLoaded(true);
      onReady?.();
    };
    img.onerror = () => setFailed(true);
    img.src = url;
  }, [inView, url, onReady]);

  return (
    <div ref={ref} className="absolute inset-0">
      {!loaded && !failed && <div className="absolute inset-0 shimmer" />}
      {failed && (
        <div className="absolute inset-0 bg-linear-to-b from-brandPurple/30 to-[#0d1030]" />
      )}
      {inView && (
        <div
          className={`absolute inset-0 bg-cover bg-center [mask-image:linear-gradient(to_top,black_45%,transparent_100%)] [mask-size:100%_100%] transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${url})` }}
        />
      )}
    </div>
  );
}

/**
 * 3D holographic destination card with 2D lazy fallback
 * (low power / offline / no WebGL) — reused by home grid and 目的地中心.
 */
export default function DestinationCard({
  item,
  onOpen,
}: {
  item: OTOExperience;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [holoFailed, setHoloFailed] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lowPower = useMemo(() => isLowPower(), []);
  // Mounted first so SSR and first client frame both render the 2D fallback
  // (isLowPower() differs on server vs client — avoids hydration mismatch).
  // 3D mounts only after the 2D photo is ready: texture loads from browser
  // cache instantly, so there is never a white/blank 3D card on slow networks.
  const use3D = mounted && !lowPower && !holoFailed && photoReady;
  const priceParts = useMemo(() => {
    const idx = item.price.indexOf("/");
    return idx > 0
      ? [item.price.slice(0, idx), item.price.slice(idx)]
      : [item.price, ""];
  }, [item.price]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="animate-float-slow"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.button
        onClick={onOpen}
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className="relative w-full h-44 md:h-48 lg:h-56 rounded-3xl overflow-hidden glass-panel-interactive text-left"
      >
        {use3D ? (
          <HoloBoundary onFail={() => setHoloFailed(true)}>
            <HoloCard url={item.imageUrl} hover={hover} />
          </HoloBoundary>
        ) : (
          <DestinationCardImage
            url={item.imageUrl}
            onReady={() => setPhotoReady(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 card-inlay p-2.5 rounded-b-3xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-extrabold truncate">
              {item.title}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-bold text-yellow-400 bg-white/10 backdrop-blur-sm rounded-full px-1.5 py-0.5 shrink-0">
              <Star size={9} className="fill-yellow-400" />
              {item.rating}
            </span>
          </div>
          <span className="text-xs text-white/60 block truncate">
            {item.subtitle}
          </span>
          <span className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
              {priceParts[0]}
            </span>
            <span className="text-xs font-light text-white/50">
              {priceParts[1]}
            </span>
          </span>
        </div>
        {item.hasAR && <OtoBadge className="absolute top-2.5 right-2.5">AR</OtoBadge>}
      </motion.button>
    </motion.div>
  );
}