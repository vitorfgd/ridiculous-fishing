import * as THREE from "three";
import { CONFIG, FISH_TIERS } from "./config";
import { economyTierForSpawnDepthM } from "./fishEconomy";
import { pickFishArtVariant } from "./fishArt";
import { createFishMeshGroup, updateFishIdleAnimation, FISH_TYPES } from "./fishVisual";

/** Deepest band top edge — clamp shifted spawns so fish stay in the field. */
const MAX_FISH_SPAWN_DEPTH_M = FISH_TIERS[FISH_TIERS.length - 1]!.depthMax;
/** Snapper (art 1) / angler (art 2) sit too high vs hook path; push spawn deeper (m below surface). */
const SNAPPER_SPAWN_EXTRA_DEPTH_M = 20;
const ANGLER_SPAWN_EXTRA_DEPTH_M = 30;

function placementDepthMForArt(rolledDepthM: number, artVariant: 0 | 1 | 2): number {
  let d = rolledDepthM;
  if (artVariant === 1) d += SNAPPER_SPAWN_EXTRA_DEPTH_M;
  if (artVariant === 2) d += ANGLER_SPAWN_EXTRA_DEPTH_M;
  return Math.min(d, MAX_FISH_SPAWN_DEPTH_M);
}

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
  economyTierId: string;
  economyName: string;
  economyValue: number;
  /** 0 classic sprite, 1 snapper PNG, 2 angler PNG. */
  artVariant: 0 | 1 | 2;
};

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Meters below surface → ~0.56 shallow … ~1.12 very deep (smooth, easy start). */
function sizeScaleForSpawnDepth(depthM: number): number {
  const t = THREE.MathUtils.clamp((depthM - 4) / 105, 0, 1);
  const curved = Math.pow(t, 0.7);
  return THREE.MathUtils.clamp(0.56 + curved * 0.56, 0.52, 1.14);
}

/**
 * Sparse shallow water → busier deep water.
 */
export function createProgressiveFishField(scene: THREE.Object3D): FishInstance[] {
  const fish: FishInstance[] = [];
  const placed: { x: number; y: number }[] = [];
  const surface = CONFIG.surfaceY;
  let spawnIdx = 0;
  const anglerSpawnState = { n: 0 };

  for (const tier of FISH_TIERS) {
    const minSep2 = tier.minSep * tier.minSep;
    for (let n = 0; n < tier.count; n++) {
      const typeIndex = spawnIdx % FISH_TYPES.length;
      spawnIdx += 1;
      const ft = FISH_TYPES[typeIndex]!;
      const faceRight = spawnIdx % 2 === 1;

      let x = 0;
      let y = 0;
      let ok = false;
      let rolledDepthM = 0;
      let placementDepthM = 0;
      let artVariant: 0 | 1 | 2 = 0;
      for (let attempt = 0; attempt < 120; attempt++) {
        x = THREE.MathUtils.randFloat(CONFIG.hookMinX + 0.2, CONFIG.hookMaxX - 0.2);
        const d = THREE.MathUtils.randFloat(tier.depthMin, tier.depthMax);
        rolledDepthM = d;
        /* Trial angler counter so failed placement retries do not burn angler slots. */
        const trialAngler = { n: anglerSpawnState.n };
        artVariant = pickFishArtVariant(rolledDepthM, trialAngler);
        placementDepthM = placementDepthMForArt(rolledDepthM, artVariant);
        y = surface - placementDepthM;
        ok = true;
        for (const p of placed) {
          if (dist2(x, y, p.x, p.y) < minSep2) {
            ok = false;
            break;
          }
        }
        if (ok) {
          anglerSpawnState.n = trialAngler.n;
          break;
        }
      }
      const eco = economyTierForSpawnDepthM(placementDepthM);
      const sizeMul = sizeScaleForSpawnDepth(placementDepthM) * eco.visualScale;
      const economyHex = artVariant === 0 ? eco.accentHex : undefined;
      const mesh = createFishMeshGroup(
        typeIndex,
        faceRight,
        sizeMul,
        economyHex,
        artVariant,
      );
      mesh.castShadow = false;
      mesh.receiveShadow = false;
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
        hitHalfW: ft.hitHalfW * sizeMul,
        hitHalfH: ft.hitHalfH * sizeMul,
        phase,
        hue: `#${(ft.tint & 0xffffff).toString(16).padStart(6, "0")}`,
        economyTierId: eco.id,
        economyName: eco.name,
        economyValue: eco.value,
        artVariant,
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
