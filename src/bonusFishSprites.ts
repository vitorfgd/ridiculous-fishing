import * as THREE from "three";

const W = 128;
const H = 72;

let texUnder: THREE.CanvasTexture | null = null;
let texSky: THREE.CanvasTexture | null = null;

function drawUnderwaterFish(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, W, H);
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, "#0a4a7a");
  grd.addColorStop(0.5, "#1a8cba");
  grd.addColorStop(1, "#0d5c88");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(W * 0.48, H * 0.5, W * 0.38, H * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7ec8ff";
  ctx.beginPath();
  ctx.moveTo(W * 0.08, H * 0.5);
  ctx.lineTo(W * 0.28, H * 0.22);
  ctx.lineTo(W * 0.28, H * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e0f6ff";
  ctx.beginPath();
  ctx.arc(W * 0.58, H * 0.42, H * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff55";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(W * (0.35 + i * 0.08), H * 0.65, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSkyFish(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, W, H);
  const grd = ctx.createLinearGradient(0, H, W, 0);
  grd.addColorStop(0, "#ff9a3c");
  grd.addColorStop(0.45, "#ffd447");
  grd.addColorStop(1, "#fff3b0");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(W * 0.48, H * 0.5, W * 0.38, H * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff7a45";
  ctx.beginPath();
  ctx.moveTo(W * 0.08, H * 0.5);
  ctx.lineTo(W * 0.3, H * 0.2);
  ctx.lineTo(W * 0.3, H * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(W * 0.58, H * 0.42, H * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffffaa";
  ctx.beginPath();
  ctx.arc(W * 0.61, H * 0.38, H * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

function getTextures(): { under: THREE.CanvasTexture; sky: THREE.CanvasTexture } {
  if (!texUnder || !texSky) {
    const c1 = document.createElement("canvas");
    c1.width = W;
    c1.height = H;
    drawUnderwaterFish(c1.getContext("2d")!);
    texUnder = new THREE.CanvasTexture(c1);
    texUnder.colorSpace = THREE.SRGBColorSpace;
    texUnder.needsUpdate = true;

    const c2 = document.createElement("canvas");
    c2.width = W;
    c2.height = H;
    drawSkyFish(c2.getContext("2d")!);
    texSky = new THREE.CanvasTexture(c2);
    texSky.colorSpace = THREE.SRGBColorSpace;
    texSky.needsUpdate = true;
  }
  return { under: texUnder, sky: texSky };
}

export function applyInitialBonusFishSprite(
  sprite: THREE.Sprite,
  worldY: number,
  surfaceY: number,
): boolean {
  const below = worldY < surfaceY - 0.06;
  const { under, sky } = getTextures();
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map = below ? under : sky;
  mat.needsUpdate = true;
  return below;
}

export function createBonusFishSprite(): THREE.Sprite {
  const { under } = getTextures();
  const mat = new THREE.SpriteMaterial({
    map: under,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.15, 0.62, 1);
  return sprite;
}

/** Call each frame after moving the sprite; swaps texture at the water surface. */
export function updateBonusFishSpriteRegion(
  sprite: THREE.Sprite,
  worldY: number,
  surfaceY: number,
  wasBelow: boolean,
): boolean {
  const below = worldY < surfaceY - 0.06;
  if (below === wasBelow) return wasBelow;
  const { under, sky } = getTextures();
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map = below ? under : sky;
  mat.needsUpdate = true;
  return below;
}

export function disposeSharedBonusFishTextures(): void {
  texUnder?.dispose();
  texSky?.dispose();
  texUnder = null;
  texSky = null;
}
