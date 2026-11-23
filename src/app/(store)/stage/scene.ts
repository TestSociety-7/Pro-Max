// Cinematic product stage, rendered with three.js.
//
// Honest by design: the two Pro Max units are the owner's own photos (cut out
// from their backgrounds) standing on a real-time 3D turntable. The four blade
// discs, the dicing grid and the vegetable slices around them are modelled in 3D
// after the accessories shown in the owner's photos. Nothing is presented as a
// 3D scan of the machine itself.

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Shape,
  SpotLight,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type StageColor = { key: string; src: string; aspect: number };

export type StageHandle = {
  focus(key: string): void;
  setScrollProgress(p: number): void;
  dispose(): void;
};

type Opts = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  colors: StageColor[];
  accent: string;
  onReady(): void;
};

const TAU = Math.PI * 2;

function radialTexture(inner: string, outer: string, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Blade outline for the four disc types seen in the photos. */
function bladeShape(kind: number): Shape {
  const s = new Shape();
  const r = 0.44;
  if (kind === 2) {
    // grater: a steel half-moon plate full of holes
    s.absarc(0, 0, r, Math.PI * 0.05, Math.PI * 0.95, false);
    s.lineTo(0, 0.02);
    s.closePath();
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 10));
      const rr = i % 2 ? 0.28 : 0.17;
      const h = new Path();
      h.absarc(Math.cos(a) * rr, Math.sin(a) * rr, 0.035, 0, TAU, true);
      s.holes.push(h);
    }
    return s;
  }
  // slicing / wavy / julienne blades: a crescent with a different cutting edge
  s.moveTo(-r * 0.92, 0.04);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = -r * 0.92 + (i / steps) * r * 1.84;
    let y = 0.04;
    if (kind === 1) y += Math.sin(i * 0.9) * 0.025; // wavy
    if (kind === 3) y += i % 4 < 2 ? 0.03 : 0; // julienne teeth
    s.lineTo(x, y);
  }
  s.absarc(0, 0.04, r * 0.92, 0, Math.PI, false);
  return s;
}

export async function createStage(o: Opts): Promise<StageHandle> {
  const { canvas, container } = o;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  scene.fog = new Fog(0x060505, 10, 24);

  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const lookAt = new Vector3(0, 1.75, 0);

  const accent = new Color(o.accent);

  // ---- lights ----------------------------------------------------------
  scene.add(new AmbientLight(0xffffff, 0.18));
  const key = new SpotLight(accent, 140, 30, MathUtils.degToRad(32), 0.6, 1.6);
  key.position.set(-5, 8, 4);
  key.target.position.set(0, 1, 0);
  scene.add(key, key.target);
  const rim = new DirectionalLight(0xfff1e0, 1.4);
  rim.position.set(4, 5, -6);
  scene.add(rim);
  const fill = new DirectionalLight(0x8fb4ff, 0.35);
  fill.position.set(5, 2, 6);
  scene.add(fill);

  // ---- floor + light pool ---------------------------------------------
  const floor = new Mesh(
    new CircleGeometry(16, 64),
    new MeshStandardMaterial({ color: 0x0a0908, roughness: 0.42, metalness: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const pool = new Mesh(
    new PlaneGeometry(10, 10),
    new MeshBasicMaterial({
      map: radialTexture(`rgba(${(accent.r * 255) | 0},${(accent.g * 255) | 0},${(accent.b * 255) | 0},0.55)`, "rgba(0,0,0,0)"),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.01;
  scene.add(pool);

  // ---- turntable ------------------------------------------------------
  const table = new Group();
  scene.add(table);

  const podium = new Mesh(
    new CylinderGeometry(2.55, 2.7, 0.42, 128, 1),
    new MeshPhysicalMaterial({ color: 0x141211, roughness: 0.18, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.12 }),
  );
  podium.position.y = 0.21;
  table.add(podium);

  const ring = new Mesh(new TorusGeometry(2.56, 0.018, 12, 200), new MeshBasicMaterial({ color: accent, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.42;
  table.add(ring);

  const groove = new Mesh(
    new TorusGeometry(1.9, 0.008, 8, 160),
    new MeshBasicMaterial({ color: 0x3a332d, toneMapped: false }),
  );
  groove.rotation.x = Math.PI / 2;
  groove.position.y = 0.425;
  table.add(groove);

  // ---- products (owner photos on billboards that orbit with the table) --
  const loader = new TextureLoader();
  const carousel = new Group();
  carousel.position.y = 0.42;
  scene.add(carousel);

  const shadowTex = radialTexture("rgba(0,0,0,0.75)", "rgba(0,0,0,0)");
  const products: { key: string; holder: Object3D; card: Mesh; mat: MeshBasicMaterial; shadow: Mesh }[] = [];
  const R = 1.18;
  const H = 3.05;

  const textures = await Promise.all(
    o.colors.map(
      (c) =>
        new Promise<Texture>((resolve, reject) =>
          loader.load(
            c.src,
            (t) => {
              t.colorSpace = SRGBColorSpace;
              t.anisotropy = renderer.capabilities.getMaxAnisotropy();
              resolve(t);
            },
            undefined,
            reject,
          ),
        ),
    ),
  );

  o.colors.forEach((c, i) => {
    const holder = new Object3D();
    const a = (i / o.colors.length) * TAU;
    holder.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    const mat = new MeshBasicMaterial({ map: textures[i], transparent: true, alphaTest: 0.04, toneMapped: false, side: DoubleSide });
    const card = new Mesh(new PlaneGeometry(H * c.aspect, H), mat);
    card.position.y = H / 2 - 0.02;
    holder.add(card);
    const shadow = new Mesh(
      new PlaneGeometry(H * c.aspect * 1.25, 0.7),
      new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    holder.add(shadow);
    carousel.add(holder);
    products.push({ key: c.key, holder, card, mat, shadow });
  });

  // ---- blade discs (modelled) -----------------------------------------
  const blue = new MeshPhysicalMaterial({ color: 0x1d5fb4, roughness: 0.28, metalness: 0.15, clearcoat: 0.8 });
  const steel = new MeshStandardMaterial({ color: 0xe3e6ea, roughness: 0.16, metalness: 1 });
  const darkSteel = new MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 1 });
  const discs: { g: Group; orbit: number; speed: number; tilt: number; y: number; spin: number }[] = [];
  const orbitGroup = new Group();
  scene.add(orbitGroup);
  for (let i = 0; i < 4; i++) {
    const g = new Group();
    const body = new Mesh(new CylinderGeometry(0.52, 0.52, 0.07, 72), blue);
    g.add(body);
    const hub = new Mesh(new CylinderGeometry(0.1, 0.1, 0.12, 32), darkSteel);
    g.add(hub);
    const notch = new Mesh(new CylinderGeometry(0.09, 0.09, 0.09, 32), new MeshBasicMaterial({ color: 0x0b1a2e }));
    notch.position.set(0.3, 0.005, 0.1);
    g.add(notch);
    const blade = new Mesh(new ExtrudeGeometry(bladeShape(i), { depth: 0.018, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 32 }), steel);
    blade.rotation.x = -Math.PI / 2;
    blade.position.y = 0.045;
    g.add(blade);
    g.scale.setScalar(0.62);
    orbitGroup.add(g);
    discs.push({ g, orbit: (i / 4) * TAU + 0.4, speed: 0.6 + i * 0.12, tilt: 0.9 + (i % 2) * 0.35, y: 1.3 + (i % 2) * 1.5, spin: i % 2 ? 1 : -1 });
  }

  // dicing grid
  const grid = new Group();
  const gridBase = new Mesh(new BoxGeometry(0.7, 0.12, 0.5), new MeshStandardMaterial({ color: 0x111111, roughness: 0.45, metalness: 0.2 }));
  grid.add(gridBase);
  const tooth = new BoxGeometry(0.1, 0.12, 0.08);
  const teeth = new InstancedMesh(tooth, gridBase.material as MeshStandardMaterial, 20);
  const tmp = new Object3D();
  let n = 0;
  for (let x = 0; x < 5; x++)
    for (let z = 0; z < 4; z++) {
      tmp.position.set(-0.26 + x * 0.13, 0.11, -0.17 + z * 0.115);
      tmp.updateMatrix();
      teeth.setMatrixAt(n++, tmp.matrix);
    }
  grid.add(teeth);
  grid.scale.setScalar(0.75);
  orbitGroup.add(grid);

  // ---- floating vegetable slices ---------------------------------------
  const veg: { mesh: InstancedMesh; seeds: { p: Vector3; r: Vector3; s: number; v: number }[] }[] = [];
  const vegDefs: [THREE_Geo, number, number][] = [
    [new CylinderGeometry(0.13, 0.13, 0.02, 28), 0x7cb342, 6], // cucumber
    [new BoxGeometry(0.035, 0.035, 0.32), 0xff7a1a, 6], // carrot julienne
    [new CylinderGeometry(0.11, 0.11, 0.025, 24), 0xd32f2f, 4], // tomato
  ];
  type THREE_Geo = CylinderGeometry | BoxGeometry | TorusGeometry;
  for (const [geo, color, count] of vegDefs) {
    const mesh = new InstancedMesh(geo, new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 }), count);
    const seeds = Array.from({ length: count }, () => ({
      p: new Vector3(MathUtils.randFloatSpread(12), MathUtils.randFloat(0.2, 6), MathUtils.randFloat(-8, -2.5)),
      r: new Vector3(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU),
      s: MathUtils.randFloat(0.7, 1.3),
      v: MathUtils.randFloat(0.08, 0.22),
    }));
    scene.add(mesh);
    veg.push({ mesh, seeds });
  }

  // ---- interaction state ---------------------------------------------
  let tableAngle = 0;
  let spinVel = 0.22; // rad/s idle spin
  let target: number | null = null;
  let scroll = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let dragging = false;
  let lastX = 0;

  const onDown = (e: PointerEvent) => {
    // let the colour buttons receive their own clicks
    if ((e.target as Element | null)?.closest("button, a")) return;
    dragging = true;
    lastX = e.clientX;
    target = null;
    container.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      tableAngle += dx * 0.008;
      spinVel = dx * 0.5;
    }
  };
  const onUp = () => {
    dragging = false;
  };
  container.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  // ---- sizing ---------------------------------------------------------
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep both units in frame on tall phone screens
    camera.fov = w / h < 0.8 ? 40 : 30;
    // On wide screens the headline sits on the right (RTL), so frame the stage left of centre.
    if (w / h > 1.2) camera.setViewOffset(w, h, w * 0.2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---- loop -----------------------------------------------------------
  let raf = 0;
  let running = false;
  let last = performance.now();
  let t = 0;
  const camPos = new Vector3();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    if (target !== null) {
      const d = target - tableAngle;
      tableAngle += d * Math.min(1, dt * 3.2);
      if (Math.abs(d) < 0.002) {
        target = null;
        spinVel = 0;
      }
    } else if (!dragging) {
      spinVel += (0.22 - spinVel) * Math.min(1, dt * 0.8);
      tableAngle += spinVel * dt;
    }

    table.rotation.y = tableAngle;
    carousel.rotation.y = tableAngle;

    // camera: gentle drift + pointer parallax + scroll dolly
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    const aspect = camera.aspect;
    const dist = aspect < 0.8 ? 11.5 : 12.2;
    camPos.set(
      Math.sin(t * 0.12) * 0.5 + pointer.x * 0.7,
      2.1 + scroll * 2.2 - pointer.y * 0.35,
      dist - scroll * 2.4,
    );
    camera.position.copy(camPos);
    lookAt.y = 1.75 + scroll * 0.6;
    camera.lookAt(lookAt);

    // billboards face the camera; the one in front is brighter
    for (const p of products) {
      const wp = p.holder.getWorldPosition(new Vector3());
      p.card.lookAt(camera.position.x, wp.y + H / 2, camera.position.z);
      p.card.rotateY(Math.sin(t * 0.7 + wp.x) * 0.06);
      const front = MathUtils.clamp((wp.z + R) / (2 * R), 0, 1);
      const b = 0.42 + 0.58 * front;
      p.mat.color.setRGB(b, b, b);
      p.card.scale.setScalar(0.86 + 0.14 * front);
    }

    // orbiting discs
    discs.forEach((d, i) => {
      const a = d.orbit - t * 0.18 * d.speed;
      const rr = (camera.aspect > 1.2 ? 3.3 : 3.9) + Math.sin(t * 0.4 + i) * 0.25;
      d.g.position.set(Math.sin(a) * rr, d.y + Math.sin(t * 0.9 + i * 1.7) * 0.18, Math.cos(a) * rr * 0.85);
      d.g.rotation.set(d.tilt, a, 0);
      d.g.rotateY(t * 1.6 * d.spin);
    });
    const ga = Math.PI * 1.15 - t * 0.14;
    grid.position.set(Math.sin(ga) * 3.1, 0.9 + Math.sin(t * 0.8) * 0.12, Math.cos(ga) * 2.2);
    grid.rotation.set(0.5, t * 0.6, 0.2);

    // drifting slices
    for (const v of veg) {
      v.seeds.forEach((s, i) => {
        s.p.y += s.v * dt;
        if (s.p.y > 6.5) s.p.y = -0.2;
        s.r.x += dt * 0.6;
        s.r.y += dt * 0.4;
        tmp.position.copy(s.p);
        tmp.rotation.set(s.r.x, s.r.y, s.r.z);
        tmp.scale.setScalar(s.s);
        tmp.updateMatrix();
        v.mesh.setMatrixAt(i, tmp.matrix);
      });
      v.mesh.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()), { threshold: 0.01 });
  io.observe(container);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVis);

  // first frame, then reveal
  renderer.render(scene, camera);
  start();
  requestAnimationFrame(() => o.onReady());

  return {
    focus(key) {
      const i = o.colors.findIndex((c) => c.key === key);
      if (i < 0) return;
      // product i sits at angle i/n·τ; bring it to the front (angle 0)
      const base = -(i / o.colors.length) * TAU;
      let goal = base + Math.round((tableAngle - base) / TAU) * TAU;
      if (goal - tableAngle > Math.PI) goal -= TAU;
      if (tableAngle - goal > Math.PI) goal += TAU;
      // a slight angle keeps the other colour peeking out from behind
      target = goal + 0.5;
    },
    setScrollProgress(p) {
      scroll = MathUtils.clamp(p, 0, 1);
    },
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      container.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      scene.traverse((obj) => {
        const m = obj as Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as MeshBasicMaterial | MeshBasicMaterial[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          x.map?.dispose();
          x.dispose();
        });
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
