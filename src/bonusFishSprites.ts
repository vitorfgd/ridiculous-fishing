import * as THREE from "three";
import { getFishTexture, FISH_ART_ASPECTS_PUBLIC } from "./fishVisual";

const COL_BELOW = new THREE.Color("#c8ecff");
const COL_ABOVE = new THREE.Color("#ffffff");

const BONUS_FISH_H = 0.92;
const BONUS_FISH_TAP_H = 1.18;

function aspectForVariant(variant: 0 | 1 | 2): number {
  return FISH_ART_ASPECTS_PUBLIC[variant];
}

function setSpriteScale(
  sprite: THREE.Sprite,
  height: number,
  faceRight: boolean,
  variant: 0 | 1 | 2,
): void {
  const aspect = aspectForVariant(variant);
  const w = height * aspect;
  /* New sprites (1,2) face left in the PNG — mirror to face right when needed.
     Classic (0) uses negative-X to mirror (same logic, different origin). */
  sprite.scale.set(faceRight ? -w : w, height, 1);
}

export function createBonusFishSprite(faceRight: boolean, artVariant: 0 | 1 | 2 = 0): THREE.Sprite {
  const map = getFishTexture(artVariant);
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
    color: COL_ABOVE.clone(),
  });
  const sprite = new THREE.Sprite(mat);
  sprite.userData.artVariant = artVariant;
  setSpriteScale(sprite, BONUS_FISH_H, faceRight, artVariant);
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
export function applyBonusFishTapScale(
  sprite: THREE.Sprite,
  faceRight: boolean,
): void {
  const variant = (sprite.userData.artVariant ?? 0) as 0 | 1 | 2;
  setSpriteScale(sprite, BONUS_FISH_TAP_H, faceRight, variant);
}

/** Textures are owned by `fishVisual`; nothing to free here. */
export function disposeSharedBonusFishTextures(): void {}
