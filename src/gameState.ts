export enum AppState {
  Ready = "Ready",
  Playing = "Playing",
  BonusToss = "BonusToss",
  Result = "Result",
}

export enum PlayPhase {
  Descent = "Descent",
  Ascent = "Ascent",
}

export type RunStats = {
  maxDepthUnits: number;
  fishCaught: number;
  finalScore: number;
};
