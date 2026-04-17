import * as THREE from "three";
import { CONFIG } from "./config";
import bubble0Url from "./assets/bubble-0.png";
import bubble1Url from "./assets/bubble-1.png";
import bubble2Url from "./assets/bubble-2.png";

const BUBBLE_N = 72;

const BUBBLE_URLS = [bubble0Url, bubble1Url, bubble2Url];

export type BubbleVfx = {
  group: THREE.Group;
  update: (dt: number, time: number) => void;
  dispose: () => void;
};

function loadBubbleTextures(): THREE.Texture[] {
  const loader = new THREE.TextureLoader();
  return BUBBLE_URLS.map((url) => {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.premultiplyAlpha = false;
    t.format = THREE.RGBAFormat;
    return t;
  });
}

function textureAspect(tex: THREE.Texture): number {
  const img = tex.image as HTMLImageElement | undefined;
  const w = img?.naturalWidth ?? img?.width ?? 16;
  const h = img?.naturalHeight ?? img?.height ?? 16;
  return w / Math.max(h, 1);
}

function applySpriteScale(sprite: THREE.Sprite, tex: THREE.Texture): void {
  const aspect = textureAspect(tex);
  const baseSize = 0.34 + Math.random() * 0.58;
  sprite.scale.set(baseSize * aspect, baseSize, 1);
}

export function createBubbleVfx(world: THREE.Object3D): BubbleVfx {
  const group = new THREE.Group();
  group.name = "bubbles";
  world.add(group);

  const textures = loadBubbleTextures();

  type B = {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    speed: number;
    phase: number;
  };
  const pool: B[] = [];

  for (let i = 0; i < BUBBLE_N; i++) {
    const texIndex = Math.floor(Math.random() * textures.length);
    const map = textures[texIndex]!;
    const mat = new THREE.SpriteMaterial({
      map,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      depthTest: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0.5);
    const phase = Math.random() * Math.PI * 2;
    const b: B = { sprite, mat, speed: 0.5, phase };
    resetBubble(b, textures, i);
    group.add(sprite);
    pool.push(b);
  }

  function resetBubble(b: B, texList: THREE.Texture[], seed: number): void {
    const texIndex = Math.floor(Math.random() * texList.length);
    const map = texList[texIndex]!;
    b.mat.map = map;
    b.mat.opacity = 0.26 + Math.random() * 0.4;
    b.mat.needsUpdate = true;

    applySpriteScale(b.sprite, map);

    const x = THREE.MathUtils.randFloat(CONFIG.hookMinX - 1.4, CONFIG.hookMaxX + 1.4);
    const depth = THREE.MathUtils.randFloat(3, 72);
    b.sprite.position.set(
      x + Math.sin(seed * 1.7) * 0.55,
      CONFIG.surfaceY - depth,
      THREE.MathUtils.randFloat(0.06, 0.48),
    );
    b.speed = 0.35 + Math.random() * 0.75;
    b.phase = Math.random() * Math.PI * 2;
  }

  function update(dt: number, time: number): void {
    const top = CONFIG.surfaceY - 0.25;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i]!;
      b.sprite.position.y += b.speed * dt;
      b.sprite.position.x += Math.sin(time * 1.35 + b.phase) * 0.018 * dt;
      if (b.sprite.position.y > top) {
        resetBubble(b, textures, i + time);
      }
    }
  }

  function dispose(): void {
    world.remove(group);
    for (const b of pool) {
      b.mat.map = null;
      b.mat.dispose();
    }
    for (const t of textures) {
      t.dispose();
    }
  }

  return { group, update, dispose };
}
