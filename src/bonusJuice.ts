import * as THREE from "three";
import { CONFIG } from "./config";

type BurstP = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  g: number;
};

const MAX_PARTICLES = 64;

function randCoolColor(): THREE.Color {
  const c = new THREE.Color();
  c.setHSL(0.52 + Math.random() * 0.08, 0.45 + Math.random() * 0.25, 0.55 + Math.random() * 0.2);
  return c;
}

function randWarmColor(): THREE.Color {
  const c = new THREE.Color();
  c.setHSL(0.08 + Math.random() * 0.1, 0.85, 0.55 + Math.random() * 0.2);
  return c;
}

export function createBonusJuice(world: THREE.Object3D): {
  spawnLaunchBurst: (x: number, y: number) => void;
  spawnTapBurst: (x: number, y: number, streak: number) => void;
  update: (dt: number) => void;
  clear: () => void;
} {
  const pool: BurstP[] = [];

  function spawnLaunchBurst(x: number, y: number): void {
    const n = CONFIG.bonusLaunchParticleCount;
    for (let i = 0; i < n; i++) {
      if (pool.length >= MAX_PARTICLES) return;
      const col = randCoolColor();
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const s = 0.04 + Math.random() * 0.06;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), mat);
      const ang = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 1.8 + Math.random() * 2.2;
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.25,
        y + Math.random() * 0.12,
        0.36 + Math.random() * 0.08,
      );
      world.add(mesh);
      pool.push({
        mesh,
        vx: Math.cos(ang) * sp * 0.55 + (Math.random() - 0.5) * 0.8,
        vy: 2.2 + Math.random() * 3.8 + Math.sin(ang) * 0.6,
        vz: (Math.random() - 0.5) * 0.35,
        t: 0.32 + Math.random() * 0.14,
        g: 11 + Math.random() * 6,
      });
    }
  }

  function spawnTapBurst(x: number, y: number, streak: number): void {
    const extra = Math.min(5, Math.floor(streak));
    const n = Math.min(18, CONFIG.bonusTapParticleCount + extra);
    for (let i = 0; i < n; i++) {
      if (pool.length >= MAX_PARTICLES) return;
      const warm = Math.random() > 0.35;
      const col = warm ? randWarmColor() : new THREE.Color("#ffffff");
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const s = 0.045 + Math.random() * 0.09 + streak * 0.004;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), mat);
      const ang = Math.random() * Math.PI * 2;
      const sp = 3.2 + Math.random() * 4.5 + streak * 0.35;
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.12,
        y + (Math.random() - 0.5) * 0.12,
        0.48 + Math.random() * 0.12,
      );
      world.add(mesh);
      pool.push({
        mesh,
        vx: Math.cos(ang) * sp * 0.55,
        vy: Math.sin(ang) * sp * 0.55,
        vz: 0.35 + Math.random() * 1.1,
        t: 0.22 + Math.random() * 0.12,
        g: 8 + Math.random() * 5,
      });
    }
  }

  function update(dt: number): void {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i]!;
      p.t -= dt;
      p.vy -= p.g * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.multiplyScalar(1 + 1.8 * dt);
      const m = p.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, p.t * 3.2);
      if (p.t <= 0) {
        world.remove(p.mesh);
        p.mesh.geometry.dispose();
        m.dispose();
        pool.splice(i, 1);
      }
    }
  }

  function clear(): void {
    for (const p of pool) {
      world.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.MeshBasicMaterial).dispose();
    }
    pool.length = 0;
  }

  return { spawnLaunchBurst, spawnTapBurst, update, clear };
}
