"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isLowPower } from "@/base/platform/performance";

/** Deterministic pseudo-random in [0,1) — pure, so particle layouts are stable across re-renders. */
function hash01(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildDust(count: number, color: number, size: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    pos[i] = (hash01(i + 1) - 0.5) * 10;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size,
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

/** 60 drifting space-dust particles (cyan + purple) behind the glass UI. Halved on low power. */
export default function StarDust() {
  const lowPower = useMemo(() => isLowPower(), []);
  const cyan = useMemo(
    () => buildDust(lowPower ? 20 : 40, 0x00f0ff, 0.075),
    [lowPower]
  );
  const purple = useMemo(
    () => buildDust(lowPower ? 10 : 20, 0x7b61ff, 0.09),
    [lowPower]
  );
  const parts = useRef({ cyan, purple });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { cyan: c, purple: p } = parts.current;
    const pulse = 0.8 + Math.sin(t * 1.6) * 0.2;
    (c.material as THREE.PointsMaterial).opacity = 0.95 * pulse;
    (p.material as THREE.PointsMaterial).opacity = 0.95 * pulse;
    c.rotation.y = -t * 0.04;
    p.rotation.y = t * 0.06;
  });

  return (
    <>
      <points geometry={cyan.geometry} material={cyan.material} />
      <points geometry={purple.geometry} material={purple.material} />
    </>
  );
}
