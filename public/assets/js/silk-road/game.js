// Silk Road 2077: fly a camel spaceship through the cities of my story.
// Three lanes, Java beans to collect, bugs to dodge, and a station card in every city.

import * as THREE from '../../vendor/three.min.js';
import {
  createCamelShip, createCity, createGate, createCupGeometry, createBugGeometry, createShieldGeometry, createShieldBubble,
  makeGlowTexture, cssColor,
} from './models.js';
import { STATIONS, BUG_MESSAGES, BEAN_MESSAGES, rankFor } from './stations.js';
import { sfx } from '../sfx.js';

const LANES = [-3, 0, 3];
const SEG_LEN = [360, 470, 470, 470, 470, 500];
const BASE_SPEED = 38;
const SPAWN_Z = -230;
const ROW_GAP = 17;
const GATE_CLEAR = 40;
const STOP_AHEAD = 52; // the station card opens with the city gate this far ahead
const GATE_AT = SEG_LEN.reduce((acc, len) => [...acc, (acc[acc.length - 1] || 0) + len], []);
const JOURNEY = GATE_AT[GATE_AT.length - 1] - STOP_AHEAD; // distance flown when the last card opens
const MAX_ITEMS = 72;
const PYLON_GAP = 12;
const PYLON_ROWS = 22;

export function createGame({ root, webgl = true, reduceMotion = false, unlock = () => {}, onOpen, onClose }) {
  const $ = (id) => root.querySelector(id);
  const els = {
    stage: $('#game-stage'), route: $('#game-route'), beans: $('#g-beans'), bugs: $('#g-bugs'),
    sound: $('#g-sound'), pause: $('#g-pause'), skip: $('#g-skip'), exit: $('#g-exit'),
    intro: $('#g-intro'), start: $('#g-start'), textBtn: $('#g-text-btn'),
    station: $('#g-station'), end: $('#g-end'), text: $('#g-text'),
    flash: $('#g-flash'), pop: $('#g-pop'), touch: $('#game-touch'), progress: $('#g-progress'),
  };
  root.tabIndex = -1;

  // Journey progress: a dot for each city along a thin line under the HUD, and a camel flying along it.
  const ticks = STATIONS.map((st, i) => {
    const b = document.createElement('b');
    b.style.left = `${((GATE_AT[i] - STOP_AHEAD) / JOURNEY) * 100}%`;
    return b;
  });
  els.progress.append(...ticks);

  const S = {
    mode: 'idle', visited: 0, world: 0, distSinceRow: 0, speed: BASE_SPEED, camBlend: 0, introT: 0, snapLens: false,
    lane: 1, shipX: 0, beans: 0, bugs: 0, flightTime: 0, slowTimer: 0, shake: 0, lastRowBugs: 0,
    shield: false, streak: 0,
  };
  let lastFocus = null;
  let gl = null; // three.js state, created on first launch

  /* ================================================================== */
  /* three.js world                                                      */
  /* ================================================================== */
  function setupThree() {
    const lowPower = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { alpha: false, antialias: !lowPower, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!context) throw new Error('WebGL 2 is not available'); // showIntro falls back to text mode
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: !lowPower });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    els.stage.append(renderer.domElement);

    const scene = new THREE.Scene();
    const fogColor = new THREE.Color(0.40, 0.09, 0.33);
    scene.fog = new THREE.Fog(fogColor, 60, 232);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

    scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x401040, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(5, 10, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff4fd2, 1.2);
    rim.position.set(-6, 3, -10);
    scene.add(rim);

    const glowTex = makeGlowTexture();

    // Sky dome. Its horizon takes on the color of the city ahead (see updateTint).
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uHorizon: { value: new THREE.Color(0.62, 0.14, 0.42) }, uMid: { value: new THREE.Color(0.16, 0.04, 0.24) } },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uHorizon; uniform vec3 uMid;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 horizon = uHorizon;
          vec3 mid = uMid;
          vec3 zenith = vec3(0.01, 0.015, 0.05);
          vec3 col = mix(horizon, mid, smoothstep(-0.01, 0.10, h));
          col = mix(col, zenith, smoothstep(0.10, 0.55, h));
          col = mix(col, vec3(0.03, 0.01, 0.05), smoothstep(0.0, -0.15, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
    sky.renderOrder = -2;
    scene.add(sky);

    // Sky stars
    const starN = lowPower ? 500 : 1100;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.08;
      v.normalize().multiplyScalar(600);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const skyStars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false,
    }));
    skyStars.renderOrder = -1;
    scene.add(skyStars);

    // Synthwave sun with a soft glow
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(80, 64),
      new THREE.ShaderMaterial({
        fog: false, transparent: true, depthWrite: false,
        vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vec3 col = mix(vec3(1.0, 0.22, 0.58), vec3(1.0, 0.86, 0.38), smoothstep(0.1, 0.95, vUv.y));
            if (vUv.y < 0.56) {
              float s = fract(vUv.y * 15.0);
              float gap = mix(0.5, 0.06, vUv.y / 0.56);
              if (s < gap) discard;
            }
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    sun.position.set(0, 30, -640);
    sun.renderOrder = -1;
    scene.add(sun);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff5aa8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunGlow.scale.setScalar(420);
    sunGlow.position.set(0, 30, -650);
    sunGlow.renderOrder = -1;
    scene.add(sunGlow);

    // Mountains on both sides of the valley
    const mountains = new THREE.Group();
    const mountainMat = new THREE.MeshBasicMaterial({ color: 0x12041c, fog: false });
    const ridgeMat = new THREE.LineBasicMaterial({ color: 0xff4fd2, transparent: true, opacity: 0.7, fog: false });
    for (const side of [-1, 1]) {
      for (const [z, scale] of [[-560, 1], [-600, 1.5]]) {
        const pts = [new THREE.Vector2(side * 40, 0)];
        let x = 40;
        while (x < 700) {
          x += 18 + Math.random() * 30;
          const h = (14 + Math.random() * 40) * scale * Math.min(1, (x - 30) / 120);
          pts.push(new THREE.Vector2(side * x, h));
        }
        pts.push(new THREE.Vector2(side * 720, 0));
        const shape = new THREE.Shape(pts);
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mountainMat);
        mesh.position.z = z;
        mesh.renderOrder = -1;
        const ridge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0))), ridgeMat);
        ridge.position.z = z + 0.5;
        mountains.add(mesh, ridge);
      }
    }
    scene.add(mountains);

    // Neon ground and the road
    const groundMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uOffset: { value: 0 }, uFog: { value: fogColor }, uGrid: { value: new THREE.Color(0.95, 0.22, 0.8) } },
      vertexShader: /* glsl */`
        varying vec3 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float uOffset; uniform vec3 uFog; uniform vec3 uGrid;
        varying vec3 vW;
        void main() {
          vec2 coord = vec2(vW.x / 5.0, (vW.z - uOffset) / 5.0);
          vec2 g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
          float grid = 1.0 - min(min(g.x, g.y), 1.0);
          float ax = abs(vW.x);
          float road = 1.0 - smoothstep(4.6, 4.8, ax);
          float aw = fwidth(ax);
          float edge = 1.0 - smoothstep(0.0, aw * 2.0 + 0.05, abs(ax - 4.75));
          float dash = step(0.45, fract((vW.z - uOffset) / 7.0));
          float lane = (1.0 - smoothstep(0.0, aw * 1.5 + 0.035, abs(ax - 1.5))) * dash;
          float dist = -vW.z;
          float fade = 1.0 - smoothstep(25.0, 228.0, dist);
          vec3 col = mix(vec3(0.02, 0.008, 0.045), vec3(0.06, 0.02, 0.10), road);
          col += uGrid * grid * 0.55 * (1.0 - road * 0.7);
          col += vec3(1.0, 0.74, 0.32) * edge * 1.3;
          col += vec3(0.24, 0.9, 1.0) * lane * 0.85;
          col = mix(uFog, col, fade);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 760), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -360;
    scene.add(ground);

    // Pylons along the road edges
    const pylonPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.13, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x2b2f4a, metalness: 0.6, roughness: 0.4 }), PYLON_ROWS * 2);
    const pylonTops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), PYLON_ROWS * 2);
    const pylonZ = [];
    const gold = new THREE.Color(0xffbe55);
    const cyan = new THREE.Color(0x3ee8ff);
    for (let i = 0; i < PYLON_ROWS; i++) {
      pylonZ.push(-i * PYLON_GAP);
      pylonTops.setColorAt(i * 2, i % 2 ? gold : cyan);
      pylonTops.setColorAt(i * 2 + 1, i % 2 ? gold : cyan);
    }
    pylonPosts.frustumCulled = false;
    pylonTops.frustumCulled = false;
    scene.add(pylonPosts, pylonTops);

    // Collectibles and bugs (one draw call each)
    const cups = new THREE.InstancedMesh(createCupGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_ITEMS);
    const bugs = new THREE.InstancedMesh(createBugGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_ITEMS);
    const halos = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      MAX_ITEMS,
    );
    for (const m of [cups, bugs, halos]) { m.frustumCulled = false; scene.add(m); }
    for (let i = 0; i < MAX_ITEMS; i++) halos.setColorAt(i, gold);
    // The rare IAM policy power-up (at most one on the road) and the force field it gives the ship
    const shieldItem = new THREE.Mesh(createShieldGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    shieldItem.visible = false;
    scene.add(shieldItem);

    // Sparks for collected beans
    const SPARKS = 90;
    const sparkPos = new Float32Array(SPARKS * 3);
    const sparkCol = new Float32Array(SPARKS * 3);
    const sparkVel = new Float32Array(SPARKS * 3);
    const sparkLife = new Float32Array(SPARKS);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
      size: 0.45, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sparks.frustumCulled = false;
    scene.add(sparks);

    const ship = createCamelShip();
    scene.add(ship.group);
    const bubble = createShieldBubble();
    ship.group.add(bubble);

    gl = {
      renderer, scene, camera, groundMat, pylonPosts, pylonTops, pylonZ, cups, bugs, halos, gold, shieldItem, bubble,
      skyMat, ridgeMat, sunGlow, red: new THREE.Color(0xff3b55), orange: new THREE.Color(0xff9900),
      tintKey: '', progress: -1, sparks: { geo: sparkGeo, pos: sparkPos, col: sparkCol, vel: sparkVel, life: sparkLife, n: SPARKS, next: 0 },
      ship, holders: [], items: Array.from({ length: MAX_ITEMS }, () => ({ active: false })),
      dummy: new THREE.Object3D(), zero: new THREE.Matrix4().makeScale(0, 0, 0), time: 0, raf: 0, last: 0,
      camDist: 7.4, camY: 3.1, lens: 0, lensX: 0, panelRight: 0, vw: 1, vh: 1, portrait: false,
      v1: new THREE.Vector3(), v2: new THREE.Vector3(), v5: new THREE.Vector3(),
    };
    resize();
  }

  function resize() {
    if (!gl) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    gl.renderer.setSize(w, h, false);
    gl.camera.fov = aspect < 1 ? 70 : 62;
    gl.camera.aspect = aspect;
    gl.camera.updateProjectionMatrix();
    // Keep all three lanes on screen, even on a narrow phone.
    const halfTan = Math.tan(THREE.MathUtils.degToRad(gl.camera.fov / 2));
    gl.camDist = Math.max(7.4, 5.1 / (halfTan * aspect));
    gl.camY = 3.1 + (gl.camDist - 7.4) * 0.28;
    gl.vw = w;
    gl.vh = h;
    gl.portrait = aspect < 0.9;
    measurePanel();
  }

  // On wide and sideways screens the cards sit on the left. Remember where they end,
  // so the lens can put the ship in the middle of the free space to their right.
  function measurePanel() {
    if (!gl) return;
    const p = [els.intro, els.station, els.end].find((x) => !x.hidden);
    const r = p && p.getBoundingClientRect();
    gl.panelRight = r && r.left < gl.vw * 0.15 && r.right < gl.vw * 0.7 ? r.right : 0;
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }

  function clearWorld() {
    for (const h of gl.holders) { gl.scene.remove(h); disposeTree(h); }
    gl.holders = [];
    for (const it of gl.items) it.active = false;
  }

  function spawnStation(i, z) {
    const st = STATIONS[i];
    const holder = new THREE.Group();
    const gate = createGate(st.name, st.color);
    const gateMats = [];
    gate.traverse((o) => {
      if (!o.isMesh) return;
      o.material.transparent = true;
      o.material.userData.base = o.material.opacity;
      gateMats.push(o.material);
    });
    holder.add(gate, createCity(st.id, st.color));
    holder.userData.gate = { obj: gate, mats: gateMats, k: 1 };
    holder.position.z = z;
    holder.userData.index = i;
    holder.userData.labels = [];
    holder.traverse((o) => { if (o.isSprite) holder.userData.labels.push(o); });
    gl.scene.add(holder);
    gl.holders.push(holder);
    return holder;
  }

  /* ---------- items ---------- */
  function addItem(type, lane, z) {
    const it = gl.items.find((x) => !x.active);
    if (!it) return;
    Object.assign(it, { active: true, type, x: LANES[lane], z, phase: Math.random() * Math.PI * 2 });
  }

  function rowAllowed(reach) {
    if (reach > GATE_AT[GATE_AT.length - 1] - STOP_AHEAD) return false;
    for (let g = S.visited; g < Math.min(S.visited + 2, GATE_AT.length); g++) {
      if (reach > GATE_AT[g] - STOP_AHEAD - GATE_CLEAR && reach < GATE_AT[g] + 24) return false;
    }
    return true;
  }

  function spawnRow(z) {
    const lane = Math.floor(Math.random() * 3);
    const other = (l) => (l + 1 + Math.floor(Math.random() * 2)) % 3;
    // After the first city, a rare IAM policy power-up: it blocks the next bug.
    if (S.visited > 0 && !S.shield && Math.random() < 0.05 && !gl.items.some((x) => x.active && x.type === 'shield')) {
      addItem('shield', lane, z);
      S.lastRowBugs = 0;
      return;
    }
    const r = Math.random();
    const allowDouble = S.visited > 0 && S.lastRowBugs === 0;
    if (r < 0.55) {
      addItem('bean', lane, z);
      S.lastRowBugs = 0;
    } else if (r < 0.86 || !allowDouble) {
      addItem('bug', lane, z);
      if (Math.random() < 0.55) addItem('bean', other(lane), z);
      S.lastRowBugs = 1;
    } else {
      for (let l = 0; l < 3; l++) if (l !== lane) addItem('bug', l, z);
      addItem('bean', lane, z);
      S.lastRowBugs = 2;
    }
  }

  function emitSparks(x, y, z, color, count = 14) {
    const sp = gl.sparks;
    for (let k = 0; k < count; k++) {
      const i = sp.next;
      sp.next = (sp.next + 1) % sp.n;
      sp.pos.set([x, y, z], i * 3);
      sp.vel.set([(Math.random() - 0.5) * 7, Math.random() * 6 + 1, (Math.random() - 0.5) * 5 + 4], i * 3);
      sp.life[i] = 0.6 + Math.random() * 0.4;
      sp.col.set([color.r, color.g, color.b], i * 3);
    }
  }

  /* ================================================================== */
  /* game flow                                                           */
  /* ================================================================== */
  function setMode(mode) {
    S.mode = mode;
    root.classList.toggle('is-playing', mode === 'playing');
    root.classList.toggle('is-text', mode === 'text');
    els.pause.textContent = mode === 'paused' ? '▶' : '⏸';
    els.pause.setAttribute('aria-label', mode === 'paused' ? 'Resume' : 'Pause');
    els.pause.disabled = !(mode === 'playing' || mode === 'paused');
    els.skip.disabled = mode !== 'playing';
  }

  function showOnly(panel) {
    for (const p of [els.intro, els.station, els.end, els.text]) p.hidden = p !== panel;
    measurePanel();
  }

  // `here` marks the city whose card is open; otherwise the next stop is highlighted.
  function renderRoute(here = -1) {
    ticks.forEach((b, i) => b.classList.toggle('is-done', i < S.visited));
    els.route.replaceChildren(...STATIONS.map((s, i) => {
      const li = document.createElement('li');
      li.textContent = s.name;
      if (i === here) {
        li.className = 'is-here';
        li.setAttribute('aria-current', 'step');
      } else if (i < S.visited) li.className = 'is-done';
      else if (i === S.visited && here < 0) li.className = 'is-next';
      return li;
    }));
  }

  function renderScore() {
    els.beans.textContent = String(S.beans);
    els.bugs.textContent = String(S.bugs);
  }

  function pop(text, kind) {
    els.pop.textContent = text;
    els.pop.className = `game-pop mono is-${kind}`;
    void els.pop.offsetWidth; // restart the animation
    els.pop.classList.add('is-on');
  }

  function startRun() {
    if (!gl) return;
    clearWorld();
    Object.assign(S, {
      visited: 0, world: 0, distSinceRow: 0, speed: BASE_SPEED, lane: 1, shipX: 0,
      beans: 0, bugs: 0, flightTime: 0, slowTimer: 0, shake: 0, lastRowBugs: 0, shield: false, streak: 0,
    });
    gl.progress = -1;
    spawnStation(0, -GATE_AT[0]);
    for (let z = -46; z > SPAWN_Z; z -= ROW_GAP) spawnRow(z);
    renderRoute();
    renderScore();
    showOnly(null);
    setMode('playing');
    root.focus({ preventScroll: true });
    sfx.launch();
    unlock('liftoff');
  }

  function arrive(i) {
    S.visited = i + 1;
    renderRoute(i);
    sfx.station();
    // Build the next city now, while the card is open, so flying never stutters.
    if (i + 1 < STATIONS.length) spawnStation(i + 1, -(GATE_AT[i + 1] - S.world));
    if (i === STATIONS.length - 1) return finish();
    setMode('station');
    buildStationPanel(els.station, STATIONS[i], i);
    showOnly(els.station);
    els.station.querySelector('[data-continue]').focus({ preventScroll: true });
  }

  function continueRun() {
    renderRoute();
    showOnly(null);
    setMode('playing');
    root.focus({ preventScroll: true });
  }

  function finish() {
    setMode('end');
    sfx.finish();
    unlock('silk-road');
    buildEndPanel();
    showOnly(els.end);
    els.end.querySelector('[data-contact]').focus({ preventScroll: true });
  }

  function skip() {
    if (S.mode !== 'playing') return;
    const target = GATE_AT[S.visited] - STOP_AHEAD - 30;
    const delta = target - S.world;
    if (delta <= 0) return;
    S.world = target;
    for (const h of gl.holders) h.position.z += delta;
    for (const it of gl.items) it.active = false;
    gl.groundMat.uniforms.uOffset.value += delta;
  }

  function pause() {
    if (S.mode !== 'playing') return;
    setMode('paused');
    els.station.style.setProperty('--city', '#3ee8ff');
    els.station.replaceChildren(
      el('p', 'station-kicker', [el('span', '', 'PAUSED'), el('span', '', `☕️ ${S.beans} · 🐛 ${S.bugs}`)]),
      el('h2', '', 'Coffee break ☕️'),
      el('p', '', 'The camel is hovering patiently. Take your time.'),
      el('div', 'station-links', [button('Resume ▶', 'btn btn-primary', resume, { 'data-continue': '' })]),
    );
    showOnly(els.station);
    els.station.querySelector('[data-continue]').focus({ preventScroll: true });
  }

  function resume() {
    if (S.mode !== 'paused') return;
    showOnly(null);
    setMode('playing');
    root.focus({ preventScroll: true });
  }

  /* ---------- DOM helpers (textContent only, never innerHTML) ---------- */
  function el(tag, className, content, attrs = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (Array.isArray(content)) node.append(...content);
    else if (content != null) node.textContent = content;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }
  function button(label, className, onClick, attrs = {}) {
    const b = el('button', className, label, { type: 'button', ...attrs });
    b.addEventListener('click', onClick);
    return b;
  }
  function portfolioLink(href, label, className = 'btn btn-ghost') {
    const a = el('a', className, label, { href });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      close();
      const target = document.querySelector(href);
      if (target) setTimeout(() => target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }), 60);
    });
    return a;
  }
  function stationBlocks(st) {
    return [
      el('div', 'station-block', [el('b', '', 'THEN'), el('p', '', st.then)]),
      el('div', 'station-block', [el('b', '', 'NOW · ME'), el('p', '', st.now)]),
      el('div', 'station-block station-meme', [el('b', '', 'MEME TRANSMISSION'), el('p', '', st.meme)]),
    ];
  }

  function buildStationPanel(panel, st, i) {
    panel.style.setProperty('--city', cssColor(st.color));
    const next = STATIONS[i + 1];
    panel.replaceChildren(
      el('p', 'station-kicker', [el('span', '', `STATION ${i + 1} OF ${STATIONS.length} · ${st.era}`), el('span', '', `☕️ ${S.beans} · 🐛 ${S.bugs}`)]),
      el('h2', '', st.name),
      el('p', 'station-tagline', st.tagline),
      ...stationBlocks(st),
      el('div', 'station-links', [
        button(`Fly to ${next.name} →`, 'btn btn-primary', continueRun, { 'data-continue': '' }),
        portfolioLink(st.link.href, st.link.label),
      ]),
    );
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function buildEndPanel() {
    const st = STATIONS[STATIONS.length - 1];
    els.end.style.setProperty('--city', cssColor(st.color));
    els.end.classList.add('game-panel--station');
    els.end.replaceChildren(
      el('p', 'station-kicker', [el('span', '', 'FINAL DESTINATION · JOURNEY COMPLETE'), el('span', '', '🏁')]),
      el('h2', '', st.name),
      el('p', 'station-tagline', st.tagline),
      ...stationBlocks(st),
      el('div', 'end-stats', [
        el('div', '', [el('b', '', String(S.beans)), el('span', '', 'Java beans')]),
        el('div', '', [el('b', '', String(S.bugs)), el('span', '', 'bugs hit')]),
        el('div', '', [el('b', '', fmtTime(S.flightTime)), el('span', '', 'flight time')]),
      ]),
      el('div', 'end-rank-row', [
        el('p', 'end-rank', `Rank: ${rankFor(S.beans, S.bugs)}`),
        button('Share my rank ↗', 'btn btn-ghost btn-small', shareRank),
      ]),
      el('div', 'station-links', [
        portfolioLink('#contact', 'Contact me ✉️', 'btn btn-primary'),
        button('Fly again 🔁', 'btn btn-ghost', startRun),
        button('Back to the portfolio', 'btn btn-ghost', close),
      ]),
    );
    els.end.querySelector('.btn-primary').setAttribute('data-contact', '');
  }

  async function shareRank(e) {
    const btn = e.currentTarget;
    const url = `${location.origin}${location.pathname}`;
    const text = `I flew Silk Road 2077 on Saidmuxammadxon's portfolio: ${S.beans} Java beans, ${S.bugs} bugs, `
      + `${fmtTime(S.flightTime)} flight time. Rank: ${rankFor(S.beans, S.bugs)}. Can you beat it?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Silk Road 2077', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      btn.textContent = 'Copied to clipboard ✓';
    } catch (err) {
      if (err && err.name === 'AbortError') return; // the share sheet was closed
      btn.textContent = 'Sharing is blocked here, sorry';
    }
  }

  function showText() {
    setMode('text');
    const list = STATIONS.map((st, i) => el('article', 'text-station', [
      el('p', 'station-kicker', `STATION ${i + 1} · ${st.era}`),
      el('h3', '', st.name),
      ...stationBlocks(st),
      el('p', '', [portfolioLink(st.link.href, st.link.label, 'link-arrow')]),
    ]));
    const actions = [];
    if (webgl) actions.push(button('Fly it in 3D instead 🐫', 'btn btn-primary', showIntro));
    actions.push(button('Close', 'btn btn-ghost', close));
    els.text.replaceChildren(
      el('p', 'mono tiny dim', 'SILK ROAD 2077 · TEXT MODE'),
      el('h2', '', 'The route, as text'),
      el('p', '', 'Five cities of my story, plus the Cloud. Each one connects a famous scientist from that city to something I built.'),
      ...list,
      el('div', 'panel-cta', actions),
    );
    S.visited = STATIONS.length;
    renderRoute();
    showOnly(els.text);
    els.text.scrollTop = 0;
    // Reading to the end of the text route counts as finishing the journey.
    els.text.removeEventListener('scroll', onTextScroll);
    els.text.addEventListener('scroll', onTextScroll, { passive: true });
    requestAnimationFrame(onTextScroll);
    els.text.querySelector('button').focus({ preventScroll: true });
  }

  function onTextScroll() {
    const t = els.text;
    if (t.hidden || t.scrollTop + t.clientHeight < t.scrollHeight - 80) return;
    t.removeEventListener('scroll', onTextScroll);
    unlock('silk-road');
  }

  function showIntro() {
    if (!webgl) return showText();
    if (!gl) {
      try {
        setupThree();
      } catch (err) {
        console.warn('WebGL failed, falling back to text mode', err);
        webgl = false;
        return showText();
      }
    }
    clearWorld();
    S.visited = 0;
    S.world = 0;
    S.shield = false;
    S.lane = 1;
    S.shipX = 0;
    S.camBlend = 0;
    S.introT = 0;
    S.snapLens = true; // open with the ship already clear of the card
    renderRoute();
    renderScore();
    setMode('intro');
    showOnly(els.intro);
    startLoop();
    els.start.focus({ preventScroll: true });
  }

  // Every city has its own sky. As you enter a city's airspace (the last stretch of road
  // before it), the horizon, fog, grid, mountain ridges and sun glow change to its palette.
  const sky = (horizon, mid, fog, grid, ridge) => ({
    horizon: new THREE.Color(...horizon), mid: new THREE.Color(...mid), fog: new THREE.Color(...fog),
    grid: new THREE.Color(...grid), ridge: new THREE.Color(ridge),
  });
  const NEON = sky([0.62, 0.14, 0.42], [0.16, 0.04, 0.24], [0.40, 0.09, 0.33], [0.95, 0.22, 0.80], 0xff4fd2);
  const SKIES = {
    chelak: sky([0.78, 0.30, 0.22], [0.20, 0.06, 0.16], [0.42, 0.13, 0.16], [1.00, 0.55, 0.30], 0xffa040), // sunset orange
    samarkand: sky([0.10, 0.42, 0.52], [0.03, 0.10, 0.20], [0.06, 0.22, 0.30], [0.18, 0.95, 0.85], 0x2fe6d0), // turquoise tiles
    bukhara: sky([0.32, 0.26, 0.78], [0.08, 0.06, 0.26], [0.17, 0.13, 0.42], [0.48, 0.58, 1.00], 0x7d95ff), // lapis
    khiva: NEON, // desert neon
    tashkent: sky([0.10, 0.38, 0.66], [0.03, 0.08, 0.22], [0.05, 0.18, 0.36], [0.24, 0.88, 1.00], 0x3ee8ff), // city night
    cloud: sky([0.62, 0.68, 0.88], [0.20, 0.24, 0.42], [0.36, 0.40, 0.56], [0.78, 0.92, 1.00], 0xc8f4ff), // above the clouds
  };
  const SUN_GLOW = new THREE.Color(0xff5aa8);
  function updateTint() {
    const g = gl;
    const k = Math.min(S.visited, STATIONS.length - 1);
    const start = k === 0 ? 0 : GATE_AT[k - 1] - STOP_AHEAD;
    const end = GATE_AT[k] - STOP_AHEAD;
    const x = Math.min(Math.max(((S.world - start) / (end - start) - 0.55) / 0.4, 0), 1);
    const f = x * x * (3 - 2 * x);
    const key = `${k}:${f.toFixed(3)}`;
    if (key === g.tintKey) return;
    g.tintKey = key;
    const a = k === 0 ? NEON : SKIES[STATIONS[k - 1].id];
    const b = SKIES[STATIONS[k].id];
    g.skyMat.uniforms.uHorizon.value.copy(a.horizon).lerp(b.horizon, f);
    g.skyMat.uniforms.uMid.value.copy(a.mid).lerp(b.mid, f);
    g.scene.fog.color.copy(a.fog).lerp(b.fog, f);
    g.groundMat.uniforms.uGrid.value.copy(a.grid).lerp(b.grid, f);
    g.ridgeMat.color.copy(a.ridge).lerp(b.ridge, f);
    g.sunGlow.material.color.copy(SUN_GLOW).lerp(g.ridgeMat.color, 0.35);
  }

  /* ================================================================== */
  /* per-frame update                                                    */
  /* ================================================================== */
  function update(dt) {
    const g = gl;
    g.time += dt;
    const t = g.time;

    let moveSpeed = 0;
    if (S.mode === 'playing') {
      S.flightTime += dt;
      S.slowTimer = Math.max(0, S.slowTimer - dt);
      const target = (BASE_SPEED + S.visited * 5) * (S.slowTimer > 0 ? 0.55 : 1);
      S.speed += (target - S.speed) * Math.min(dt * 3, 1);
      moveSpeed = S.speed;
    } else if (S.mode === 'intro') {
      moveSpeed = 12;
    }
    const dz = moveSpeed * dt;
    g.groundMat.uniforms.uOffset.value += dz;

    // pylons
    for (let i = 0; i < PYLON_ROWS; i++) {
      g.pylonZ[i] += dz;
      if (g.pylonZ[i] > 10) g.pylonZ[i] -= PYLON_ROWS * PYLON_GAP;
      for (let s = 0; s < 2; s++) {
        const x = s ? 6.4 : -6.4;
        g.dummy.position.set(x, 1.6, g.pylonZ[i]);
        g.dummy.rotation.set(0, 0, 0);
        g.dummy.scale.setScalar(1);
        g.dummy.updateMatrix();
        g.pylonPosts.setMatrixAt(i * 2 + s, g.dummy.matrix);
        g.dummy.position.y = 3.3;
        g.dummy.updateMatrix();
        g.pylonTops.setMatrixAt(i * 2 + s, g.dummy.matrix);
      }
    }
    g.pylonPosts.instanceMatrix.needsUpdate = true;
    g.pylonTops.instanceMatrix.needsUpdate = true;

    // stations
    for (let i = g.holders.length - 1; i >= 0; i--) {
      const h = g.holders[i];
      h.position.z += dz;
      h.visible = h.position.z > -255;
      // The gate fades once the ship is through it, before it can fill the camera.
      const gd = h.userData.gate;
      const gk = Math.min(Math.max((5 - h.position.z) / 8, 0), 1);
      if (gk !== gd.k) {
        gd.k = gk;
        gd.obj.visible = gk > 0;
        for (const m of gd.mats) m.opacity = m.userData.base * gk;
      }
      // Fade the floating city names as they fly past, so they never cover the HUD.
      for (const label of h.userData.labels) {
        const z = label.getWorldPosition(g.v5).z;
        label.material.opacity = Math.min(Math.max((-z - 4) / 18, 0), 1);
      }
      if (h.position.z > 150) {
        g.scene.remove(h);
        disposeTree(h);
        g.holders.splice(i, 1);
      }
    }

    if (S.mode === 'playing') {
      S.world += dz;
      S.distSinceRow += dz;
      if (S.distSinceRow >= ROW_GAP) {
        S.distSinceRow -= ROW_GAP;
        if (rowAllowed(S.world - SPAWN_Z)) spawnRow(SPAWN_Z);
      }
    }

    // items: move, collide, draw
    const targetX = LANES[S.lane];
    let shieldShown = false;
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      if (it.active && S.mode === 'playing') {
        const prevZ = it.z;
        it.z += dz;
        if (prevZ < 0 && it.z >= 0 && Math.abs(it.x - S.shipX) < 1.35) {
          it.active = false;
          if (it.type === 'bean') {
            S.beans++;
            S.streak++;
            emitSparks(it.x, 1.1, 0, g.gold);
            sfx.bean();
            if (S.beans % 10 === 0) pop(BEAN_MESSAGES[Math.floor(Math.random() * BEAN_MESSAGES.length)], 'bean');
            if (S.beans >= 25) unlock('beans');
            if (S.streak >= 15) unlock('clean-code');
          } else if (it.type === 'shield') {
            S.shield = true;
            emitSparks(it.x, 1.1, 0, g.orange, 18);
            sfx.shield();
            pop('🛡️ IAM policy attached: Deny bug:*', 'shield');
          } else if (S.shield) {
            S.shield = false;
            g.bubble.material.uniforms.uAlpha.value = 2.2; // flare, then fade out
            emitSparks(it.x, 1.1, 0, g.orange, 24);
            sfx.block();
            pop('🛡️ AccessDenied: bug blocked', 'shield');
            unlock('least-privilege');
          } else {
            S.bugs++;
            S.streak = 0;
            S.slowTimer = 0.9;
            S.shake = reduceMotion ? 0 : 0.5;
            emitSparks(it.x, 1.1, 0, g.red, 20);
            sfx.bug();
            pop(`🐛 ${BUG_MESSAGES[Math.floor(Math.random() * BUG_MESSAGES.length)]}`, 'bug');
            els.flash.classList.add('is-on');
            setTimeout(() => els.flash.classList.remove('is-on'), 90);
            if (S.bugs >= 5) unlock('bug-magnet');
          }
          renderScore();
        }
        if (it.z > 14) it.active = false;
      }
      if (!it.active) {
        g.cups.setMatrixAt(i, g.zero);
        g.bugs.setMatrixAt(i, g.zero);
        g.halos.setMatrixAt(i, g.zero);
        continue;
      }
      const bob = Math.sin(t * 3 + it.phase) * 0.15;
      g.dummy.position.set(it.x, 1.05 + bob, it.z);
      if (it.type === 'shield') {
        shieldShown = true;
        g.shieldItem.position.set(it.x, 1.25 + bob, it.z);
        g.shieldItem.rotation.set(0, Math.sin(t * 2 + it.phase) * 0.55, Math.sin(t * 1.3) * 0.08);
        g.shieldItem.scale.setScalar(1.3);
        g.cups.setMatrixAt(i, g.zero);
        g.bugs.setMatrixAt(i, g.zero);
      } else if (it.type === 'bean') {
        g.dummy.rotation.set(0.25, t * 2.2 + it.phase, 0);
        g.dummy.scale.setScalar(1.15);
        g.dummy.updateMatrix();
        g.cups.setMatrixAt(i, g.dummy.matrix);
        g.bugs.setMatrixAt(i, g.zero);
      } else {
        g.dummy.rotation.set(Math.sin(t * 6 + it.phase) * 0.15, Math.PI + Math.sin(t * 4 + it.phase) * 0.3, 0);
        g.dummy.scale.setScalar(1.25 + Math.sin(t * 8 + it.phase) * 0.06);
        g.dummy.updateMatrix();
        g.bugs.setMatrixAt(i, g.dummy.matrix);
        g.cups.setMatrixAt(i, g.zero);
      }
      g.dummy.position.z -= 0.6;
      g.dummy.rotation.set(0, 0, 0);
      g.dummy.scale.setScalar(it.type === 'bean' ? 2.6 : 3);
      g.dummy.updateMatrix();
      g.halos.setMatrixAt(i, g.dummy.matrix);
      g.halos.setColorAt(i, it.type === 'bean' ? g.gold : it.type === 'bug' ? g.red : g.orange);
    }
    g.shieldItem.visible = shieldShown;
    g.cups.instanceMatrix.needsUpdate = true;
    g.bugs.instanceMatrix.needsUpdate = true;
    g.halos.instanceMatrix.needsUpdate = true;
    if (g.halos.instanceColor) g.halos.instanceColor.needsUpdate = true;

    // sparks
    const sp = g.sparks;
    for (let i = 0; i < sp.n; i++) {
      if (sp.life[i] <= 0) {
        sp.col[i * 3] = sp.col[i * 3 + 1] = sp.col[i * 3 + 2] = 0;
        continue;
      }
      sp.life[i] -= dt;
      sp.vel[i * 3 + 1] -= 9 * dt;
      sp.pos[i * 3] += sp.vel[i * 3] * dt;
      sp.pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt;
      sp.pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
      const k = Math.max(sp.life[i], 0) * 1.4;
      sp.col[i * 3] *= 0.97;
      sp.col[i * 3 + 1] *= 0.97;
      sp.col[i * 3 + 2] *= 0.97;
      if (k <= 0) sp.col[i * 3] = sp.col[i * 3 + 1] = sp.col[i * 3 + 2] = 0;
    }
    sp.geo.attributes.position.needsUpdate = true;
    sp.geo.attributes.color.needsUpdate = true;

    // the IAM force field
    const bu = g.bubble.material.uniforms;
    bu.uTime.value = reduceMotion ? 0 : t;
    bu.uAlpha.value += ((S.shield ? 1 : 0) - bu.uAlpha.value) * Math.min(dt * 4, 1);
    g.bubble.visible = bu.uAlpha.value > 0.01;

    updateTint();
    if (S.mode === 'playing') {
      const prog = Math.min(S.world / JOURNEY, 1);
      if (Math.abs(prog - g.progress) > 0.001) {
        g.progress = prog;
        els.progress.style.setProperty('--p', prog.toFixed(4));
      }
    }

    // arrival at the next gate
    if (S.mode === 'playing' && S.visited < GATE_AT.length && GATE_AT[S.visited] - S.world <= STOP_AHEAD) arrive(S.visited);

    // ship and camera
    S.shipX += (targetX - S.shipX) * Math.min(dt * 10, 1);
    const ship = g.ship.group;
    ship.position.set(S.shipX, 1.1 + Math.sin(t * 2.2) * 0.12, 0);
    ship.rotation.set(Math.sin(t * 1.6) * 0.03, (S.shipX - targetX) * 0.06, (S.shipX - targetX) * 0.22);
    g.ship.update(t, S.mode === 'playing' ? 1 + (S.speed - BASE_SPEED) / 50 : 0.7);

    S.shake = Math.max(0, S.shake - dt);
    const shake = S.shake * 0.6;
    const cam = g.camera;
    const blendTarget = S.mode === 'intro' ? 0 : 1;
    S.camBlend += (blendTarget - S.camBlend) * Math.min(dt * 1.8, 1);
    const b = S.camBlend * S.camBlend * (3 - 2 * S.camBlend);
    // showcase swing around the ship (intro): rear three-quarter, side, front three-quarter
    if (S.mode === 'intro') S.introT += dt;
    const a = 1.5 + (reduceMotion ? 0 : Math.sin(S.introT * 0.3) * 0.75);
    const orbitPos = g.v1.set(S.shipX + Math.sin(a) * 6.8, 2.2, Math.cos(a) * 6.8);
    const orbitLook = g.v2.copy(ship.position);
    // chase camera (playing, stations)
    const chaseX = S.shipX * 0.45;
    const chaseLookX = S.shipX * 0.3;
    cam.position.set(
      orbitPos.x + (chaseX - orbitPos.x) * b + (Math.random() - 0.5) * shake,
      orbitPos.y + (g.camY - orbitPos.y) * b + (Math.random() - 0.5) * shake,
      orbitPos.z + (g.camDist - orbitPos.z) * b,
    );
    cam.lookAt(
      orbitLook.x + (chaseLookX - orbitLook.x) * b,
      orbitLook.y + (1.2 - orbitLook.y) * b,
      orbitLook.z + (-16 - orbitLook.z) * b,
    );
    // Shift the lens so the ship stays clear of the cards: above them on phones (they slide up
    // from the bottom), and to their right on wide or sideways screens (they sit on the left).
    const lensTarget = !g.portrait || S.mode === 'playing' ? 0 : S.mode === 'intro' ? 0.24 : 0.12;
    const sideCard = S.mode === 'intro' || S.mode === 'station' || S.mode === 'end';
    const lensXTarget = sideCard ? g.panelRight / (2 * g.vw) : 0;
    const ease = S.snapLens ? 1 : Math.min(dt * 2.5, 1);
    S.snapLens = false;
    g.lens += (lensTarget - g.lens) * ease;
    g.lensX += (lensXTarget - g.lensX) * ease;
    if (g.lens > 0.002 || g.lensX > 0.002) cam.setViewOffset(g.vw, g.vh, -g.lensX * g.vw, g.lens * g.vh, g.vw, g.vh);
    else if (cam.view && cam.view.enabled) cam.clearViewOffset();
  }

  function frame(now) {
    gl.raf = requestAnimationFrame(frame);
    const dt = Math.min((now - gl.last) / 1000, 0.05);
    gl.last = now;
    update(dt);
    gl.renderer.render(gl.scene, gl.camera);
  }

  function startLoop() {
    if (!gl || gl.raf) return;
    gl.last = performance.now();
    gl.raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (gl && gl.raf) cancelAnimationFrame(gl.raf);
    if (gl) gl.raf = 0;
  }

  /* ================================================================== */
  /* input                                                               */
  /* ================================================================== */
  function steer(dir) {
    if (S.mode !== 'playing') return;
    S.lane = Math.min(2, Math.max(0, S.lane + dir));
  }

  function onKey(e) {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { trapTab(e); return; }
    if (S.mode === 'playing' || S.mode === 'paused') {
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || k === 'a') { e.preventDefault(); if (!e.repeat) steer(-1); }
      else if (e.key === 'ArrowRight' || k === 'd') { e.preventDefault(); if (!e.repeat) steer(1); }
      else if (k === 'p') { e.preventDefault(); if (S.mode === 'playing') pause(); else resume(); }
    }
  }

  function trapTab(e) {
    const focusables = [...root.querySelectorAll('button, a[href]')]
      .filter((n) => !n.disabled && !n.closest('[hidden]') && n.getClientRects().length);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!root.contains(document.activeElement) || document.activeElement === root) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  let swipe = null;
  function onPointerDown(e) {
    if (S.mode !== 'playing' || e.target.closest('button, a')) return;
    swipe = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!swipe || S.mode !== 'playing') { swipe = null; return; }
    const dx = e.clientX - swipe.x;
    swipe = null;
    if (Math.abs(dx) > 30) steer(Math.sign(dx));
    else steer(e.clientX < window.innerWidth / 2 ? -1 : 1);
  }
  function onVisibility() {
    if (document.hidden && S.mode === 'playing') pause();
  }

  els.touch.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-steer]');
    if (!b) return;
    e.preventDefault();
    steer(Number(b.dataset.steer));
  });
  els.start.addEventListener('click', startRun);
  els.textBtn.addEventListener('click', showText);
  els.exit.addEventListener('click', () => close());
  els.skip.addEventListener('click', skip);
  els.pause.addEventListener('click', () => (S.mode === 'paused' ? resume() : pause()));
  els.sound.addEventListener('click', () => {
    sfx.setEnabled(!sfx.enabled);
    els.sound.textContent = sfx.enabled ? '🔊' : '🔇';
    els.sound.setAttribute('aria-pressed', String(sfx.enabled));
    els.sound.setAttribute('aria-label', sfx.enabled ? 'Sound on' : 'Sound off');
    if (sfx.enabled) sfx.bean();
  });

  /* ================================================================== */
  /* open / close                                                        */
  /* ================================================================== */
  function open(mode = 'play', opener = null) {
    lastFocus = opener || document.activeElement;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    if (onOpen) onOpen();
    document.addEventListener('keydown', onKey);
    els.stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    if (mode === 'text' || !webgl) showText();
    else showIntro();
  }

  function close() {
    stopLoop();
    setMode('idle');
    root.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    els.stage.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (gl) clearWorld();
    if (onClose) onClose();
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  renderRoute();
  setMode('idle');
  return { open, close };
}
