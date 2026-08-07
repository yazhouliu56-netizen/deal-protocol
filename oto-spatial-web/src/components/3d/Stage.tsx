"use client";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import StarDust from "./StarDust";
import FurnitureScene from "./FurnitureScene";
import TemplateStage from "./SceneTemplate";
import { templateForCategory } from "@/lib/sceneTemplate";
import { useAppStore } from "@/store/useAppStore";
import { isLowPower, webglSupported } from "@/lib/performance";

/** Low-poly deep-space planet with additive halo rings — background tech vibe (non-AR screens). */
function LowPolyEarth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const viewport = useThree((s) => s.viewport);
  // Desktop (wide viewport): planet grows and moves to the right side as the
  // hero backdrop; mobile keeps it tucked behind the top search bar.
  const wide = viewport.width > 4;
  const px = wide ? viewport.width * 0.3 : 1.9;
  const py = wide ? 1.8 : 1.5;
  const scale = wide ? Math.max(2.6, viewport.width * 0.36) : 1.9;
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.06;
      meshRef.current.position.y = Math.sin(t * 0.25) * 0.12;
    }
  });
  return (
    <group position={[px, py, -4.6]} rotation={[0.35, -0.4, 0.15]} scale={scale}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial
          color="#3b2a7a"
          flatShading
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <torusGeometry args={[1.32, 0.012, 8, 72]} />
        <meshBasicMaterial
          color="#7b61ff"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <torusGeometry args={[1.48, 0.008, 8, 72]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Falls back to the pure CSS background (aurora + gradients) if WebGL/Canvas fails. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Keep the PWA shell fully functional without WebGL.
    console.warn("3D stage failed, falling back to CSS background");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Thin top progress bar while the GLB model is being fetched. */
function ModelProgress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div
      className="absolute top-0 left-0 h-[2px] z-40 transition-[width] duration-200"
      style={{
        width: `${progress}%`,
        background: "linear-gradient(90deg,#7b61ff,#00f0ff)",
      }}
    />
  );
}

/**
 * R3F scene root: ambient star dust always on; the AR sofa (GLB + environment
 * reflections) mounts under Suspense on the AR screen.
 * P5: WebGL2 check (pure CSS fallback) + low-power dpr lock / no environment.
 */
export default function Stage() {
  const [webgl, setWebgl] = useState(false);
  const lowPower = useMemo(() => isLowPower(), []);
  const screen = useAppStore((s) => s.screen);
  const experience = useAppStore((s) => s.selectedExperience);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWebgl(webglSupported()));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!webgl) return <ModelProgress />;

  return (
    <>
      <StageBoundary>
        <Canvas
          className="absolute inset-0 z-0"
          dpr={lowPower ? 1 : [1, 1.75]}
          shadows={!lowPower}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          <ambientLight intensity={0.45} />
          <StarDust />
          {!lowPower && screen !== "ar" && <LowPolyEarth />}
          <Suspense fallback={null}>
            {screen !== "ar" ? null : templateForCategory(experience?.category ?? "") === "lounge" ? (
              <FurnitureScene />
            ) : (
              <TemplateStage />
            )}
            {/* Floating contact shadow grounds the sofa (skipped on low power) */}
            {!lowPower && (
              <ContactShadows
                position={[0, -0.65, 0]}
                opacity={0.5}
                scale={8}
                blur={2.6}
                far={2.4}
                resolution={256}
                color="#0a0618"
              />
            )}
            {/* Synthetic studio environment: crisp clearcoat reflections,
                fully local (no network HDR) so offline PWA keeps the look.
                Skipped entirely on low-power devices. */}
            {!lowPower && (
              <Environment resolution={256} frames={1}>
                <Lightformer
                  intensity={2.4}
                  position={[0, 3.2, 1]}
                  scale={[9, 5, 1]}
                  color="#ffffff"
                />
                <Lightformer
                  intensity={1.5}
                  position={[-4, 1.2, -1]}
                  scale={[2.5, 5, 1]}
                  color="#7b61ff"
                />
                <Lightformer
                  intensity={1.3}
                  position={[4.5, 0.4, -2]}
                  scale={[2.5, 3.5, 1]}
                  color="#00f0ff"
                />
                <Lightformer
                  intensity={0.6}
                  position={[0, -2, -3]}
                  scale={[10, 2, 1]}
                  color="#3b2a6e"
                />
              </Environment>
            )}
          </Suspense>
        </Canvas>
      </StageBoundary>
      <ModelProgress />
    </>
  );
}
