/** Tunable gameplay + presentation constants */

/** Depth bands (m below surface): more fish + tighter spacing as you go deeper. */
export type FishTier = {
  depthMin: number;
  depthMax: number;
  count: number;
  minSep: number;
};

/** Spacing tuned for large sprites; counts give a busy school. */
export const FISH_TIERS: FishTier[] = [
  { depthMin: 4, depthMax: 14, count: 4, minSep: 5.0 },
  { depthMin: 14, depthMax: 30, count: 7, minSep: 4.1 },
  { depthMin: 30, depthMax: 52, count: 11, minSep: 3.35 },
  { depthMin: 52, depthMax: 85, count: 16, minSep: 2.85 },
  { depthMin: 85, depthMax: 130, count: 21, minSep: 2.4 },
  { depthMin: 130, depthMax: 200, count: 26, minSep: 2.1 },
  { depthMin: 200, depthMax: 300, count: 30, minSep: 1.95 },
];

export const CONFIG = {
  worldHalfWidth: 5.2,
  /** Tighter ortho = closer, more arcade feel. */
  cameraHalfHeight: 11.5,
  cameraZ: 28,
  /** Water surface Y (world). */
  surfaceY: 15.5,
  /** Hook bob radius (world). */
  hookRadius: 0.35,
  descentSpeed: 10,
  ascentSpeed: 12,
  /** Horizontal follow speed toward pointer target. */
  hookHorizontalLerp: 14,
  hookMinX: -4.35,
  hookMaxX: 4.35,
  fishHalfWidth: 0.55,
  fishHalfHeight: 0.28,
  /** Score = caught * max(1, floor(depthM * k)). */
  depthMultiplier: 0.35,
  bobAmplitude: 0.12,
  bobFrequency: 5,
  trailMaxPoints: 24,
  shakeHitDescent: 0.35,
  shakeSurface: 0.55,
  shakeDecay: 12,
  splashParticleCount: 6,
  /** Camera Y lerp toward hook (higher = snappier). */
  cameraFollowLerp: 7,
  /** World Y offset so hook sits above frame center while descending (see more below). */
  cameraDescentBias: -4.2,
  /** While ascending, bias camera slightly so space above hook reads for catches. */
  cameraAscentBias: 2.4,
  /** Menu / result: show surface + bobber without tight follow. */
  cameraIdleBias: -5.5,
  /** Bonus toss: camera framing so arcs read in upper-middle (world Y center). */
  bonusCameraBias: -3.8,
  /** Post-surface tap bonus (flat per fish). */
  bonusPerTap: 8,
  bonusTossMaxSeconds: 3.2,
  bonusGravity: 22,
  bonusTapRadiusPx: 52,
  /** Max simultaneous airborne tap targets; overflow banked at phase start. */
  bonusMaxAirTargets: 12,
  bonusLaunchStagger: 0.045,
  bonusLaunchVxSpread: 4.2,
  bonusLaunchVyMin: 16,
  bonusLaunchVyMax: 22,
  bonusSpawnJitterX: 0.55,
  bonusSpawnYOffset: 0.35,
  bonusMissMarginBelowView: 2.5,
  bonusTapShake: 0.12,
  bonusShakeCap: 0.45,
  /** Bonus toss only: sim speed for fish physics (wall-clock timer stays real). */
  bonusTimeScale: 0.44,
  /** Camera lerp toward fish-midpoint target (real-time dt; separate from fish slow-mo). */
  bonusCameraTrackLerp: 5.2,
  /** Nudge tracking target up so arcs sit slightly higher in frame (world Y). */
  bonusCameraTrackBiasUp: 1.25,
  /** Keep camera center from dipping too far below the surface read. */
  bonusCameraTrackMinY: 11.5,
  bonusCameraTrackMaxY: 36,
  /** Ortho half-height scale from vertical spread (subtle zoom out when fish spread). */
  bonusOrthoZoomPerSpread: 0.028,
  bonusOrthoZoomMin: 1,
  bonusOrthoZoomMax: 1.12,
  /** Smooth ortho zoom changes (real-time dt). */
  bonusOrthoZoomLerp: 9,
} as const;

export type Config = typeof CONFIG;
