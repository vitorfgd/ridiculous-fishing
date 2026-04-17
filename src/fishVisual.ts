import * as THREE from "three";

/** 5 readable silhouette variants: hit box matches visual footprint. */
export const FISH_TYPES = [
  { id: 0, hitHalfW: 0.48, hitHalfH: 0.22, scale: 1.0, body: "#4ecdc4", fin: "#2fa89f", accent: "#e8fffc" },
  { id: 1, hitHalfW: 0.52, hitHalfH: 0.26, scale: 1.05, body: "#ff6b9d", fin: "#d94a7a", accent: "#ffe0eb" },
  { id: 2, hitHalfW: 0.62, hitHalfH: 0.2, scale: 1.1, body: "#ffd166", fin: "#e8a830", accent: "#fff8e6" },
  { id: 3, hitHalfW: 0.42, hitHalfH: 0.3, scale: 0.92, body: "#7c9cff", fin: "#5a78d4", accent: "#e8eeff" },
  { id: 4, hitHalfW: 0.58, hitHalfH: 0.3, scale: 1.15, body: "#c792ea", fin: "#9b6bc9", accent: "#f5e8ff" },
] as const;

function makeSilhouetteShape(typeIndex: number): THREE.Shape {
  const t = FISH_TYPES[typeIndex % FISH_TYPES.length]!;
  const w = 0.55 * t.scale;
  const h = 0.28 * t.scale;
  const shape = new THREE.Shape();
  shape.moveTo(-w * 0.85, 0);
  shape.quadraticCurveTo(-w * 0.2, h * 1.1, w * 0.55, h * 0.35);
  shape.quadraticCurveTo(w * 0.75, 0, w * 0.55, -h * 0.35);
  shape.quadraticCurveTo(-w * 0.2, -h * 1.1, -w * 0.85, 0);
  shape.closePath();
  return shape;
}

export function createFishMeshGroup(typeIndex: number): THREE.Group {
  const t = FISH_TYPES[typeIndex % FISH_TYPES.length]!;
  const group = new THREE.Group();
  const shape = makeSilhouetteShape(typeIndex);
  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  extrude.rotateX(Math.PI / 2);
  const matBody = new THREE.MeshStandardMaterial({
    color: t.body,
    roughness: 0.45,
    metalness: 0.08,
    emissive: new THREE.Color(t.body).multiplyScalar(0.06),
    flatShading: true,
    fog: true,
  });
  const body = new THREE.Mesh(extrude, matBody);
  body.rotation.z = Math.PI;
  group.add(body);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.12 * t.scale, 0.08 * t.scale);
  finShape.lineTo(0.05 * t.scale, 0.14 * t.scale);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });
  finGeo.rotateX(Math.PI / 2);
  const finMat = new THREE.MeshStandardMaterial({
    color: t.fin,
    roughness: 0.5,
    flatShading: true,
    fog: true,
  });
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.position.set(-0.08 * t.scale, 0.06 * t.scale, 0.06);
  fin.name = "fin";
  group.add(fin);

  const eyeGeo = new THREE.CircleGeometry(0.045 * t.scale, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: t.accent, fog: true });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0.28 * t.scale, 0.04 * t.scale, 0.07);
  group.add(eye);

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
  const fin = group.getObjectByName("fin") as THREE.Mesh | undefined;
  if (fin) {
    fin.rotation.z = Math.sin(time * 3.2 + phase) * 0.38;
  }
}
