import * as THREE from "three";
import fishSpriteUrl from "./assets/fish-sprite.png";
import fishSnapperUrl from "./assets/fish-snapper.png";
import fishAnglerUrl from "./assets/fish-angler.png";

/** Plane width at `scale: 1` (world units). Original art was 0.72. */
const FISH_PLANE_BASE = 1.92;
const HIT_RESCALE = FISH_PLANE_BASE / 0.72;

/** Hit boxes + scale; `tint` multiplies the sprite colors (classic art only). */
export const FISH_TYPES = [
  { id: 0, hitHalfW: 0.48 * HIT_RESCALE, hitHalfH: 0.22 * HIT_RESCALE, scale: 1.0, tint: 0xffffff },
  { id: 1, hitHalfW: 0.52 * HIT_RESCALE, hitHalfH: 0.26 * HIT_RESCALE, scale: 1.05, tint: 0xffb8d8 },
  { id: 2, hitHalfW: 0.62 * HIT_RESCALE, hitHalfH: 0.2 * HIT_RESCALE, scale: 1.1, tint: 0xffe8a8 },
  { id: 3, hitHalfW: 0.42 * HIT_RESCALE, hitHalfH: 0.3 * HIT_RESCALE, scale: 0.92, tint: 0xb8d4ff },
  { id: 4, hitHalfW: 0.58 * HIT_RESCALE, hitHalfH: 0.3 * HIT_RESCALE, scale: 1.15, tint: 0xe8c8ff },
] as const;

/** Width ÷ height per art variant (measured PNG pixels; bonus toss uses classic only). */
const FISH_ART_ASPECTS: readonly [number, number, number] = [
  350 / 250,
  614 / 406,
  653 / 382,
];

/** Classic fish aspect (bonus air sprites). */
export const FISH_SPRITE_ASPECT = FISH_ART_ASPECTS[0]!;

const ART_URLS = [fishSpriteUrl, fishSnapperUrl, fishAnglerUrl] as const;

const fishTextures: (THREE.Texture | null)[] = [null, null, null];

function loadFishTexture(art: 0 | 1 | 2): THREE.Texture {
  const cached = fishTextures[art];
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  const t = loader.load(ART_URLS[art]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.premultiplyAlpha = false;
  t.format = THREE.RGBAFormat;
  fishTextures[art] = t;
  return t;
}

/** Classic texture (underwater + bonus toss). */
export function getSharedFishTexture(): THREE.Texture {
  return loadFishTexture(0);
}

/** Get any fish texture by art variant (lazy-loads, shared). */
export function getFishTexture(variant: 0 | 1 | 2): THREE.Texture {
  return loadFishTexture(variant);
}

/** Width ÷ height for each art variant — exported for bonus sprites. */
export const FISH_ART_ASPECTS_PUBLIC: readonly [number, number, number] = [
  350 / 250,
  614 / 406,
  653 / 382,
];

/** Call once on teardown if you need to free GPU memory (optional). */
export function disposeSharedFishTexture(): void {
  for (let i = 0; i < fishTextures.length; i++) {
    fishTextures[i]?.dispose();
    fishTextures[i] = null;
  }
}

/**
 * @param faceRight When true, mirrors the sprite so a left-facing texture reads as swimming right.
 * @param sizeScale Visual + logical scale (1 = default); shallow spawns use under 1 for easier reads.
 * @param artVariant 0 classic, 1 snapper, 2 angler (custom PNGs skip economy tint).
 */
export function createFishMeshGroup(
  typeIndex: number,
  faceRight: boolean,
  sizeScale = 1,
  economyAccentHex?: string,
  artVariant: 0 | 1 | 2 = 0,
): THREE.Group {
  const t = FISH_TYPES[typeIndex % FISH_TYPES.length]!;
  const group = new THREE.Group();
  const sc = Math.max(0.45, Math.min(1.35, sizeScale));

  const map = loadFishTexture(artVariant);
  const aspect = FISH_ART_ASPECTS[artVariant]!;
  const w = FISH_PLANE_BASE * t.scale * sc;
  const h = w / aspect;
  const geo = new THREE.PlaneGeometry(w, h);
  const useTint = artVariant === 0;
  const col = new THREE.Color(t.tint);
  if (useTint && economyAccentHex) {
    col.multiply(new THREE.Color(economyAccentHex));
  }
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
    color: col,
  });
  const body = new THREE.Mesh(geo, mat);
  body.name = "body";
  if (artVariant === 0) {
    /* Classic PNG needs a 180° rotation to appear right-side-up in Three.js. */
    body.rotation.z = Math.PI;
    body.scale.x = faceRight ? -1 : 1;
  } else {
    /* New PNGs (snapper, angler) are already upright and face left in the file. */
    body.scale.x = faceRight ? -1 : 1;
  }
  group.add(body);

  return group;
}

export function updateFishIdleAnimation(
  group: THREE.Group,
  time: number,
  phase: number,
  _dt: number,
): void {
  const sway = Math.sin(time * 1.1 + phase) * 0.09 + Math.sin(time * 2.4 + phase * 2) * 0.025;
  group.rotation.z = sway;
}
