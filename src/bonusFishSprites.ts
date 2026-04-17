import * as THREE from "three";
import { getSharedFishTexture, FISH_SPRITE_ASPECT } from "./fishVisual";

const COL_BELOW = new THREE.Color("#c8ecff");
const COL_ABOVE = new THREE.Color("#ffffff");

const BONUS_FISH_H = 0.92;
const BONUS_FISH_TAP_H = 1.18;

function setSpriteScale(sprite: THREE.Sprite, height: number, faceRight: boolean): void {
  const w = height * FISH_SPRITE_ASPECT;
  sprite.scale.set(faceRight ? -w : w, height, 1);
}

export function createBonusFishSprite(faceRight: boolean): THREE.Sprite {
  const map = getSharedFishTexture();
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
    color: COL_ABOVE.clone(),
  });
  const sprite = new THREE.Sprite(mat);
  setSpriteScale(sprite, BONUS_FISH_H, faceRight);
  return sprite;
}

export function applyInitialBonusFishSprite(
  sprite: THREE.Sprite,
  worldY: number,
  surfaceY: number,
): boolean {
  const below = worldY < surfaceY - 0.06;
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.color.copy(below ? COL_BELOW : COL_ABOVE);
  return below;
}

/** Call each frame after moving the sprite; updates tint above/below water. */
export function updateBonusFishSpriteRegion(
  sprite: THREE.Sprite,
  worldY: number,
  surfaceY: number,
  wasBelow: boolean,
): boolean {
  const below = worldY < surfaceY - 0.06;
  if (below === wasBelow) return wasBelow;
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.color.copy(below ? COL_BELOW : COL_ABOVE);
  return below;
}

/** Pop feedback when tapped (keeps horizontal mirror). */
export function applyBonusFishTapScale(sprite: THREE.Sprite, faceRight: boolean): void {
  setSpriteScale(sprite, BONUS_FISH_TAP_H, faceRight);
}

/** Texture is owned by `fishVisual`; nothing to free here. */
export function disposeSharedBonusFishTextures(): void {}
