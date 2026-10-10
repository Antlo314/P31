// Three.js accent scenes, loaded on demand by <Scene3D> (never in the main bundle).
//   gem     — a faceted amethyst with a gold halo and gold dust ("her price is far above rubies")
//   arches  — gold arches receding into depth; scrolling walks you through them
//   engine  — a gold core with orbiting rings and nodes (P31 Systems)
// Every scene: transparent background, capped pixel ratio, pauses when off-screen,
// follows the pointer gently, reacts to scroll, and frees all GPU memory on dispose.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, BufferGeometry, Float32BufferAttribute,
  LatheGeometry, TorusGeometry, IcosahedronGeometry, SphereGeometry, ExtrudeGeometry, Shape, Path, Vector2,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, PointsMaterial, CanvasTexture, Color, Fog,
  DirectionalLight, PointLight, AmbientLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, AdditiveBlending,
  MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const GOLD = 0xe9be3a;
const GOLD_SOFT = 0xf2ce4d;
const PLUM = 0x5e2a8c;

// A soft round sprite for particles.
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,236,170,0.75)');
  grad.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Gold dust: points scattered in a shell, slowly turning.
function dust(count, inner, outer, size, texture, color = GOLD_SOFT) {
  const pos = [];
  for (let i = 0; i < count; i += 1) {
    const r = inner + Math.random() * (outer - inner);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.8, r * Math.sin(ph) * Math.sin(th));
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const mat = new PointsMaterial({
    size, map: texture, color, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true, opacity: 0.9,
  });
  return new Points(geo, mat);
}

const gold = (rough = 0.22) => new MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: rough, envMapIntensity: 1.25 });

// A rounded-top arch outline (the brand's arch), as a flat shape with a hole.
function archShape(w, h, t) {
  const outer = new Shape();
  outer.moveTo(-w, 0);
  outer.lineTo(-w, h);
  outer.absarc(0, h, w, Math.PI, 0, true);
  outer.lineTo(w, 0);
  outer.lineTo(-w, 0);
  const iw = w - t;
  const hole = new Path();
  hole.moveTo(-iw, t);
  hole.lineTo(-iw, h);
  hole.absarc(0, h, iw, Math.PI, 0, true);
  hole.lineTo(iw, t);
  hole.lineTo(-iw, t);
  outer.holes.push(hole);
  return outer;
}

const BUILDERS = {
  gem({ scene, camera, tex }) {
    camera.position.set(0, 0.15, 7.1);
    const root = new Group();
    scene.add(root);

    // Brilliant-style cut: table, crown, girdle, pavilion — flat-shaded facets.
    const profile = [[0, -1.25], [1.02, 0.02], [1.04, 0.14], [0.6, 0.58], [0, 0.6]].map(([x, y]) => new Vector2(x, y));
    const gemGeo = new LatheGeometry(profile, 10);
    const gemMat = new MeshPhysicalMaterial({
      color: new Color('#8f3fe0'), metalness: 0.05, roughness: 0.04, transmission: 0.5, thickness: 1.8, ior: 2.2,
      dispersion: 5, iridescence: 0.5, iridescenceIOR: 1.7, clearcoat: 1, clearcoatRoughness: 0.04,
      attenuationColor: new Color('#4a1278'), attenuationDistance: 0.7, specularIntensity: 1, envMapIntensity: 2.6, flatShading: true,
      emissive: new Color('#3a0f63'), emissiveIntensity: 0.55, sheen: 0.4, sheenColor: new Color('#e3b6ff'),
    });
    const gem = new Mesh(gemGeo, gemMat);
    gem.scale.setScalar(1.15);
    gem.rotation.x = 0.18;
    root.add(gem);

    // Gold halo rings.
    const halo = new Mesh(new TorusGeometry(1.95, 0.026, 16, 160), gold(0.18));
    halo.rotation.x = Math.PI / 2.35;
    root.add(halo);
    const halo2 = new Mesh(new TorusGeometry(2.35, 0.012, 12, 160), gold(0.3));
    halo2.rotation.set(Math.PI / 1.8, 0.4, 0);
    root.add(halo2);

    const sparkle = dust(520, 1.6, 3.6, 0.05, tex);
    root.add(sparkle);

    return (t, { px, py, scroll }) => {
      gem.rotation.y = t * 0.35 + scroll * 2.2;
      gem.position.y = Math.sin(t * 0.9) * 0.08;
      halo.rotation.z = t * 0.25;
      halo2.rotation.z = -t * 0.18;
      sparkle.rotation.y = t * 0.04;
      root.rotation.x = MathUtils.lerp(root.rotation.x, py * 0.25, 0.05);
      root.rotation.y = MathUtils.lerp(root.rotation.y, px * 0.35, 0.05);
    };
  },

  arches({ scene, camera, tex }) {
    camera.position.set(0, 1.2, 8.2);
    scene.fog = new Fog(new Color('#12081d'), 6, 16);
    const root = new Group();
    scene.add(root);
    const geo = new ExtrudeGeometry(archShape(2.5, 2.4, 0.07), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 48 });
    geo.center();
    const mat = gold(0.26);
    mat.envMapIntensity = 0.95;
    const arches = [];
    for (let i = 0; i < 6; i += 1) {
      const a = new Mesh(geo, mat);
      a.position.set(0, 0.2, -i * 2.1);
      a.scale.setScalar(1 + i * 0.05);
      root.add(a);
      arches.push(a);
    }
    // A faint inner glow plane in the nearest arch.
    const glow = new Mesh(new SphereGeometry(1.2, 24, 24), new MeshBasicMaterial({ color: 0x8a4fd0, transparent: true, opacity: 0.08 }));
    glow.position.set(0, 0.6, -3);
    root.add(glow);
    const motes = dust(700, 0.5, 6, 0.06, tex);
    motes.position.z = -4;
    root.add(motes);

    return (t, { px, py, scroll }) => {
      // Scrolling the hero walks the camera forward through the doors.
      camera.position.z = 8.2 - scroll * 6;
      camera.position.x = MathUtils.lerp(camera.position.x, px * 0.6, 0.04);
      camera.position.y = MathUtils.lerp(camera.position.y, 0.9 + py * 0.35, 0.04);
      camera.lookAt(0, 0.6, -6);
      arches.forEach((a, i) => { a.rotation.z = Math.sin(t * 0.3 + i) * 0.015; });
      motes.rotation.y = t * 0.03;
      motes.position.y = Math.sin(t * 0.2) * 0.2;
    };
  },

  engine({ scene, camera, tex }) {
    camera.position.set(0, 0.2, 9.4);
    const root = new Group();
    scene.add(root);
    const core = new Mesh(new IcosahedronGeometry(0.95, 1), new MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.18, clearcoat: 0.6, envMapIntensity: 1.4, flatShading: true }));
    root.add(core);
    const shell = new Mesh(new IcosahedronGeometry(1.25, 1), new MeshBasicMaterial({ color: 0xb388ff, wireframe: true, transparent: true, opacity: 0.28 }));
    root.add(shell);

    const orbits = [];
    const nodeMat = new MeshStandardMaterial({ color: 0xffffff, emissive: new Color(GOLD_SOFT), emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.3 });
    [[2.0, 0.35, 0.0, 0.42], [2.55, -0.55, 0.9, -0.3], [3.05, 1.2, -0.5, 0.22]].forEach(([r, rx, rz, speed], i) => {
      const g = new Group();
      g.rotation.set(rx, 0, rz);
      g.add(new Mesh(new TorusGeometry(r, 0.012, 10, 200), gold(0.3)));
      const nodes = [];
      for (let k = 0; k < 3 + i; k += 1) {
        const n = new Mesh(new SphereGeometry(0.075 + (k % 2) * 0.03, 20, 20), nodeMat);
        n.userData.a = (k / (3 + i)) * Math.PI * 2;
        g.add(n);
        nodes.push(n);
      }
      root.add(g);
      orbits.push({ g, nodes, r, speed });
    });
    const sparkle = dust(420, 2.2, 4.4, 0.045, tex);
    root.add(sparkle);

    return (t, { px, py, scroll }) => {
      core.rotation.y = t * 0.3;
      core.rotation.x = t * 0.12;
      shell.rotation.y = -t * 0.18;
      orbits.forEach(({ nodes, r, speed }) => nodes.forEach((n) => {
        const a = n.userData.a + t * speed;
        n.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      }));
      sparkle.rotation.y = t * 0.05;
      root.rotation.y = MathUtils.lerp(root.rotation.y, px * 0.45 + scroll * 0.8, 0.05);
      root.rotation.x = MathUtils.lerp(root.rotation.x, py * 0.25, 0.05);
    };
  },
};

/** Mounts a scene into `host` (a positioned element). Returns { start, stop, dispose }. */
export function createScene(host, variant, { still = false } = {}) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 's3d__canvas';
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.add(new AmbientLight(0xffffff, 0.25));
  const key = new DirectionalLight(0xfff1d6, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new PointLight(0xb57cff, 18, 20);
  rim.position.set(-3.5, 1.5, -2);
  scene.add(rim);
  const warm = new PointLight(PLUM, 10, 18);
  warm.position.set(3, -2, 2);
  scene.add(warm);

  const camera = new PerspectiveCamera(38, 1, 0.1, 60);
  const tex = dotTexture();
  const update = (BUILDERS[variant] || BUILDERS.gem)({ scene, camera, tex });

  const state = { px: 0, py: 0, scroll: 0 };
  const target = { px: 0, py: 0 };
  const onPointer = (e) => {
    target.px = (e.clientX / window.innerWidth) * 2 - 1;
    target.py = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const t0 = performance.now();
  let raf = 0;
  let running = false;
  const frame = () => {
    const r = host.getBoundingClientRect();
    // 0 when the element's top is at the bottom of the screen, 1 when its bottom leaves the top.
    state.scroll = MathUtils.clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
    state.px += (target.px - state.px) * 0.06;
    state.py += (target.py - state.py) * 0.06;
    update((performance.now() - t0) / 1000, state);
    renderer.render(scene, camera);
  };
  const loop = () => { frame(); raf = requestAnimationFrame(loop); };

  const api = {
    start() { if (running || still) return; running = true; raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() {
      api.stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        [o.material].flat().filter(Boolean).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      });
      tex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
  frame(); // first frame right away (and the only one for reduced motion)
  return api;
}
