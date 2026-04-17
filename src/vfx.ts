import * as THREE from "three";
import { CONFIG } from "./config";

const BUBBLE_N = 36;

export type BubbleVfx = {
  group: THREE.Group;
  update: (dt: number, time: number) => void;
  dispose: () => void;
};

export function createBubbleVfx(world: THREE.Object3D): BubbleVfx {
  const group = new THREE.Group();
  group.name = "bubbles";
  world.add(group);

  const geo = new THREE.SphereGeometry(0.06, 6, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: "#b8e8ff",
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  type B = { mesh: THREE.Mesh; speed: number; phase: number };
  const pool: B[] = [];

  for (let i = 0; i < BUBBLE_N; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const phase = Math.random() * Math.PI * 2;
    const b: B = { mesh, speed: 0.5, phase };
    resetBubble(b, i);
    group.add(mesh);
    pool.push(b);
  }

  function resetBubble(b: B, seed: number): void {
    const x = THREE.MathUtils.randFloat(CONFIG.hookMinX - 0.5, CONFIG.hookMaxX + 0.5);
    const depth = THREE.MathUtils.randFloat(4, 55);
    b.mesh.position.set(
      x + Math.sin(seed * 1.7) * 0.3,
      CONFIG.surfaceY - depth,
      0.25 + Math.random() * 0.15,
    );
    b.speed = 0.4 + Math.random() * 0.6;
    b.mesh.scale.setScalar(0.35 + Math.random() * 0.65);
  }

  function update(dt: number, time: number): void {
    const top = CONFIG.surfaceY - 0.35;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i]!;
      b.mesh.position.y += b.speed * dt;
      b.mesh.position.x += Math.sin(time * 1.5 + b.phase) * 0.012 * dt;
      if (b.mesh.position.y > top) {
        resetBubble(b, i + time);
      }
    }
  }

  function dispose(): void {
    world.remove(group);
    geo.dispose();
    mat.dispose();
  }

  return { group, update, dispose };
}
