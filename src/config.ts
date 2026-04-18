/** Tunable gameplay + presentation constants */

/** Depth bands (m below surface): more fish + tighter spacing as you go deeper. */
export type FishTier = {
  depthMin: number;
  depthMax: number;
  count: number;
  minSep: number;
};

/**
 * Disjoint depth bands: few / wide / easy near surface → more fish and tighter
 * spacing deeper down. Counts ramp slowly at first so progression feels fair.
 */
export const FISH_TIERS: FishTier[] = [
  { depthMin: 5, depthMax: 22, count: 2, minSep: 6.9 },
  { depthMin: 22, depthMax: 42, count: 4, minSep: 6.2 },
  { depthMin: 42, depthMax: 68, count: 7, minSep: 5.4 },
  { depthMin: 68, depthMax: 98, count: 10, minSep: 4.65 },
  { depthMin: 98, depthMax: 135, count: 14, minSep: 4.0 },
  { depthMin: 135, depthMax: 185, count: 18, minSep: 3.45 },
  { depthMin: 185, depthMax: 245, count: 22, minSep: 2.95 },
  { depthMin: 245, depthMax: 320, count: 26, minSep: 2.5 },
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
  /** Post-surface tap bonus (flat per fish, internal “points”). */
  bonusPerTap: 8,
  /** Display/economy: dollars granted per bonus point (points × this). */
  bonusMoneyPerPoint: 10,
  bonusTossMaxSeconds: 3.2,
  bonusGravity: 22,
  /** Max simultaneous airborne tap targets; overflow banked at phase start. */
  bonusMaxAirTargets: 12,
  bonusLaunchStagger: 0.045,
  bonusLaunchVxSpread: 4.2,
  bonusLaunchVyMin: 23,
  bonusLaunchVyMax: 31,
  bonusSpawnJitterX: 0.55,
  bonusSpawnYOffset: 0.72,
  bonusMissMarginBelowView: 2.5,
  /** Bonus toss only: sim speed for fish physics (wall-clock timer stays real). */
  bonusTimeScale: 0.44,
  /** Camera lerp toward fish-midpoint target (real-time dt; separate from fish slow-mo). */
  bonusCameraTrackLerp: 5.2,
  /** Nudge tracking target up so arcs sit slightly higher in frame (world Y). */
  bonusCameraTrackBiasUp: 2.1,
  /** Keep camera center from dipping too far below the surface read. */
  bonusCameraTrackMinY: 11.5,
  bonusCameraTrackMaxY: 48,
  /** Ortho half-height scale from vertical spread (subtle zoom out when fish spread). */
  bonusOrthoZoomPerSpread: 0.028,
  bonusOrthoZoomMin: 1,
  bonusOrthoZoomMax: 1.12,
  /** Smooth ortho zoom changes (real-time dt). */
  bonusOrthoZoomLerp: 9,

  // --- presentation / juice (keep gameplay numbers above unchanged) ---
  /** Horizontal depth stripes in sea shader (meters). */
  depthStripeIntervalM: 10,
  /** Pause at surface with splash before bonus toss (seconds). */
  surfacePayoffSec: 0.42,
  /** HUD depth readout smoothing (higher = snappier). */
  hudDepthLerp: 14,
  /** Near-miss band beyond hook radius on descent (world). */
  nearMissExtra: 0.26,
  /** Min seconds between near-miss pulses (global). */
  nearMissCooldownSec: 0.55,
  /** Extra roll on hook while descending (multiplies bob). */
  hookDescentRollMul: 1.45,
  /** Extra horizontal sway on descent (world, applied after steer). */
  hookDescentSway: 0.052,
  /** Trail opacity while descending vs ascending. */
  trailOpacityDescent: 0.68,
  trailOpacityAscent: 0.42,
  /** Per caught fish adds this much to catch bounce peak. */
  catchBouncePerFish: 0.14,
  /** Extra horizontal spread for bonus toss arcs. */
  bonusLaunchVxExtraSpread: 1.35,
  /** Extra vertical variety for bonus toss. */
  bonusLaunchVyJitter: 5.2,

  // --- bonus phase polish (presentation only) ---
  /** Slightly easier airborne taps (px radius). */
  bonusTapRadiusPx: 60,
  /** Decay rate for tap-only screen punch (higher = shorter). */
  bonusHitShakeDecay: 26,
  /** Base tap shake strength (added on each hit, capped with stack). */
  bonusTapShakeBase: 0.11,
  /** Extra shake per consecutive tap in the same bonus. */
  bonusTapShakeStack: 0.014,
  /** Max combined shake during bonus (tap punch + any residual). */
  bonusShakeCapBonus: 0.38,
  /** Cool-tone particles per fish leaving the surface. */
  bonusLaunchParticleCount: 8,
  /** Warm burst particles on successful tap (before streak bonus). */
  bonusTapParticleCount: 11,
  /** Seconds to blend sky into “reward” cheer look. */
  bonusSkyCheerRampSec: 0.42,
  /** Camera kick when bonus phase starts. */
  bonusIntroCamImpulse: 0.26,
} as const;

export type Config = typeof CONFIG;
