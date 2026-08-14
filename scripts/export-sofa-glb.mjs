// Generates public/models/lounge.glb — the holographic AR sofa,
// mirroring buildSofaGroup() in ProceduralSpatialCanvas.tsx (1:1 geometry).
// Run: npm run export:glb
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// GLTFExporter's binary path uses FileReader.onloadend (browser API) — shim it in Node.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    onload = null;
    onloadend = null;
    onerror = null;
    result = null;
    error = null;
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf;
          this.onload?.({ target: this });
          this.onloadend?.({ target: this });
        })
        .catch((err) => {
          this.error = err;
          this.onerror?.({ target: this });
        });
    }
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const group = new THREE.Group();

const mat = new THREE.MeshPhysicalMaterial({
  color: 0x7b61ff,
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

const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.8), mat);
base.position.y = 0.12;
group.add(base);

const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.25), bodyMat);
back.position.set(0, 0.6, -0.35);
group.add(back);

const armL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.8), bodyMat);
armL.position.set(-0.65, 0.35, 0);
const armR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.8), bodyMat);
armR.position.set(0.65, 0.35, 0);
group.add(armL, armR);

const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.55), mat);
cushion.position.set(0, 0.42, 0.02);
group.add(cushion);

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

const exporter = new GLTFExporter();
exporter.parse(
  group,
  (result) => {
    const out = resolve(root, "public", "models", "lounge.glb");
    mkdirSync(dirname(out), { recursive: true });
    const buf = result instanceof ArrayBuffer ? Buffer.from(result) : Buffer.from(result.buffer);
    writeFileSync(out, buf);
    console.log(`Wrote ${out} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
  },
  (err) => {
    console.error("Export failed:", err);
    process.exit(1);
  },
  { binary: true }
);
