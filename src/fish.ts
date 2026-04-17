import * as THREE from "three";
import { CONFIG, FISH_TIERS } from "./config";
import { createFishMeshGroup, updateFishIdleAnimation, FISH_TYPES } from "./fishVisual";

export type FishState = "swim" | "snap" | "hooked";

export type FishInstance = {
  mesh: THREE.Group;
  x: number;
  y: number;
  alive: boolean;
  state: FishState;
  typeIndex: number;
  hitHalfW: number;
  hitHalfH: number;
  phase: number;
  hue: string;
};

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Sparse shallow water → busier deep water.
 */
export function createProgressiveFishField(scene: THREE.Object3D): FishInstance[] {
  const fish: FishInstance[] = [];
  const placed: { x: number; y: number }[] = [];
  const surface = CONFIG.surfaceY;
  let spawnIdx = 0;

  for (const tier of FISH_TIERS) {
    const minSep2 = tier.minSep * tier.minSep;
    for (let n = 0; n < tier.count; n++) {
      const typeIndex = spawnIdx % FISH_TYPES.length;
      spawnIdx += 1;
      const ft = FISH_TYPES[typeIndex]!;
      const faceRight = spawnIdx % 2 === 1;
      const mesh = createFishMeshGroup(typeIndex, faceRight);
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      let x = 0;
      let y = 0;
      let ok = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        x = THREE.MathUtils.randFloat(CONFIG.hookMinX + 0.2, CONFIG.hookMaxX - 0.2);
        const d = THREE.MathUtils.randFloat(tier.depthMin, tier.depthMax);
        y = surface - d;
        ok = true;
        for (const p of placed) {
          if (dist2(x, y, p.x, p.y) < minSep2) {
            ok = false;
            break;
          }
        }
        if (ok) break;
      }
      placed.push({ x, y });
      mesh.position.set(x, y, 0);
      const phase = Math.random() * Math.PI * 2;
      mesh.rotation.z = Math.sin(phase) * 0.05;
      scene.add(mesh);
      fish.push({
        mesh,
        x,
        y,
        alive: true,
        state: "swim",
        typeIndex,
        hitHalfW: ft.hitHalfW,
        hitHalfH: ft.hitHalfH,
        phase,
        hue: `#${(ft.tint & 0xffffff).toString(16).padStart(6, "0")}`,
      });
    }
  }
  return fish;
}

export function updateSwimmingFishIdle(
  fish: FishInstance[],
  time: number,
  dt: number,
): void {
  for (const f of fish) {
    if (f.state !== "swim" || !f.alive) continue;
    updateFishIdleAnimation(f.mesh, time, f.phase, dt);
    f.x = f.mesh.position.x;
    f.y = f.mesh.position.y;
  }
}

function disposeMat(m: THREE.Material): void {
  if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.MeshStandardMaterial) {
    m.map = null;
  }
  m.dispose();
}

function disposeMeshTree(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const m = child.material;
      if (Array.isArray(m)) m.forEach(disposeMat);
      else disposeMat(m);
    }
  });
}

export function disposeFishPool(fish: FishInstance[], scene: THREE.Object3D): void {
  for (const f of fish) {
    if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
    else scene.remove(f.mesh);
    disposeMeshTree(f.mesh);
  }
  fish.length = 0;
}
