"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAppStore } from "@/store/useAppStore";
import { templateForCategory } from "@/lib/sceneTemplate";
import type { OTOExperience } from "@/lib/mockData";

/**
 * 场景模板 — renders a procedural 3D stage per space intent so the AR
 * "预览" shows the right environment without shipping more GLB files
 * (only the home furniture model exists as lounge.glb).
 *
 * Low-poly / additive only, so offline PWA and low-power devices stay smooth.
 */

const EMPTY_EXP: OTOExperience = {
  id: "",
  title: "",
  subtitle: "",
  category: "City",
  price: "",
  rating: 0,
  location: "",
  hasAR: true,
  imageUrl: "",
  description: "",
  coordinates: { lat: 30.5728, lng: 104.0668 },
};

/* ------------------------- 半场（球局/竞技） ------------------------- */
function CourtTemplate() {
  const netRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (netRef.current) netRef.current.position.y = Math.sin(s.clock.elapsedTime * 2) * 0.02;
  });
  return (
    <group position={[0, -0.7, 0]}>
      {/* 场地网格 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 2, 12, 8]} />
        <meshBasicMaterial color="#7b61ff" wireframe transparent opacity={0.35} />
      </mesh>
      {/* 网：带竖杆的线框面 */}
      <mesh ref={netRef} position={[0, 0.45, 0]}>
        <planeGeometry args={[2.6, 0.9, 12, 6]} />
        <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.5} />
      </mesh>
      {/* 中线发光条 */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[3.1, 0.04, 0.04]} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
    </group>
  );
}

/* ---------------------- 取景光场（约拍/沙滩） ------------------------ */
function ViewfinderTemplate() {
  const rotRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (rotRef.current) {
      rotRef.current.rotation.y = t * 0.25;
      rotRef.current.position.y = Math.sin(t * 1.2) * 0.05;
    }
  });
  const corners: [number, number, number][] = [
    [0.9, 0.62, 0],
    [-0.9, 0.62, 0],
    [0.9, -0.62, 0],
    [-0.9, -0.62, 0],
  ];
  return (
    <group position={[0, 0.2, 0]}>
      <group ref={rotRef}>
        {corners.map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        ))}
      </group>
      {/* 光柱 */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.8, 0.02, 1.6]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------------- 室内（城市/历史） ---------------------------- */
function InteriorTemplate() {
  return (
    <group position={[0, -0.6, 0]}>
      {/* 桌面 */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.9]} />
        <meshPhysicalMaterial color="#6b5bd6" roughness={0.35} metalness={0.05} transparent opacity={0.85} />
      </mesh>
      {/* 桌腿 */}
      {[
        [0.72, 0, 0.36],
        [-0.72, 0, 0.36],
        [0.72, 0, -0.36],
        [-0.72, 0, -0.36],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshBasicMaterial color="#3b2a7a" />
        </mesh>
      ))}
      {/* 吊灯光晕 */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color="#fff0c0" />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshBasicMaterial color="#ffc94d" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* 书架背景 */}
      <mesh position={[-0.75, 0.75, -0.2]}>
        <boxGeometry args={[0.6, 1.1, 0.12]} />
        <meshBasicMaterial color="#3b2a7a" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

/**
 * 模板舞台 — renders a procedural stage UNLESS the template is "lounge",
 * in which case the user owns furniture model (FurnitureScene) takes over.
 * Renders no-op otherwise.
 */
export default function TemplateStage() {
  const experience = useAppStore((s) => s.selectedExperience);
  const tpl = useMemo(
    () => templateForCategory(experience?.category ?? EMPTY_EXP.category),
    [experience]
  );
  if (tpl === "lounge") return null;
  return (
    <group>
      {tpl === "court" && <CourtTemplate />}
      {tpl === "view" && <ViewfinderTemplate />}
      {tpl === "interior" && <InteriorTemplate />}
    </group>
  );
}