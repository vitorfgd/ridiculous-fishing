import "./style.css";
import * as THREE from "three";
import { CONFIG } from "./config";
import { AppState, PlayPhase } from "./gameState";
import { createGameScene } from "./scene";
import { HookRig } from "./hook";
import {
  createProgressiveFishField,
  disposeFishPool,
  updateSwimmingFishIdle,
  type FishInstance,
} from "./fish";
import {
  circleHitsAabb,
  findFirstFishHit,
  pointToAabbDistSq,
} from "./collision";
import { formatMoney } from "./fishEconomy";
import {
  buildFishHaulBreakdown,
  depthScoreMult,
  haulSubtotalFromCounts,
} from "./scoring";
import {
  disposeBonusTossFish,
  isBonusTossComplete,
  spawnBonusTossFish,
  tryTapBonusFish,
  updateBonusTossFish,
  type AirBonusFish,
} from "./bonusToss";
import { createBonusJuice } from "./bonusJuice";
import { disposeSharedBonusFishTextures } from "./bonusFishSprites";
import { disposeSharedFishTexture } from "./fishVisual";
import { createBubbleVfx } from "./vfx";
import {
  hideOverlay,
  onOverlayTap,
  onResultRetry,
  pulseDepthReadout,
  setHud,
  showHudToast,
  showReadyOverlay,
  showResultReward,
  spawnFloater,
} from "./ui";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
if (!canvas) throw new Error("Missing #game canvas");

const {
  scene,
  camera,
  renderer,
  world,
  dispose: disposeScene,
  setCameraHalfHeightScale,
  updateAtmosphere,
} = createGameScene(canvas);
const bubbleVfx = createBubbleVfx(world);
const bonusJuice = createBonusJuice(world);
const hook = new HookRig(world);
let fish: FishInstance[] = createProgressiveFishField(world);
hook.reset(CONFIG.surfaceY);
/** Camera center Y (world); follows hook while playing. */
let camFollowY = CONFIG.surfaceY + CONFIG.cameraIdleBias;

let appState = AppState.Ready;
let phase = PlayPhase.Descent;
let time = 0;
let maxDepthUnits = 0;
let fishCaught = 0;
/** Counts per economy tier id for haul + results. */
let caughtByTier = new Map<string, number>();
/** Art variant (0/1/2) for each caught fish, in catch order — used to match bonus toss sprites. */
let caughtArtVariants: (0 | 1 | 2)[] = [];
let shake = 0;
let pointerTargetX = 0;
let lastRunScore = 0;
let lastRunMult = 1;
let lastRunFish = 0;
let lastRunDepth = 0;

let bonusAccum = 0;
let bonusPhaseElapsed = 0;
let airBonusFish: AirBonusFish[] = [];
/** Orthographic half-height scale during bonus (1 outside bonus). */
let bonusOrthoZoom = 1;

/** Upward camera kick when hook breaches surface (decays). */
let camImpulseY = 0;
let prevHookY = CONFIG.surfaceY - 0.6;

/** Smoothed depth for HUD readout. */
let hudDisplayDepth = 0;
let lastDepthMilestoneBand = 0;
let nearMissCooldown = 0;
let surfacePayoffT = 0;

/** Bonus-only tap punch (decays fast; layered on camera). */
let bonusHitShake = 0;
/** Consecutive bonus taps this phase (resets each bonus). */
let bonusTapStreak = 0;
/** 0–1 blends sky into “reward” palette during bonus. */
let bonusSkyCheer = 0;

const tmpV = new THREE.Vector3();

type Splash = { mesh: THREE.Mesh; vy: number; vx: number; t: number };
const splashes: Splash[] = [];

function clientXToWorldX(clientX: number): number {
  const w = canvas.clientWidth || 1;
  const t = clientX / w;
  return THREE.MathUtils.lerp(camera.left, camera.right, t);
}

function worldToClient(wx: number, wy: number): { x: number; y: number } {
  tmpV.set(wx, wy, 0).project(camera);
  const cx = (tmpV.x * 0.5 + 0.5) * canvas.clientWidth;
  const cy = (-tmpV.y * 0.5 + 0.5) * canvas.clientHeight;
  return { x: cx, y: cy };
}

function addMicroSplash(x: number, y: number): void {
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: "#c8f0ff",
      transparent: true,
      opacity: 0.75,
    });
    const geo = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 5, 5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 0.4, y, 0.42);
    world.add(mesh);
    splashes.push({
      mesh,
      vy: 2.5 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 2,
      t: 0.22 + Math.random() * 0.12,
    });
  }
}

function addSurfaceRing(x: number, y: number): void {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const mat = new THREE.MeshBasicMaterial({
      color: "#f0fbff",
      transparent: true,
      opacity: 0.9,
    });
    const geo = new THREE.SphereGeometry(0.1 + Math.random() * 0.06, 5, 5);
    const mesh = new THREE.Mesh(geo, mat);
    const sp = 2.2 + Math.random() * 0.9;
    mesh.position.set(x + Math.cos(ang) * 0.15, y, 0.42);
    world.add(mesh);
    splashes.push({
      mesh,
      vy: Math.sin(ang) * sp * 0.35 + 2.8,
      vx: Math.cos(ang) * sp,
      t: 0.5 + Math.random() * 0.15,
    });
  }
}

function addSplash(x: number, y: number): void {
  for (let i = 0; i < CONFIG.splashParticleCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: "#d8f6ff",
      transparent: true,
      opacity: 0.95,
    });
    const geo = new THREE.SphereGeometry(0.18 + Math.random() * 0.12, 6, 6);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.5,
      y + (Math.random() - 0.5) * 0.2,
      0.4,
    );
    world.add(mesh);
    splashes.push({
      mesh,
      vy: 4 + Math.random() * 5,
      vx: (Math.random() - 0.5) * 3,
      t: 0.45 + Math.random() * 0.2,
    });
  }
}

function updateSplashes(dt: number): void {
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]!;
    s.t -= dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.vy -= 10 * dt;
    s.mesh.scale.multiplyScalar(1 + 2 * dt);
    const m = s.mesh.material as THREE.MeshBasicMaterial;
    m.opacity = Math.max(0, s.t * 2);
    if (s.t <= 0) {
      world.remove(s.mesh);
      s.mesh.geometry.dispose();
      m.dispose();
      splashes.splice(i, 1);
    }
  }
}

function collectAscentFish(): void {
  const hx = hook.x;
  const hy = hook.y;
  const r = CONFIG.hookRadius;
  for (const f of fish) {
    if (!f.alive || f.state !== "swim") continue;
    if (circleHitsAabb(hx, hy, r, f.x, f.y, f.hitHalfW, f.hitHalfH)) {
      f.alive = false;
      f.state = "snap";
      fishCaught += 1;
      caughtByTier.set(
        f.economyTierId,
        (caughtByTier.get(f.economyTierId) ?? 0) + 1,
      );
      caughtArtVariants.push(f.artVariant);
      const p = worldToClient(f.x, f.y);
      spawnFloater(p.x, p.y, `+$${f.economyValue}`);
    }
  }
}

function updateSnapFish(dt: number): void {
  const hx = hook.x;
  const hy = hook.y;
  for (const f of fish) {
    if (f.state !== "snap") continue;
    const dx = hx - f.mesh.position.x;
    const dy = hy - f.mesh.position.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.085) {
      const idx = hook.caughtGroup.children.length;
      f.mesh.position.set(0, -0.27 * idx - 0.025 * Math.min(idx, 6), 0.08);
      f.mesh.rotation.z = 0;
      hook.caughtGroup.add(f.mesh);
      f.state = "hooked";
      hook.triggerCatchBounce(Math.max(0, hook.caughtGroup.children.length - 1));
      addMicroSplash(hook.x, CONFIG.surfaceY - 0.08);
    } else {
      const step = Math.min(1, (32 * dt) / Math.max(d, 0.001));
      f.mesh.position.x += dx * step;
      f.mesh.position.y += dy * step;
    }
  }
}

function resetRun(): void {
  disposeBonusTossFish(airBonusFish, world);
  airBonusFish = [];
  bonusOrthoZoom = 1;
  setCameraHalfHeightScale(1);
  disposeFishPool(fish, world);
  fish = createProgressiveFishField(world);
  hook.reset(CONFIG.surfaceY);
  phase = PlayPhase.Descent;
  maxDepthUnits = 0;
  fishCaught = 0;
  caughtByTier = new Map();
  caughtArtVariants = [];
  time = 0;
  pointerTargetX = hook.x;
  camFollowY = CONFIG.surfaceY + CONFIG.cameraIdleBias;
  prevHookY = hook.y;
  hudDisplayDepth = 0;
  lastDepthMilestoneBand = 0;
  nearMissCooldown = 0;
  surfacePayoffT = 0;
}

function getBonusActiveFishYBounds(): { minY: number; maxY: number; count: number } | null {
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const f of airBonusFish) {
    if (f.missed) continue;
    count += 1;
    const y = f.sprite.position.y;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (count === 0) return null;
  return { minY, maxY, count };
}

function bonusCameraTrackingTargetY(): number {
  const b = getBonusActiveFishYBounds();
  if (!b) return CONFIG.surfaceY + CONFIG.bonusCameraBias;
  const mid = b.count === 1 ? b.minY : (b.minY + b.maxY) * 0.5;
  const biased = mid + CONFIG.bonusCameraTrackBiasUp;
  return THREE.MathUtils.clamp(
    biased,
    CONFIG.bonusCameraTrackMinY,
    CONFIG.bonusCameraTrackMaxY,
  );
}

function desiredCameraCenterY(): number {
  if (appState === AppState.BonusToss) {
    return bonusCameraTrackingTargetY();
  }
  if (appState === AppState.SurfacePayoff) {
    return hook.y + CONFIG.cameraAscentBias * 0.85;
  }
  if (appState !== AppState.Playing) {
    return CONFIG.surfaceY + CONFIG.cameraIdleBias;
  }
  const bias =
    phase === PlayPhase.Descent ? CONFIG.cameraDescentBias : CONFIG.cameraAscentBias;
  return hook.y + bias;
}

function updateCameraFollow(dt: number): void {
  const target = desiredCameraCenterY();
  const lerpK =
    appState === AppState.BonusToss ? CONFIG.bonusCameraTrackLerp : CONFIG.cameraFollowLerp;
  camFollowY = THREE.MathUtils.lerp(camFollowY, target, 1 - Math.exp(-lerpK * dt));
}

function applyCamera(shakeOffset: number): void {
  const z = CONFIG.cameraZ;
  const yBase = camFollowY + camImpulseY;
  if (shakeOffset > 0) {
    camera.position.set(
      (Math.random() - 0.5) * shakeOffset * 2,
      yBase + (Math.random() - 0.5) * shakeOffset * 2,
      z,
    );
  } else {
    camera.position.set(0, yBase, z);
  }
  camera.lookAt(0, yBase, 0);
}

function beginBonusTossAtSurface(): void {
  bonusAccum = 0;
  bonusPhaseElapsed = 0;
  disposeBonusTossFish(airBonusFish, world);
  bonusJuice.clear();
  bonusOrthoZoom = 1;
  setCameraHalfHeightScale(1);
  const { fish, bankedPoints } = spawnBonusTossFish(world, fishCaught, hook.x, caughtArtVariants);
  airBonusFish = fish;
  bonusAccum += bankedPoints;
  if (bankedPoints > 0) {
    const p = worldToClient(hook.x, CONFIG.surfaceY);
    const bankedDollars = Math.round(bankedPoints * CONFIG.bonusMoneyPerPoint);
    spawnFloater(p.x, p.y, `+${formatMoney(bankedDollars)}`);
  }
  shake = 0;
  bonusHitShake = 0;
  bonusTapStreak = 0;
  bonusSkyCheer = 0;
  camImpulseY += CONFIG.bonusIntroCamImpulse;
  bonusJuice.spawnLaunchBurst(hook.x, CONFIG.surfaceY);
  bonusJuice.spawnLaunchBurst(hook.x + 0.15, CONFIG.surfaceY);
  bonusJuice.spawnLaunchBurst(hook.x - 0.15, CONFIG.surfaceY);
  showHudToast("BONUS!", 520);
  camFollowY = THREE.MathUtils.lerp(camFollowY, bonusCameraTrackingTargetY(), 0.35);
  appState = AppState.BonusToss;
}

function goResult(): void {
  disposeBonusTossFish(airBonusFish, world);
  airBonusFish = [];
  bonusJuice.clear();
  bonusOrthoZoom = 1;
  setCameraHalfHeightScale(1);
  bonusHitShake = 0;
  bonusTapStreak = 0;
  bonusSkyCheer = 0;

  appState = AppState.Result;
  const haul = buildFishHaulBreakdown(caughtByTier, maxDepthUnits);
  const bonusDollars = Math.round(bonusAccum * CONFIG.bonusMoneyPerPoint);
  lastRunMult = haul.depthMult;
  lastRunScore = haul.fishPayout + bonusDollars;
  lastRunFish = fishCaught;
  lastRunDepth = maxDepthUnits;
  showResultReward({
    haul,
    bonusDollars,
    totalDollars: lastRunScore,
    depthM: lastRunDepth,
  });
}

function phaseLabel(): string {
  if (appState !== AppState.Playing) return "";
  return phase === PlayPhase.Descent ? "Down: dodge fish" : "Up: catch fish";
}

function tick(dt: number): void {
  time += dt;
  camImpulseY *= Math.exp(-dt * 4.8);
  updateSplashes(dt);

  if (shake > 0) {
    shake = Math.max(0, shake - CONFIG.shakeDecay * dt);
  }

  if (appState === AppState.Ready || appState === AppState.Result) {
    updateCameraFollow(dt);
    applyCamera(shake);
    updateAtmosphere(0, time);
    bubbleVfx.update(dt, time);
    hook.update(dt, pointerTargetX, time, CONFIG.surfaceY + 1.4, false);
    const depthHud =
      appState === AppState.Ready
        ? 0
        : lastRunDepth;
    const phaseHud =
      appState === AppState.Ready ? "Tap to drop" : "Nice run!";
    const caughtHud = appState === AppState.Result ? lastRunFish : fishCaught;
    const multHud =
      appState === AppState.Result ? lastRunMult : undefined;
    setHud(depthHud, phaseHud, caughtHud, undefined, multHud, undefined);
    renderer.render(scene, camera);
    return;
  }

  if (appState === AppState.SurfacePayoff) {
    surfacePayoffT -= dt;
    hook.update(dt, pointerTargetX, time, CONFIG.surfaceY + 1.4, false);
    updateCameraFollow(dt);
    applyCamera(shake);
    updateAtmosphere(maxDepthUnits, time);
    bubbleVfx.update(dt, time, {
      x: hook.x,
      y: CONFIG.surfaceY,
      pull: 0.22,
    });
    hudDisplayDepth = THREE.MathUtils.lerp(
      hudDisplayDepth,
      maxDepthUnits,
      1 - Math.exp(-CONFIG.hudDepthLerp * dt),
    );
    const mult = depthScoreMult(maxDepthUnits);
    const haulLine =
      fishCaught > 0
        ? `×${fishCaught} · ${formatMoney(haulSubtotalFromCounts(caughtByTier))}`
        : undefined;
    setHud(hudDisplayDepth, "You made it!", fishCaught, undefined, mult, haulLine);
    if (surfacePayoffT <= 0) {
      beginBonusTossAtSurface();
    }
    renderer.render(scene, camera);
    return;
  }

  if (appState === AppState.BonusToss) {
    if (shake > 0) {
      shake = Math.max(0, shake - CONFIG.shakeDecay * dt);
    }
    bonusHitShake *= Math.exp(-dt * CONFIG.bonusHitShakeDecay);
    bonusSkyCheer = Math.min(
      1,
      bonusSkyCheer + dt / Math.max(0.08, CONFIG.bonusSkyCheerRampSec),
    );
    bonusPhaseElapsed += dt;
    const sloMoDt = dt * CONFIG.bonusTimeScale;
    const b = getBonusActiveFishYBounds();
    const spread = b ? Math.max(0.35, b.maxY - b.minY) : 1;
    const targetZoom = THREE.MathUtils.clamp(
      CONFIG.bonusOrthoZoomMin + spread * CONFIG.bonusOrthoZoomPerSpread,
      CONFIG.bonusOrthoZoomMin,
      CONFIG.bonusOrthoZoomMax,
    );
    bonusOrthoZoom = THREE.MathUtils.lerp(
      bonusOrthoZoom,
      targetZoom,
      1 - Math.exp(-CONFIG.bonusOrthoZoomLerp * dt),
    );
    setCameraHalfHeightScale(bonusOrthoZoom);
    const viewHalfH = CONFIG.cameraHalfHeight * bonusOrthoZoom;

    updateCameraFollow(dt);
    const bonusShake = Math.min(
      CONFIG.bonusShakeCapBonus,
      shake + bonusHitShake,
    );
    applyCamera(bonusShake);
    updateBonusTossFish(airBonusFish, sloMoDt, bonusPhaseElapsed, camFollowY, viewHalfH);
    for (const f of airBonusFish) {
      if (f.justLaunched) {
        f.justLaunched = false;
        bonusJuice.spawnLaunchBurst(f.sprite.position.x, CONFIG.surfaceY);
      }
    }
    hook.update(sloMoDt, pointerTargetX, time, CONFIG.surfaceY + 1.4, false);
    if (isBonusTossComplete(airBonusFish, bonusPhaseElapsed)) {
      goResult();
      return;
    }
    updateAtmosphere(maxDepthUnits, time, bonusSkyCheer);
    const bm = depthScoreMult(maxDepthUnits);
    const phaseBonusHud =
      bonusPhaseElapsed < 0.48 ? "BONUS! · TAP!" : "TAP THE FISH!";
    setHud(
      maxDepthUnits,
      phaseBonusHud,
      fishCaught,
      Math.round(bonusAccum * CONFIG.bonusMoneyPerPoint),
      bm,
      undefined,
    );
    bonusJuice.update(dt);
    bubbleVfx.update(dt, time, { x: hook.x, y: hook.y, pull: 0.12 });
    renderer.render(scene, camera);
    return;
  }

  const descending = phase === PlayPhase.Descent;

  if (descending) {
    updateSwimmingFishIdle(fish, time, dt);
    hook.y -= CONFIG.descentSpeed * dt;
    const depthNow = CONFIG.surfaceY - hook.y;
    maxDepthUnits = Math.max(maxDepthUnits, depthNow);

    if (
      prevHookY >= CONFIG.surfaceY - 0.22 &&
      hook.y < CONFIG.surfaceY - 0.22
    ) {
      shake = Math.min(shake + 0.07, 0.22);
      addMicroSplash(hook.x, CONFIG.surfaceY);
    }

    const hit = findFirstFishHit(hook.x, hook.y, CONFIG.hookRadius, fish);
    if (hit) {
      phase = PlayPhase.Ascent;
      shake = Math.max(shake, CONFIG.shakeHitDescent);
    }
  } else {
    updateSwimmingFishIdle(fish, time, dt);
    hook.y += CONFIG.ascentSpeed * dt;
    collectAscentFish();
    updateSnapFish(dt);

    if (
      prevHookY < CONFIG.surfaceY - 0.12 &&
      hook.y >= CONFIG.surfaceY - 0.14
    ) {
      camImpulseY += 0.38;
      shake = Math.min(shake + 0.09, 0.28);
      addMicroSplash(hook.x, CONFIG.surfaceY);
    }

    if (hook.y >= CONFIG.surfaceY - 0.15) {
      hook.y = CONFIG.surfaceY - 0.15;
      addSplash(hook.x, CONFIG.surfaceY);
      addSurfaceRing(hook.x, CONFIG.surfaceY);
      shake = Math.max(shake, CONFIG.shakeSurface);
      if (fishCaught <= 0) {
        bonusAccum = 0;
        goResult();
      } else {
        surfacePayoffT = CONFIG.surfacePayoffSec;
        appState = AppState.SurfacePayoff;
        camImpulseY += 0.58;
        showHudToast("Surface!", 650);
      }
    }
  }

  if (appState !== AppState.Playing) {
    renderer.render(scene, camera);
    return;
  }

  hook.update(dt, pointerTargetX, time, CONFIG.surfaceY + 1.4, descending);
  updateCameraFollow(dt);
  applyCamera(shake);
  const rawDepthHud = Math.max(0, CONFIG.surfaceY - hook.y);
  updateAtmosphere(rawDepthHud, time);
  prevHookY = hook.y;

  nearMissCooldown = Math.max(0, nearMissCooldown - dt);
  if (descending && nearMissCooldown <= 0) {
    const r = CONFIG.hookRadius;
    const r2 = r * r;
    const outer = r + CONFIG.nearMissExtra;
    const o2 = outer * outer;
    for (const f of fish) {
      if (!f.alive || f.state !== "swim") continue;
      const d2 = pointToAabbDistSq(
        hook.x,
        hook.y,
        f.x,
        f.y,
        f.hitHalfW,
        f.hitHalfH,
      );
      if (d2 > r2 && d2 < o2) {
        nearMissCooldown = CONFIG.nearMissCooldownSec;
        const p = worldToClient(hook.x, hook.y);
        spawnFloater(p.x, p.y + 18, "close", "floater--ding");
        camImpulseY += 0.06;
        break;
      }
    }
  }

  hudDisplayDepth = THREE.MathUtils.lerp(
    hudDisplayDepth,
    rawDepthHud,
    1 - Math.exp(-CONFIG.hudDepthLerp * dt),
  );
  const depthBand = Math.floor(rawDepthHud / 10);
  if (depthBand > lastDepthMilestoneBand && depthBand >= 1) {
    lastDepthMilestoneBand = depthBand;
    pulseDepthReadout();
    const dm = depthScoreMult(rawDepthHud);
    showHudToast(dm >= 2 ? `${depthBand * 10} m · ×${dm}` : `${depthBand * 10} m`, 820);
  }

  const multHud = depthScoreMult(maxDepthUnits);
  const ascentHaul =
    !descending && fishCaught > 0
      ? `×${fishCaught} · ${formatMoney(haulSubtotalFromCounts(caughtByTier))}`
      : undefined;
  setHud(hudDisplayDepth, phaseLabel(), fishCaught, undefined, multHud, ascentHaul);
  bubbleVfx.update(dt, time, {
    x: hook.x,
    y: hook.y,
    pull: descending ? 1 : 0.28,
  });
  renderer.render(scene, camera);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (e) => {
  if (appState === AppState.SurfacePayoff) {
    e.preventDefault();
    return;
  }
  if (appState === AppState.BonusToss) {
    const tap = tryTapBonusFish(
      airBonusFish,
      e.clientX,
      e.clientY,
      worldToClient,
      bonusPhaseElapsed,
    );
    if (tap.pts > 0) {
      bonusAccum += tap.pts;
      bonusTapStreak += 1;
      const stack = Math.min(10, bonusTapStreak);
      bonusHitShake = Math.min(
        CONFIG.bonusShakeCapBonus,
        bonusHitShake +
          CONFIG.bonusTapShakeBase +
          stack * CONFIG.bonusTapShakeStack,
      );
      if (tap.worldX !== undefined && tap.worldY !== undefined) {
        bonusJuice.spawnTapBurst(tap.worldX, tap.worldY, bonusTapStreak);
        const fp = worldToClient(tap.worldX, tap.worldY);
        const floaterClass =
          bonusTapStreak >= 3 ? "floater--bonusHot" : "floater--bonus";
        const tapD = Math.round(tap.pts * CONFIG.bonusMoneyPerPoint);
        spawnFloater(fp.x, fp.y, `+${formatMoney(tapD)}`, floaterClass);
      } else {
        const tapD = Math.round(tap.pts * CONFIG.bonusMoneyPerPoint);
        spawnFloater(e.clientX, e.clientY, `+${formatMoney(tapD)}`, "floater--bonus");
      }
    }
    e.preventDefault();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  pointerTargetX = clientXToWorldX(e.clientX);
  e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  if (appState === AppState.BonusToss || appState === AppState.SurfacePayoff) {
    e.preventDefault();
    return;
  }
  pointerTargetX = clientXToWorldX(e.clientX);
  e.preventDefault();
});

showReadyOverlay();
setHud(0, "Tap to drop", 0);

onOverlayTap(() => {
  if (appState === AppState.Ready) {
    hideOverlay();
    appState = AppState.Playing;
    phase = PlayPhase.Descent;
    resetRun();
  }
});

onResultRetry(() => {
  if (appState !== AppState.Result) return;
  hideOverlay();
  appState = AppState.Playing;
  phase = PlayPhase.Descent;
  resetRun();
});

requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  setCameraHalfHeightScale(1);
  bubbleVfx.dispose();
  bonusJuice.clear();
  disposeBonusTossFish(airBonusFish, world);
  disposeSharedBonusFishTextures();
  hook.reset(CONFIG.surfaceY);
  disposeFishPool(fish, world);
  disposeSharedFishTexture();
  disposeScene();
  hook.dispose();
});
