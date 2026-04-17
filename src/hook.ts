import * as THREE from "three";
import { CONFIG } from "./config";

export class HookRig {
  readonly group: THREE.Group;
  readonly hookMesh: THREE.Mesh;
  /** Fish caught on ascent — stacked under hook, swing animation. */
  readonly caughtGroup: THREE.Group;
  /** 0–1 decay for attach bounce scale. */
  catchBounce = 0;
  private readonly lineGeom: THREE.BufferGeometry;
  private readonly lineMat: THREE.LineBasicMaterial;
  private readonly line: THREE.Line;
  private readonly trailGeom: THREE.BufferGeometry;
  private readonly trailMat: THREE.LineBasicMaterial;
  private readonly trailLine: THREE.Line;
  private trailPositions: Float32Array;
  private trailCount = 0;

  constructor(parent: THREE.Object3D) {
    this.group = new THREE.Group();
    parent.add(this.group);

    const hookGeo = new THREE.SphereGeometry(CONFIG.hookRadius, 14, 14);
    const hookMat = new THREE.MeshStandardMaterial({
      color: "#d0d8e8",
      metalness: 0.55,
      roughness: 0.25,
      emissive: "#223344",
      emissiveIntensity: 0.25,
    });
    this.hookMesh = new THREE.Mesh(hookGeo, hookMat);
    this.group.add(this.hookMesh);

    this.caughtGroup = new THREE.Group();
    this.caughtGroup.position.set(0, 0, 0.02);
    this.hookMesh.add(this.caughtGroup);

    this.lineGeom = new THREE.BufferGeometry();
    const linePos = new Float32Array(6);
    this.lineGeom.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    this.lineMat = new THREE.LineBasicMaterial({ color: "#f2f6ff", linewidth: 1 });
    this.line = new THREE.Line(this.lineGeom, this.lineMat);
    this.line.frustumCulled = false;
    this.group.add(this.line);

    this.trailPositions = new Float32Array(CONFIG.trailMaxPoints * 3);
    this.trailGeom = new THREE.BufferGeometry();
    this.trailGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.trailMat = new THREE.LineBasicMaterial({
      color: "#9ecbff",
      transparent: true,
      opacity: 0.55,
    });
    this.trailLine = new THREE.Line(this.trailGeom, this.trailMat);
    this.trailLine.frustumCulled = false;
    this.group.add(this.trailLine);
  }

  reset(surfaceY: number): void {
    const disposeMat = (m: THREE.Material): void => {
      if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.MeshStandardMaterial) {
        m.map = null;
      }
      m.dispose();
    };
    while (this.caughtGroup.children.length > 0) {
      const c = this.caughtGroup.children[0]!;
      c.traverse((ch) => {
        if (ch instanceof THREE.Mesh) {
          ch.geometry.dispose();
          const m = ch.material;
          if (Array.isArray(m)) m.forEach(disposeMat);
          else disposeMat(m);
        }
      });
      this.caughtGroup.remove(c);
    }
    this.catchBounce = 0;
    this.caughtGroup.scale.setScalar(1);
    this.caughtGroup.rotation.z = 0;
    this.hookMesh.position.set(0, surfaceY - 0.6, 0);
    this.trailCount = 0;
    this.trailPositions.fill(0);
    this.trailGeom.setDrawRange(0, 0);
    this.updateLine(surfaceY + 1.4, 0);
  }

  get x(): number {
    return this.hookMesh.position.x;
  }

  get y(): number {
    return this.hookMesh.position.y;
  }

  set x(v: number) {
    this.hookMesh.position.x = v;
  }

  set y(v: number) {
    this.hookMesh.position.y = v;
  }

  private pushTrail(px: number, py: number): void {
    const arr = this.trailPositions;
    const max = CONFIG.trailMaxPoints;
    if (this.trailCount < max) {
      const i = this.trailCount * 3;
      arr[i] = px;
      arr[i + 1] = py;
      arr[i + 2] = 0;
      this.trailCount += 1;
    } else {
      for (let i = 0; i < (max - 1) * 3; i++) arr[i] = arr[i + 3]!;
      const i = (max - 1) * 3;
      arr[i] = px;
      arr[i + 1] = py;
      arr[i + 2] = 0;
    }
    const posAttr = this.trailGeom.getAttribute("position") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.trailGeom.setDrawRange(0, this.trailCount >= 2 ? this.trailCount : 0);
  }

  updateLine(rodTipX: number, rodTipY: number): void {
    const pos = this.lineGeom.getAttribute("position") as THREE.BufferAttribute;
    const hx = this.hookMesh.position.x;
    const hy = this.hookMesh.position.y;
    pos.setXYZ(0, rodTipX, rodTipY, 0);
    pos.setXYZ(1, hx, hy, 0);
    pos.needsUpdate = true;
  }

  update(
    dt: number,
    targetX: number,
    time: number,
    surfaceRodBaseY: number,
    isDescending: boolean,
  ): void {
    const hx = THREE.MathUtils.lerp(
      this.hookMesh.position.x,
      targetX,
      1 - Math.exp(-CONFIG.hookHorizontalLerp * dt),
    );
    const clamped = THREE.MathUtils.clamp(hx, CONFIG.hookMinX, CONFIG.hookMaxX);
    this.hookMesh.position.x = clamped;

    const bob = isDescending
      ? Math.sin(time * CONFIG.bobFrequency) * CONFIG.bobAmplitude
      : Math.sin(time * (CONFIG.bobFrequency * 0.6)) * (CONFIG.bobAmplitude * 0.4);
    const rodY = surfaceRodBaseY + bob;
    const rodX = clamped * 0.15;
    this.updateLine(rodX, rodY);

    if (this.catchBounce > 0) {
      this.catchBounce = Math.max(0, this.catchBounce - dt * 3.2);
      const punch = this.catchBounce * 0.14;
      this.caughtGroup.scale.setScalar(1 + punch);
    } else {
      this.caughtGroup.scale.setScalar(1);
    }
    const swing =
      Math.sin(time * 2.65) * 0.12 + Math.sin(time * 1.55 + 0.7) * 0.07;
    this.caughtGroup.rotation.z = swing;

    this.pushTrail(this.hookMesh.position.x, this.hookMesh.position.y);
  }

  triggerCatchBounce(): void {
    this.catchBounce = 1;
  }

  dispose(): void {
    this.lineGeom.dispose();
    this.lineMat.dispose();
    this.trailGeom.dispose();
    this.trailMat.dispose();
    this.hookMesh.geometry.dispose();
    (this.hookMesh.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}
