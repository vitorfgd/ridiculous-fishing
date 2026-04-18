import * as THREE from "three";
import { CONFIG } from "./config";
import {
  applyBonusFishTapScale,
  applyInitialBonusFishSprite,
  createBonusFishSprite,
  updateBonusFishSpriteRegion,
} from "./bonusFishSprites";

export type AirBonusFish = {
  sprite: THREE.Sprite;
  /** Matches sprite horizontal flip for tap pop scale. */
  faceRight: boolean;
  /** True when last frame was below the water surface (for tint). */
  wasBelow: boolean;
  vx: number;
  vy: number;
  launchTime: number;
  launched: boolean;
  /** One-frame flag for launch VFX in main loop. */
  justLaunched: boolean;
  missed: boolean;
};

export type SpawnBonusResult = {
  fish: AirBonusFish[];
  /** Points already granted for fish above air cap. */
  bankedPoints: number;
};

/**
 * Spawns up to `bonusMaxAirTargets` toss targets; banks flat bonus for overflow count.
 * @param caughtVariants Art variant per caught fish — used to show the same species in the toss.
 */
export function spawnBonusTossFish(
  world: THREE.Object3D,
  fishCaught: number,
  hookX: number,
  caughtVariants: (0 | 1 | 2)[] = [],
): SpawnBonusResult {
  const cap = CONFIG.bonusMaxAirTargets;
  const airCount = Math.min(fishCaught, cap);
  const overflow = Math.max(0, fishCaught - cap);
  const bankedPoints = overflow * CONFIG.bonusPerTap;

  const fish: AirBonusFish[] = [];
  const surface = CONFIG.surfaceY;
  const clampedHook = THREE.MathUtils.clamp(hookX, CONFIG.hookMinX + 0.3, CONFIG.hookMaxX - 0.3);

  for (let i = 0; i < airCount; i++) {
    const faceRight = i % 2 === 1;
    /* Pick art variant from caught list, cycling if there are fewer entries than air count. */
    const artVariant: 0 | 1 | 2 =
      caughtVariants.length > 0
        ? (caughtVariants[i % caughtVariants.length] ?? 0)
        : 0;
    const sprite = createBonusFishSprite(faceRight, artVariant);
    const t = i * CONFIG.bonusLaunchStagger + Math.random() * 0.04;
    const spread =
      (i - (airCount - 1) / 2) * 0.42 + (Math.random() - 0.5) * CONFIG.bonusSpawnJitterX;
    const px = THREE.MathUtils.clamp(
      clampedHook + spread,
      CONFIG.hookMinX + 0.2,
      CONFIG.hookMaxX - 0.2,
    );
    const py = surface + CONFIG.bonusSpawnYOffset;
    sprite.position.set(px, py, 0.55);
    world.add(sprite);
    const vx =
      ((Math.random() - 0.5) *
        2 *
        (CONFIG.bonusLaunchVxSpread + CONFIG.bonusLaunchVxExtraSpread)) /
      Math.max(airCount, 1);
    const vy = THREE.MathUtils.randFloat(
      CONFIG.bonusLaunchVyMin,
      CONFIG.bonusLaunchVyMax + CONFIG.bonusLaunchVyJitter * Math.random(),
    );
    const wasBelow = applyInitialBonusFishSprite(sprite, py, surface);
    fish.push({
      sprite,
      faceRight,
      wasBelow,
      vx,
      vy,
      launchTime: t,
      launched: false,
      justLaunched: false,
      missed: false,
    });
  }
  return { fish, bankedPoints };
}

export function updateBonusTossFish(
  list: AirBonusFish[],
  dt: number,
  phaseElapsed: number,
  camCenterY: number,
  viewHalfHeight: number,
): void {
  const missBelow = camCenterY - viewHalfHeight - CONFIG.bonusMissMarginBelowView;

  for (const f of list) {
    if (f.missed) continue;
    if (!f.launched) {
      if (phaseElapsed >= f.launchTime) {
        f.launched = true;
        f.justLaunched = true;
      } else {
        f.wasBelow = updateBonusFishSpriteRegion(
          f.sprite,
          f.sprite.position.y,
          CONFIG.surfaceY,
          f.wasBelow,
        );
        continue;
      }
    }
    f.vy -= CONFIG.bonusGravity * dt;
    f.sprite.position.x += f.vx * dt;
    f.sprite.position.y += f.vy * dt;
    f.wasBelow = updateBonusFishSpriteRegion(
      f.sprite,
      f.sprite.position.y,
      CONFIG.surfaceY,
      f.wasBelow,
    );
    if (f.sprite.position.y < missBelow) {
      f.missed = true;
      f.sprite.visible = false;
    }
  }
}

export type ProjectFn = (wx: number, wy: number) => { x: number; y: number };

export type BonusTapOutcome = {
  pts: number;
  worldX?: number;
  worldY?: number;
};

/** Returns bonus points (0 if miss) and world hit position for VFX. */
export function tryTapBonusFish(
  list: AirBonusFish[],
  clientX: number,
  clientY: number,
  project: ProjectFn,
  phaseElapsed: number,
): BonusTapOutcome {
  const r = CONFIG.bonusTapRadiusPx;
  const r2 = r * r;
  let best = -1;
  let bestD = r2;

  for (let i = 0; i < list.length; i++) {
    const f = list[i]!;
    if (f.missed) continue;
    if (phaseElapsed < f.launchTime) continue;
    if (!f.launched) {
      f.launched = true;
      f.justLaunched = true;
    }
    const p = project(f.sprite.position.x, f.sprite.position.y);
    const dx = p.x - clientX;
    const dy = p.y - clientY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }

  if (best < 0) return { pts: 0 };
  const f = list[best]!;
  const worldX = f.sprite.position.x;
  const worldY = f.sprite.position.y;
  f.missed = true;
  applyBonusFishTapScale(f.sprite, f.faceRight);
  f.sprite.visible = false;
  return { pts: CONFIG.bonusPerTap, worldX, worldY };
}

export function disposeBonusTossFish(list: AirBonusFish[], world: THREE.Object3D): void {
  for (const f of list) {
    world.remove(f.sprite);
    const m = f.sprite.material as THREE.SpriteMaterial;
    m.map = null;
    m.dispose();
  }
  list.length = 0;
}

/** True when timer expired or every fish is no longer tappable (tapped or fell). */
export function isBonusTossComplete(
  list: AirBonusFish[],
  phaseElapsed: number,
): boolean {
  if (phaseElapsed >= CONFIG.bonusTossMaxSeconds) return true;
  if (list.length === 0) return true;
  const allSettled = list.every((f) => f.missed);
  const allLaunched = list.every((f) => f.launched);
  return allSettled && allLaunched;
}
