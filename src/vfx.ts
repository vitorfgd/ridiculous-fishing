import * as THREE from "three";
import { CONFIG } from "./config";
import bubble1Url from "./assets/bubble-1.png";

/** Total ambient bubble pool (fills the whole ocean column). */
const BUBBLE_N = 120;
/** Ambient bubbles span full dive range (world meters below surface). */
const BUBBLE_DEPTH_MIN_M = 2;
const BUBBLE_DEPTH_MAX_M = 340;

export type HookBubbleBias = {
  x: number;
  y: number;
  /** 0 = off, 1 = strong (descent). */
  pull: number;
};

export type BubbleVfx = {
  group: THREE.Group;
  update: (dt: number, time: number, hook?: HookBubbleBias) => void;
  dispose: () => void;
};

function loadBubbleTexture(): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const t = loader.load(bubble1Url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.premultiplyAlpha = false;
  t.format = THREE.RGBAFormat;
  return t;
}

function textureAspect(tex: THREE.Texture): number {
  const img = tex.image as HTMLImageElement | undefined;
  const w = img?.naturalWidth ?? img?.width ?? 16;
  const h = img?.naturalHeight ?? img?.height ?? 16;
  return w / Math.max(h, 1);
}

function applyAmbientScale(sprite: THREE.Sprite, tex: THREE.Texture): void {
  const aspect = textureAspect(tex);
  const baseSize = 0.28 + Math.random() * 0.52;
  sprite.scale.set(baseSize * aspect, baseSize, 1);
}

function applyHookScale(sprite: THREE.Sprite, tex: THREE.Texture): void {
  const aspect = textureAspect(tex);
  const baseSize = 0.14 + Math.random() * 0.18; /* smaller than ambient */
  sprite.scale.set(baseSize * aspect, baseSize, 1);
}

export function createBubbleVfx(world: THREE.Object3D): BubbleVfx {
  const group = new THREE.Group();
  group.name = "bubbles";
  world.add(group);

  const bubbleTex = loadBubbleTexture();

  type B = {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    speed: number;
    phase: number;
  };
  const pool: B[] = [];

  for (let i = 0; i < BUBBLE_N; i++) {
    const mat = new THREE.SpriteMaterial({
      map: bubbleTex,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0.5);
    const phase = Math.random() * Math.PI * 2;
    const b: B = { sprite, mat, speed: 0.5, phase };
    resetAmbient(b, i);
    group.add(sprite);
    pool.push(b);
  }

  function resetAmbient(b: B, seed: number): void {
    b.mat.opacity = 0.22 + Math.random() * 0.38;
    b.mat.needsUpdate = true;
    applyAmbientScale(b.sprite, bubbleTex);
    const x = THREE.MathUtils.randFloat(CONFIG.hookMinX - 1.4, CONFIG.hookMaxX + 1.4);
    const depth = THREE.MathUtils.randFloat(BUBBLE_DEPTH_MIN_M, BUBBLE_DEPTH_MAX_M);
    b.sprite.position.set(
      x + Math.sin(seed * 1.7) * 0.55,
      CONFIG.surfaceY - depth,
      THREE.MathUtils.randFloat(0.35, 0.72),
    );
    b.speed = 0.30 + Math.random() * 0.70;
    b.phase = Math.random() * Math.PI * 2;
  }

  function resetHook(b: B, hookX: number, hookY: number): void {
    b.mat.opacity = 0.18 + Math.random() * 0.25;
    b.mat.needsUpdate = true;
    applyHookScale(b.sprite, bubbleTex);
    b.sprite.position.set(
      hookX + (Math.random() - 0.5) * 0.40,
      hookY - Math.random() * 0.8,
      THREE.MathUtils.randFloat(0.35, 0.65),
    );
    b.speed = 0.50 + Math.random() * 0.90;
    b.phase = Math.random() * Math.PI * 2;
  }

  function update(dt: number, time: number, hook?: HookBubbleBias): void {
    const top = CONFIG.surfaceY - 0.25;
    const pull = hook?.pull ?? 0;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i]!;
      b.sprite.position.y += b.speed * dt;
      b.sprite.position.x += Math.sin(time * 1.35 + b.phase) * 0.018 * dt;
      if (b.sprite.position.y > top) {
        resetAmbient(b, i + time);
      }
      /* Hook pull: less frequent (i % 8 instead of i % 3), smaller bubbles. */
      if (pull > 0.04 && hook && Math.random() < pull * dt * 1.4 && i % 8 === 0) {
        resetHook(b, hook.x, hook.y);
      }
    }
  }

  function dispose(): void {
    world.remove(group);
    for (const b of pool) {
      b.mat.map = null;
      b.mat.dispose();
    }
    bubbleTex.dispose();
  }

  return { group, update, dispose };
}
