import * as THREE from "three";
import { CONFIG } from "./config";

const SEA_BOTTOM_Y = -360;
const SEA_TOP_PAD = 28;

export type GameScene = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  world: THREE.Group;
  resize: () => void;
  setCameraHalfHeightScale: (scale: number) => void;
  /** Depth in world units (surfaceY - hookY), clamped. Time in seconds. */
  updateAtmosphere: (depthUnits: number, timeSec: number) => void;
  dispose: () => void;
};

function makeSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color("#3d7dcf") },
      uHorizon: { value: new THREE.Color("#87c4ff") },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      void main() {
        float y = vUv.y;
        vec3 col = mix(uHorizon, uTop, pow(y, 1.15));
        float x = vUv.x * 9.0 + uTime * 0.012;
        float c1 = sin(x) * sin(vUv.y * 5.0 + 0.8);
        float cloud = smoothstep(0.25, 0.7, 0.45 + 0.22 * c1);
        cloud *= smoothstep(0.15, 0.75, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
        col = mix(col, vec3(0.96, 0.98, 1.0), cloud * 0.14);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: false,
  });
}

function makeSeaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float t = vUv.y;
        vec3 shallow = vec3(0.32, 0.72, 0.94);
        vec3 mid = vec3(0.1, 0.48, 0.78);
        vec3 deep = vec3(0.03, 0.22, 0.36);
        vec3 teal = vec3(0.04, 0.32, 0.36);
        vec3 col = mix(deep, mid, smoothstep(0.0, 0.5, t));
        col = mix(col, shallow, smoothstep(0.38, 1.0, t));
        col = mix(col, teal, smoothstep(0.0, 0.45, 1.0 - t) * 0.4);
        float w = sin(vUv.x * 28.0 + uTime * 0.45) * 0.018;
        col += vec3(w * 0.3, w * 0.45, w * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: true,
  });
}

function makeSurfaceMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.06 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uAmp;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(uTime * 2.2 + position.x * 3.5) * uAmp * 0.5;
        p.y += sin(uTime * 1.7 + position.x * 6.2) * uAmp * 0.25;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float a = 0.55 + 0.45 * abs(vUv.x - 0.5) * 2.0;
        vec3 col = mix(vec3(0.65, 0.92, 1.0), vec3(0.9, 0.98, 1.0), a);
        gl_FragColor = vec4(col, 0.92);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

export function createGameScene(canvas: HTMLCanvasElement): GameScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor("#051428", 1);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 0, CONFIG.cameraZ);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a4a68, 0.022);

  const ambient = new THREE.AmbientLight(0xffffff, 0.82);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(4, 10, 12);
  scene.add(dir);

  const world = new THREE.Group();
  scene.add(world);

  const skyMat = makeSkyMaterial();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(52, 56), skyMat);
  sky.position.set(0, CONFIG.surfaceY + SEA_TOP_PAD + 2, -2.2);
  world.add(sky);

  const seaMat = makeSeaMaterial();
  const seaH = CONFIG.surfaceY - SEA_BOTTOM_Y + 40;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(52, seaH), seaMat);
  sea.position.set(0, (CONFIG.surfaceY + SEA_BOTTOM_Y) / 2 - 8, -1.2);
  world.add(sea);

  const surfMat = makeSurfaceMaterial();
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(52, 0.55), surfMat);
  surface.position.set(0, CONFIG.surfaceY, 0.25);
  world.add(surface);

  let cameraHalfHeightScale = 1;

  const resize = (): void => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / Math.max(h, 1);
    const halfH = CONFIG.cameraHalfHeight * cameraHalfHeightScale;
    const halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  const setCameraHalfHeightScale = (scale: number): void => {
    cameraHalfHeightScale = Math.max(0.5, Math.min(scale, 2));
    resize();
  };

  const fogNearCol = new THREE.Color(0x6ab8e8);
  const fogDeepCol = new THREE.Color(0x042a38);

  const updateAtmosphere = (depthUnits: number, timeSec: number): void => {
    const d = THREE.MathUtils.clamp(depthUnits / 80, 0, 1);
    const fog = scene.fog as THREE.FogExp2;
    if (fog) {
      fog.density = 0.014 + d * 0.038;
      fog.color.copy(fogNearCol).lerp(fogDeepCol, d * 0.85);
    }
    skyMat.uniforms.uTime.value = timeSec;
    seaMat.uniforms.uTime.value = timeSec;
    surfMat.uniforms.uTime.value = timeSec;
  };

  resize();
  window.addEventListener("resize", resize);

  const dispose = (): void => {
    window.removeEventListener("resize", resize);
    skyMat.dispose();
    seaMat.dispose();
    surfMat.dispose();
    sky.geometry.dispose();
    sea.geometry.dispose();
    surface.geometry.dispose();
    renderer.dispose();
  };

  return {
    scene,
    camera,
    renderer,
    world,
    resize,
    setCameraHalfHeightScale,
    updateAtmosphere,
    dispose,
  };
}
