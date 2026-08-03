"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAppStore } from "@/store/useAppStore";

const MAX_FPS = 60;
const FRAME_MS = 1000 / MAX_FPS;

type CanvasMode = "ambient" | "ar";

function createParticleSystem(
  count: number,
  color: number,
  size: number,
  spread: number,
  opacity = 0.9
) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    pos[i] = (Math.random() - 0.5) * spread;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

/** Holographic AR furniture: sleek sofa with halo base ring */
function buildSofaGroup(color: number) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.25,
    metalness: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x8b5cf6,
    roughness: 0.3,
    metalness: 0.4,
    clearcoat: 0.8,
  });

  // Seat base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.8), mat);
  base.position.y = 0.12;
  group.add(base);

  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.25), bodyMat);
  back.position.set(0, 0.6, -0.35);
  group.add(back);

  // Left & right armrests
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.8), bodyMat);
  armL.position.set(-0.65, 0.35, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.8), bodyMat);
  armR.position.set(0.65, 0.35, 0);
  group.add(armL, armR);

  // Seat cushion
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.55), mat);
  cushion.position.set(0, 0.42, 0.02);
  group.add(cushion);

  // Dual concentric halo base
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.03, 12, 64),
    new THREE.MeshBasicMaterial({
      color: 0x7b61ff,
      transparent: true,
      opacity: 0.8,
    })
  );
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = -0.05;
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.02, 12, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.55,
    })
  );
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = -0.08;
  group.add(ring1, ring2);

  return { group, material: mat };
}

function ProceduralSpatialCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Global state: 3D screen routing + furniture material color
  const mode: CanvasMode = useAppStore((s) => (s.screen === "ar" ? "ar" : "ambient"));
  const modelColor = useAppStore((s) => s.activeSwatch);
  const modeRef = useRef<CanvasMode>(mode);
  const colorRef = useRef<string>(modelColor);
  const sofaMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const sofaGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    colorRef.current = modelColor;
  }, [modelColor]);

  // Keep the AR furniture visible only on the AR screen
  useEffect(() => {
    if (sofaGroupRef.current) {
      sofaGroupRef.current.visible = mode === "ar";
    }
  }, [mode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Native Scene / Camera / Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // 2. 60 space dust particles (cyan + purple) - ambient star dust layer
    const cyanSparkles = createParticleSystem(40, 0x00f0ff, 0.075, 10, 0.95);
    const purpleSparkles = createParticleSystem(20, 0x7b61ff, 0.09, 10, 0.95);
    scene.add(cyanSparkles);
    scene.add(purpleSparkles);

    // 4. AR sofa model (hidden unless mode === "ar")
    const { group: sofaGroup, material: sofaMat } = buildSofaGroup(
      new THREE.Color(colorRef.current).getHex()
    );
    sofaGroup.visible = modeRef.current === "ar";
    scene.add(sofaGroup);
    sofaGroupRef.current = sofaGroup;
    sofaMatRef.current = sofaMat;

    // 5. Dual-color high-pressure point lights (cyan + violet)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    const light1 = new THREE.PointLight(0x00f0ff, 10, 16);
    light1.position.set(4, 4, 4);
    scene.add(light1);
    const light2 = new THREE.PointLight(0x7b61ff, 12, 16);
    light2.position.set(-4, -3, -3);
    scene.add(light2);

    // 6. Drag-to-rotate (AR mode)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let targetRotY = 0;
    let targetRotX = 0;
    let rotY = 0;
    let rotX = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (modeRef.current !== "ar") return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      targetRotY = rotY + (e.clientX - dragStartX) * 0.005;
      targetRotX = Math.max(
        -0.6,
        Math.min(0.6, rotX + (e.clientY - dragStartY) * 0.005)
      );
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);

    // 7. Frame loop capped at 60 FPS
    let running = true;
    let rafId = 0;
    let lastFrame = performance.now();
    const timer = new THREE.Timer();

    const loop = (now: number) => {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      const delta = now - lastFrame;
      if (delta < FRAME_MS) return;
      lastFrame = now;

      timer.update();
      const elapsedTime = timer.getElapsed();

      // Dust particles gently breathe so their glow feels alive behind glass
      const pulse = 0.8 + Math.sin(elapsedTime * 1.6) * 0.2;
      cyanSparkles.material.opacity = 0.95 * pulse;
      purpleSparkles.material.opacity = 0.95 * pulse;

      if (modeRef.current === "ar") {
        // Smooth inertia toward drag target
        rotY += (targetRotY - rotY) * 0.12;
        rotX += (targetRotX - rotX) * 0.12;
        sofaGroup.rotation.y = rotY;
        sofaGroup.rotation.x = rotX;
      }
      // Ambient star dust drifts in both modes
      cyanSparkles.rotation.y = -elapsedTime * 0.04;
      purpleSparkles.rotation.y = elapsedTime * 0.06;

      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(loop);

    // 8. Pause when tab hidden
    const onVisibilityChange = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else {
        running = true;
        lastFrame = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 9. ResizeObserver (debounced, no layout thrash)
    let resizePending = false;
    const onResize: ResizeObserverCallback = (entries) => {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(() => {
        resizePending = false;
        const entry = entries[entries.length - 1];
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // 10. Strict teardown
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      timer.dispose();
      cyanSparkles.geometry.dispose();
      cyanSparkles.material.dispose();
      purpleSparkles.geometry.dispose();
      purpleSparkles.material.dispose();
      sofaGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Live-update the sofa color without recreating the WebGL context
  useEffect(() => {
    if (sofaMatRef.current) {
      sofaMatRef.current.color.set(modelColor);
    }
  }, [modelColor]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      role="presentation"
      className={
        mode === "ar"
          ? "absolute inset-0 h-full w-full overflow-hidden cursor-grab active:cursor-grabbing touch-none"
          : "absolute inset-0 h-full w-full pointer-events-none opacity-90 overflow-hidden"
      }
    />
  );
}

// Memoized: context created once; mode/color changes are handled via refs.
export default ProceduralSpatialCanvas;
