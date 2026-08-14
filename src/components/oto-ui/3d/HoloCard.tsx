"use client";
import {
  Component,
  Suspense,
  useMemo,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import { RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";

/** Catches GLB/texture load failures (e.g. offline) so cards fall back to 2D. */
export class HoloBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Holographic projection card: photo mapped onto a floating rounded slab. */
function HoloCardScene({ url, hover }: { url: string; hover: boolean }) {
  const texture = useTexture(url);
  const idleGlow = useMemo(
    () => new THREE.Color("#7b61ff"),
    []
  );
  const hoverGlow = useMemo(
    () => new THREE.Color("#a78bfa"),
    []
  );

  return (
    <group>
      {/* Halo backing: additive glow frame behind the slab */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[2.12, 2.42, 0.04]} />
        <meshBasicMaterial
          color={hover ? hoverGlow : idleGlow}
          transparent
          opacity={hover ? 0.42 : 0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Projection slab: photo texture + clearcoat glass */}
      <RoundedBox args={[2.0, 2.3, 0.12]} radius={0.07} smoothness={8}>
        <meshPhysicalMaterial
          map={texture}
          metalness={0.45}
          roughness={0.22}
          clearcoat={0.7}
          clearcoatRoughness={0.15}
          emissive={hover ? hoverGlow : new THREE.Color("#000000")}
          emissiveIntensity={hover ? 0.3 : 0}
        />
      </RoundedBox>
      {/* Top edge highlight (projector glint) */}
      <mesh position={[0, 1.13, 0.09]}>
        <boxGeometry args={[1.98, 0.018, 0.018]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={hover ? 0.95 : 0.45}
        />
      </mesh>
      {/* Bottom cyan under-glow */}
      <mesh position={[0, -1.14, 0.06]}>
        <boxGeometry args={[1.8, 0.012, 0.012]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={hover ? 0.7 : 0.3}
        />
      </mesh>
    </group>
  );
}

/**
 * Mini R3F canvas per destination card.
 * frameloop="demand": renders once, re-renders only when `hover` changes —
 * 8 cards stay cheap. pointer-events off so clicks land on the DOM button.
 */
export default function HoloCard({
  url,
  hover = false,
}: {
  url: string;
  hover?: boolean;
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 3.4], fov: 40 }}
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 2]} intensity={1.4} />
      <pointLight position={[-2, 1, 2]} intensity={0.6} color="#7b61ff" />
      <pointLight position={[2, -1, 1.5]} intensity={0.4} color="#00f0ff" />
      <Suspense fallback={null}>
        <HoloCardScene url={url} hover={hover} />
      </Suspense>
    </Canvas>
  );
}
