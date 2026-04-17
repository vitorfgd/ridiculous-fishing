import * as THREE from "three";
import fishSpriteUrl from "./assets/fish-sprite.png";

/** Plane width at `scale: 1` (world units). Original art was 0.72. */
const FISH_PLANE_BASE = 1.92;
const HIT_RESCALE = FISH_PLANE_BASE / 0.72;

/** Hit boxes + scale; `tint` multiplies the sprite colors for variety. */
export const FISH_TYPES = [
  { id: 0, hitHalfW: 0.48 * HIT_RESCALE, hitHalfH: 0.22 * HIT_RESCALE, scale: 1.0, tint: 0xffffff },
  { id: 1, hitHalfW: 0.52 * HIT_RESCALE, hitHalfH: 0.26 * HIT_RESCALE, scale: 1.05, tint: 0xffb8d8 },
  { id: 2, hitHalfW: 0.62 * HIT_RESCALE, hitHalfH: 0.2 * HIT_RESCALE, scale: 1.1, tint: 0xffe8a8 },
  { id: 3, hitHalfW: 0.42 * HIT_RESCALE, hitHalfH: 0.3 * HIT_RESCALE, scale: 0.92, tint: 0xb8d4ff },
  { id: 4, hitHalfW: 0.58 * HIT_RESCALE, hitHalfH: 0.3 * HIT_RESCALE, scale: 1.15, tint: 0xe8c8ff },
] as const;

/** Width ÷ height for the fish PNG (used by gameplay + bonus toss sprites). */
export const FISH_SPRITE_ASPECT = 32 / 20;

let sharedFishTexture: THREE.Texture | null = null;

/** Shared by underwater fish meshes and bonus air sprites (same PNG). */
export function getSharedFishTexture(): THREE.Texture {
  if (!sharedFishTexture) {
    const loader = new THREE.TextureLoader();
    sharedFishTexture = loader.load(fishSpriteUrl);
    sharedFishTexture.colorSpace = THREE.SRGBColorSpace;
    sharedFishTexture.magFilter = THREE.NearestFilter;
    sharedFishTexture.minFilter = THREE.NearestFilter;
    sharedFishTexture.generateMipmaps = false;
    sharedFishTexture.premultiplyAlpha = false;
    sharedFishTexture.format = THREE.RGBAFormat;
  }
  return sharedFishTexture;
}

/** Call once on teardown if you need to free GPU memory (optional). */
export function disposeSharedFishTexture(): void {
  sharedFishTexture?.dispose();
  sharedFishTexture = null;
}

/**
 * @param faceRight When true, mirrors the sprite so a left-facing texture reads as swimming right.
 */
export function createFishMeshGroup(typeIndex: number, faceRight: boolean): THREE.Group {
  const t = FISH_TYPES[typeIndex % FISH_TYPES.length]!;
  const group = new THREE.Group();

  const map = getSharedFishTexture();
  const w = FISH_PLANE_BASE * t.scale;
  const h = w / FISH_SPRITE_ASPECT;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
    color: new THREE.Color(t.tint),
  });
  const body = new THREE.Mesh(geo, mat);
  body.name = "body";
  body.rotation.z = Math.PI;
  body.scale.x = faceRight ? -1 : 1;
  group.add(body);

  return group;
}

export function updateFishIdleAnimation(
  group: THREE.Group,
  time: number,
  phase: number,
  _dt: number,
): void {
  const sway = Math.sin(time * 1.1 + phase) * 0.07;
  group.rotation.z = sway;
}
