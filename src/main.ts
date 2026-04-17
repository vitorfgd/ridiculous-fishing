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
import { circleHitsAabb, findFirstFishHit } from "./collision";
import { computeScore } from "./scoring";
import {
  disposeBonusTossFish,
  isBonusTossComplete,
  spawnBonusTossFish,
  tryTapBonusFish,
  updateBonusTossFish,
  type AirBonusFish,
} from "./bonusToss";
import { disposeSharedBonusFishTextures } from "./bonusFishSprites";
import { createBubbleVfx } from "./vfx";
import {
  hideOverlay,
  onOverlayTap,
  setHud,
  showReadyOverlay,
  showResultOverlay,
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
let shake = 0;
let pointerTargetX = 0;
let lastRunScore = 0;
let lastRunMult = 1;
let lastRunFish = 0;
let lastRunDepth = 0;
let lastRunBaseScore = 0;
let lastRunBonusScore = 0;

let baseFishingScore = 0;
let bonusAccum = 0;
let bonusPhaseElapsed = 0;
let airBonusFish: AirBonusFish[] = [];
/** Orthographic half-height scale during bonus (1 outside bonus). */
let bonusOrthoZoom = 1;

/** Upward camera kick when hook breaches surface (decays). */
let camImpulseY = 0;
let prevHookY = CONFIG.surfaceY - 0.6;

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
      const p = worldToClient(f.x, f.y);
      spawnFloater(p.x, p.y, "+1");
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
      hook.triggerCatchBounce();
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
  time = 0;
  pointerTargetX = hook.x;
  camFollowY = CONFIG.surfaceY + CONFIG.cameraIdleBias;
  prevHookY = hook.y;
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
  baseFishingScore = computeScore(fishCaught, maxDepthUnits);
  bonusAccum = 0;
  bonusPhaseElapsed = 0;
  disposeBonusTossFish(airBonusFish, world);
  bonusOrthoZoom = 1;
  setCameraHalfHeightScale(1);
  const { fish, bankedPoints } = spawnBonusTossFish(world, fishCaught, hook.x);
  airBonusFish = fish;
  bonusAccum += bankedPoints;
  if (bankedPoints > 0) {
    const p = worldToClient(hook.x, CONFIG.surfaceY);
    spawnFloater(p.x, p.y, `+${bankedPoints} bank`);
  }
  shake = 0;
  camFollowY = THREE.MathUtils.lerp(camFollowY, bonusCameraTrackingTargetY(), 0.35);
  appState = AppState.BonusToss;
}

function goResult(): void {
  disposeBonusTossFish(airBonusFish, world);
  airBonusFish = [];
  bonusOrthoZoom = 1;
  setCameraHalfHeightScale(1);

  appState = AppState.Result;
  lastRunMult = Math.max(1, Math.floor(maxDepthUnits * CONFIG.depthMultiplier));
  lastRunBaseScore = baseFishingScore;
  lastRunBonusScore = bonusAccum;
  lastRunScore = baseFishingScore + bonusAccum;
  lastRunFish = fishCaught;
  lastRunDepth = maxDepthUnits;
  showResultOverlay(
    lastRunScore,
    lastRunBaseScore,
    lastRunBonusScore,
    lastRunFish,
    lastRunMult,
    lastRunDepth,
  );
}

function phaseLabel(): string {
  if (appState !== AppState.Playing) return "";
  return phase === PlayPhase.Descent ? "Down: dodge fish" : "Up: catch fish";
}

function tick(dt: number): void {
  time += dt;
  camImpulseY *= Math.exp(-dt * 4.8);
  updateSplashes(dt);
  bubbleVfx.update(dt, time);

  if (shake > 0) {
    shake = Math.max(0, shake - CONFIG.shakeDecay * dt);
  }

  if (appState === AppState.Ready || appState === AppState.Result) {
    updateCameraFollow(dt);
    applyCamera(shake);
    updateAtmosphere(0, time);
    hook.update(dt, pointerTargetX, time, CONFIG.surfaceY + 1.4, false);
    const depthHud =
      appState === AppState.Ready
        ? 0
        : lastRunDepth;
    const phaseHud =
      appState === AppState.Ready ? "Tap to drop" : "Nice run!";
    const caughtHud = appState === AppState.Result ? lastRunFish : fishCaught;
    setHud(depthHud, phaseHud, caughtHud);
    renderer.render(scene, camera);
    return;
  }

  if (appState === AppState.BonusToss) {
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
    applyCamera(0);
    updateBonusTossFish(airBonusFish, sloMoDt, bonusPhaseElapsed, camFollowY, viewHalfH);
    hook.update(sloMoDt, pointerTargetX, time, CONFIG.surfaceY + 1.4, false);
    if (isBonusTossComplete(airBonusFish, bonusPhaseElapsed)) {
      goResult();
      return;
    }
    updateAtmosphere(maxDepthUnits, time);
    setHud(maxDepthUnits, "TAP THE FISH!", fishCaught, bonusAccum);
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
      shake = Math.max(shake, CONFIG.shakeSurface);
      if (fishCaught <= 0) {
        baseFishingScore = computeScore(fishCaught, maxDepthUnits);
        bonusAccum = 0;
        goResult();
      } else {
        beginBonusTossAtSurface();
      }
    }
  }

  hook.update(dt, pointerTargetX, time, CONFIG.surfaceY + 1.4, descending);
  updateCameraFollow(dt);
  applyCamera(shake);
  updateAtmosphere(Math.max(0, CONFIG.surfaceY - hook.y), time);
  prevHookY = hook.y;
  const depthHud = Math.max(0, CONFIG.surfaceY - hook.y);
  setHud(depthHud, phaseLabel(), fishCaught);
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
  if (appState === AppState.BonusToss) {
    const pts = tryTapBonusFish(
      airBonusFish,
      e.clientX,
      e.clientY,
      worldToClient,
      bonusPhaseElapsed,
    );
    if (pts > 0) {
      bonusAccum += pts;
      spawnFloater(e.clientX, e.clientY, `+${pts}`);
    }
    e.preventDefault();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  pointerTargetX = clientXToWorldX(e.clientX);
  e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  if (appState === AppState.BonusToss) {
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
    return;
  }
  if (appState === AppState.Result) {
    hideOverlay();
    appState = AppState.Playing;
    phase = PlayPhase.Descent;
    resetRun();
  }
});

requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  setCameraHalfHeightScale(1);
  bubbleVfx.dispose();
  disposeBonusTossFish(airBonusFish, world);
  disposeSharedBonusFishTextures();
  disposeScene();
  hook.dispose();
  disposeFishPool(fish, world);
});
