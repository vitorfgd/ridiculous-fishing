const depthEl = document.querySelector<HTMLDivElement>("#hud-depth")!;
const phaseEl = document.querySelector<HTMLDivElement>("#hud-phase")!;
const caughtEl = document.querySelector<HTMLDivElement>("#hud-caught")!;
const bonusEl = document.querySelector<HTMLDivElement>("#hud-bonus")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const overlayTitle = document.querySelector<HTMLDivElement>("#overlay-title")!;
const overlaySub = document.querySelector<HTMLDivElement>("#overlay-sub")!;
const overlayHint = document.querySelector<HTMLDivElement>("#overlay-hint")!;
const floaters = document.querySelector<HTMLDivElement>("#floaters")!;

export function setHud(
  depthM: number,
  phaseLabel: string,
  caught: number,
  bonusAccum?: number,
): void {
  depthEl.textContent = `Depth: ${depthM.toFixed(1)}m`;
  phaseEl.textContent = phaseLabel;
  caughtEl.textContent = `Caught: ${caught}`;
  if (bonusAccum !== undefined) {
    bonusEl.textContent = `Toss bonus: +${Math.round(bonusAccum)}`;
    bonusEl.classList.remove("hidden");
  } else {
    bonusEl.textContent = "";
    bonusEl.classList.add("hidden");
  }
}

export function showReadyOverlay(): void {
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "Ridiculous Hook";
  overlaySub.textContent = "Drop deep, dodge fish down. Catch them on the way up.";
  overlayHint.textContent = "Tap to drop";
}

export function hideOverlay(): void {
  overlay.classList.add("hidden");
}

export function showResultOverlay(
  totalScore: number,
  baseScore: number,
  bonusScore: number,
  caught: number,
  mult: number,
  depthM: number,
): void {
  overlay.classList.remove("hidden");
  overlayTitle.textContent = `Score: ${totalScore}`;
  overlaySub.textContent = `${caught} fish × ${mult} depth · max ${depthM.toFixed(1)}m · fish ${baseScore} + toss ${bonusScore}`;
  overlayHint.textContent = "Tap to play again";
}

export function onOverlayTap(cb: () => void): () => void {
  const handler = (e: PointerEvent): void => {
    e.preventDefault();
    cb();
  };
  overlay.addEventListener("pointerdown", handler);
  return () => overlay.removeEventListener("pointerdown", handler);
}

export function spawnFloater(clientX: number, clientY: number, text: string): void {
  const el = document.createElement("div");
  el.className = "floater";
  el.textContent = text;
  el.style.left = `${clientX}px`;
  el.style.top = `${clientY}px`;
  floaters.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}
