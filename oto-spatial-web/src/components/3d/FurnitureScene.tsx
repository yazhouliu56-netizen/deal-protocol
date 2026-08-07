"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "@/store/useAppStore";
import { isLowPower } from "@/lib/performance";

/** Distance beyond which we swap to the low-detail material (LOD); 3.5 on low power. */
const MAX_TILT = 0.6;

/**
 * Holographic AR sofa loaded from /models/lounge.glb.
 * - 360° drag rotation with inertia (pointer events on the canvas element)
 * - swatch recolors the clearcoat material
 * - LOD: cheap Lambert material when the camera is far away
 * - visible only on the AR screen (kept mounted for instant switching)
 */
export default function FurnitureScene() {
  const groupRef = useRef<THREE.Group>(null);
  const dragState = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    rotY: Math.PI * 0.85,
    rotX: 0,
    targetY: Math.PI * 0.85,
    targetX: 0,
    intro: true,
    introElapsed: 0,
  });

  const screen = useAppStore((s) => s.screen);
  const color = useAppStore((s) => s.activeSwatch);
  const viewResetSignal = useAppStore((s) => s.viewResetSignal);
  const gltf = useGLTF("/models/lounge.glb");

  const matRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const lowMatRef = useRef<THREE.MeshLambertMaterial | null>(null);
  const targetColorRef = useRef<THREE.Color>(new THREE.Color(color));

  // Track the clearcoat material; color transitions are lerped in useFrame
  useEffect(() => {
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const m = mesh.material as THREE.MeshPhysicalMaterial | undefined;
      if (mesh.isMesh && m && m.clearcoat === 1) {
        matRef.current = m;
      }
    });
    targetColorRef.current.set(color);
    if (lowMatRef.current) lowMatRef.current.color.set(color);
  }, [color, gltf]);

  const { gl, camera } = useThree();
  const lodDistance = useMemo(() => (isLowPower() ? 3.5 : 5.5), []);

  // Drag-to-rotate on the canvas element (AR mode only)
  useEffect(() => {
    const el = gl.domElement;
    const state = dragState.current;

    const onPointerDown = (e: PointerEvent) => {
      if (useAppStore.getState().screen !== "ar") return;
      state.dragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      state.targetY = state.rotY + (e.clientX - state.startX) * 0.005;
      state.targetX = Math.max(
        -MAX_TILT,
        Math.min(MAX_TILT, state.rotX + (e.clientY - state.startY) * 0.005)
      );
    };
    const onPointerUp = () => {
      state.dragging = false;
    };

    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [gl]);

  // 360 reset: snap rotation back to the resting pose
  useEffect(() => {
    if (viewResetSignal === 0) return;
    const s = dragState.current;
    s.targetY = 0;
    s.targetX = 0;
    s.rotY = 0;
    s.rotX = 0;
  }, [viewResetSignal]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    group.visible = screen === "ar";
    if (screen !== "ar") return;

    const s = dragState.current;

    // Intro: sofa swings in from the side on first AR mount (locked from input)
    if (s.intro) {
      s.introElapsed += delta;
      s.rotY += (0 - s.rotY) * 0.08;
      s.rotX += (0 - s.rotX) * 0.08;
      group.rotation.y = s.rotY;
      group.rotation.x = s.rotX;
      if (s.introElapsed > 1.5) {
        s.intro = false;
        s.rotY = 0;
        s.rotX = 0;
        s.targetY = 0;
        s.targetX = 0;
      }
      return;
    }

    // Inertia toward drag target
    s.rotY += (s.targetY - s.rotY) * 0.12;
    s.rotX += (s.targetX - s.rotX) * 0.12;
    group.rotation.y = s.rotY;
    group.rotation.x = s.rotX;

    // Smooth swatch color transition (lerp toward the target)
    if (matRef.current) {
      matRef.current.color.lerp(targetColorRef.current, 0.09);
    }
    if (lowMatRef.current) {
      lowMatRef.current.color.lerp(targetColorRef.current, 0.09);
    }

    // LOD: far away -> cheap material, close -> clearcoat physical material
    const dist = camera.position.distanceTo(group.position);
    const isFar = dist > lodDistance;
    if (!isFar && !matRef.current && !lowMatRef.current) return;
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const base = mesh.material as THREE.MeshPhysicalMaterial;
      if (!base || typeof base.clearcoat !== "number") return;
      if (isFar) {
        if (!lowMatRef.current) {
          lowMatRef.current = new THREE.MeshLambertMaterial({
            color: base.color.getHex(),
          });
        }
        mesh.material = lowMatRef.current;
      } else {
        mesh.material = base;
      }
    });
  });

  return <primitive ref={groupRef} object={gltf.scene} />;
}
