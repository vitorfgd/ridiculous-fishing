import * as THREE from "three";
import { CONFIG } from "./config";
import fishermanUrl from "./assets/fisherman.png";

const DEPTH_STRIPE_M = CONFIG.depthStripeIntervalM;

const SEA_BOTTOM_Y = -360;
/** Sky quad lower edge sits this far BELOW surfaceY so it fills the background behind the surface line. */
const SKY_BELOW_SURFACE = 6;

export type GameScene = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  world: THREE.Group;
  resize: () => void;
  setCameraHalfHeightScale: (scale: number) => void;
  /** Depth in world units (surfaceY - hookY), clamped. Time in seconds. `skyCheer` 0–1 brightens sky for bonus. */
  updateAtmosphere: (depthUnits: number, timeSec: number, skyCheer?: number) => void;
  dispose: () => void;
};

function makeFishermanSprite(): THREE.Sprite {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(fishermanUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const aspect = 612 / 408;
  const h = 7.2; /* world-unit height of the boat */
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(h * aspect, h, 1);
  /* Anchor bottom of sprite at surface line: center.y=0 → mid of sprite sits at Y.
     Move it up by half its height so the hull sits on the waterline. */
  sprite.center.set(0.5, 0.0); /* pivot at sprite bottom */
  return sprite;
}

function makeSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCheer: { value: 0 },
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
      uniform float uCheer;

      /* Cheap smooth noise from layered sines — no texture needed. */
      float softNoise(vec2 p) {
        float v = sin(p.x * 1.10 + p.y * 0.70) * 0.50
                + sin(p.x * 2.30 - p.y * 1.60) * 0.28
                + sin(p.x * 0.55 + p.y * 3.10) * 0.14
                + sin(p.x * 4.10 - p.y * 0.90) * 0.08;
        return v * 0.5 + 0.5; /* remap to 0..1 */
      }

      /* One fluffy cloud patch centred at (cx,cy) in UV space. */
      float cloud(vec2 uv, vec2 centre, vec2 size, float t) {
        /* Slowly drift horizontally */
        vec2 p = (uv - centre - vec2(t * 0.012, 0.0)) / size;
        /* Elliptical falloff */
        float d = dot(p, p);
        float base = smoothstep(1.0, 0.0, d);
        /* Add puffiness with noise */
        float puff = softNoise(p * 3.2 + vec2(t * 0.04, 0.0));
        return base * smoothstep(0.28, 0.68, puff);
      }

      void main() {
        float y = clamp(vUv.y, 0.0, 1.0);

        /*
         * Palette inspired by the ocean below:
         *   horizon  → warm amber/gold  (mirrors the bright teal surface glow)
         *   low      → coral/peach      (warm contrast to the cool water)
         *   mid      → sky blue         (transition zone)
         *   high     → teal-blue        (echoes the ocean's mid depth)
         *   zenith   → deep ocean blue  (mirrors the abyss below)
         */
        vec3 cHorizon = vec3(0.76, 0.88, 0.98); /* pale sky blue at waterline */
        vec3 cLow     = vec3(0.46, 0.72, 0.96); /* clear cornflower blue      */
        vec3 cMid     = vec3(0.22, 0.54, 0.88); /* solid sky blue             */
        vec3 cHigh    = vec3(0.10, 0.36, 0.76); /* rich azure                 */
        vec3 cZenith  = vec3(0.04, 0.18, 0.52); /* deep navy zenith           */

        float t1 = smoothstep(0.0,  0.22, y);
        float t2 = smoothstep(0.18, 0.48, y);
        float t3 = smoothstep(0.40, 0.72, y);
        float t4 = smoothstep(0.62, 1.00, y);

        vec3 col = mix(cHorizon, cLow,    t1);
        col      = mix(col,      cMid,    t2);
        col      = mix(col,      cHigh,   t3);
        col      = mix(col,      cZenith, t4);

        /* Subtle warm haze near horizon */
        float haze = sin(vUv.x * 18.0 + uTime * 0.14) * 0.006;
        col += vec3(haze * 0.7, haze * 0.4, haze * 0.1) * (1.0 - y);

        /* Cloud 1 — large, low, drifts right */
        float c1 = cloud(vUv, vec2(0.28, 0.22), vec2(0.22, 0.10), uTime);
        /* Cloud 2 — smaller, higher, drifts slower */
        float c2 = cloud(vUv, vec2(0.70, 0.38), vec2(0.16, 0.07), uTime * 0.7);

        /* Clouds: bright warm white, amber-tinted near horizon, cooler higher up.
           Higher opacity so they really read against the blue sky. */
        vec3 cloudCol1 = mix(vec3(1.00, 0.96, 0.86), vec3(0.96, 0.98, 1.00), smoothstep(0.1, 0.4, y));
        vec3 cloudCol2 = mix(vec3(0.98, 0.94, 0.84), vec3(0.94, 0.97, 1.00), smoothstep(0.2, 0.5, y));

        col = mix(col, cloudCol1, c1 * 0.90);
        col = mix(col, cloudCol2, c2 * 0.82);

        /* Bonus cheer: shift toward a bright warm noon sky */
        vec3 cheerCol = mix(vec3(1.0, 0.92, 0.70), vec3(0.55, 0.82, 1.0), pow(y, 0.6));
        col = mix(col, cheerCol, uCheer * 0.50);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: false,
  });
}

function makeSeaMaterial(surfaceY: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSurfaceY: { value: surfaceY },
      uStripeStep: { value: DEPTH_STRIPE_M },
      uStripeSoft: { value: 0.16 },
      uDepthNorm: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uSurfaceY;
      uniform float uStripeStep;
      uniform float uStripeSoft;
      uniform float uDepthNorm;

      /* Layered sine noise for caustics / organic shapes */
      float sineNoise(vec2 p) {
        return sin(p.x * 1.7 + p.y * 0.9 + uTime * 0.38)
             + sin(p.x * 0.8 - p.y * 2.1 + uTime * 0.22)
             + sin(p.x * 3.1 + p.y * 1.4 - uTime * 0.51);
      }

      void main() {
        float depthM = max(0.0, uSurfaceY - vWorldPos.y);
        vec3 cSurf  = vec3(0.08, 0.72, 0.62);
        vec3 cMid   = vec3(0.04, 0.42, 0.46);
        vec3 cDeep  = vec3(0.03, 0.20, 0.32);
        vec3 cAbyss = vec3(0.02, 0.06, 0.16);
        float t1 = smoothstep(0.0,  32.0,  depthM);
        float t2 = smoothstep(24.0, 105.0, depthM);
        float t3 = smoothstep(88.0, 240.0, depthM);
        vec3 col = mix(cSurf, cMid,   t1);
        col = mix(col,  cDeep,  t2);
        col = mix(col,  cAbyss, t3);

        /* --- Depth stripes (horizontal distance markers) --- */
        float m = mod(depthM, uStripeStep);
        float lineA = 1.0 - smoothstep(0.0, uStripeSoft, m);
        float lineB = smoothstep(uStripeStep - uStripeSoft, uStripeStep, m);
        float stripe = max(lineA, lineB);
        col += vec3(0.04, 0.18, 0.20) * stripe * 0.35;

        /* --- Caustic light shafts (surface only, fully gone by 30m) --- */
        float causticDepth = smoothstep(30.0, 0.0, depthM);
        vec2  cUv = vec2(vWorldPos.x * 0.28, depthM * 0.055);
        float caustic = sineNoise(cUv);
        caustic = smoothstep(1.4, 2.8, caustic);
        col += vec3(0.06, 0.18, 0.16) * caustic * causticDepth * 0.48;

        /* --- Subtle current lines (fade out by ~80m) --- */
        float current = sin(vWorldPos.x * 3.8 + depthM * 0.18 + uTime * 0.28) * 0.5 + 0.5;
        current *= sin(vWorldPos.x * 1.1 - depthM * 0.09 + uTime * 0.14) * 0.5 + 0.5;
        current = smoothstep(0.72, 0.92, current);
        float currentFade = smoothstep(0.0, 12.0, depthM) * smoothstep(80.0, 30.0, depthM);
        col += vec3(0.02, 0.10, 0.12) * current * currentFade * 0.22;

        /* --- Kelp silhouettes (30–120m, edges only) — keep subtle vs base water; reads as depth, not a green slab --- */
        float kelpFade = smoothstep(30.0, 55.0, depthM) * smoothstep(120.0, 80.0, depthM);
        float kelpX = abs(vWorldPos.x);
        float kelpEdge = smoothstep(3.2, 4.8, kelpX);
        float kelpSway = sin(vWorldPos.x * 2.2 + depthM * 0.12 + uTime * 0.55) * 0.5 + 0.5;
        /* Narrower high-density band = fewer harsh patches */
        float kelpDensity = smoothstep(0.62, 0.86, kelpSway) * kelpEdge * kelpFade;
        /* Blend toward deep teal (not olive) so it matches the water column */
        vec3 kelpTint = vec3(0.03, 0.16, 0.19);
        col = mix(col, kelpTint, kelpDensity * 0.22);

        /* --- Surface shimmer (horizontal wave highlight) --- */
        float shimmer = sin(vUv.x * 26.0 + uTime * 0.42) * 0.012;
        col += vec3(shimmer * 0.18, shimmer * 0.52, shimmer * 0.55);

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
  renderer.setClearColor("#140820", 1);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 0, CONFIG.cameraZ);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a6a9a, 0.016);

  const ambient = new THREE.AmbientLight(0xffffff, 0.82);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(4, 10, 12);
  scene.add(dir);

  const world = new THREE.Group();
  scene.add(world);

  const skyMat = makeSkyMaterial();
  const skyH = 104;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, skyH), skyMat);
  /* Bottom edge pushed SKY_BELOW_SURFACE units below surface so no gap is ever visible. */
  const skyBottomY = CONFIG.surfaceY - SKY_BELOW_SURFACE;
  sky.position.set(0, skyBottomY + skyH * 0.5, -2.2);
  world.add(sky);

  const seaMat = makeSeaMaterial(CONFIG.surfaceY);
  /* Sea mesh top sits right at surfaceY so it never covers the sky above the waterline. */
  const seaTopY = CONFIG.surfaceY + 0.3; /* tiny overlap so no hairline gap at the surface strip */
  const seaH = seaTopY - SEA_BOTTOM_Y;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(52, seaH), seaMat);
  sea.position.set(0, (seaTopY + SEA_BOTTOM_Y) * 0.5, -1.2);
  world.add(sea);

  const surfMat = makeSurfaceMaterial();
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(52, 0.55), surfMat);
  surface.position.set(0, CONFIG.surfaceY, 0.25);
  world.add(surface);

  /* Fisherman sits on the surface, slightly left of centre, in front of sky but behind HUD. */
  const fisherman = makeFishermanSprite();
  fisherman.position.set(-4.8, CONFIG.surfaceY - 1.2, 0.3);
  world.add(fisherman);

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

  const updateAtmosphere = (
    depthUnits: number,
    timeSec: number,
    skyCheer = 0,
  ): void => {
    const d = THREE.MathUtils.clamp(depthUnits / 95, 0, 1);
    const cheer = THREE.MathUtils.clamp(skyCheer, 0, 1);
    const fog = scene.fog as THREE.FogExp2;
    if (fog) {
      fog.density = 0.011 + d * 0.032 - cheer * 0.004;
      fog.color.copy(fogNearCol).lerp(fogDeepCol, d * 0.78);
      if (cheer > 0.01) {
        fog.color.lerp(new THREE.Color(0xa8dcff), cheer * 0.2);
      }
    }
    skyMat.uniforms.uTime.value = timeSec;
    skyMat.uniforms.uCheer.value = cheer;
    seaMat.uniforms.uTime.value = timeSec;
    seaMat.uniforms.uDepthNorm.value = d;
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
    (fisherman.material as THREE.SpriteMaterial).map?.dispose();
    (fisherman.material as THREE.SpriteMaterial).dispose();
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
