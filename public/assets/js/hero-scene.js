// The 3D universe behind the page: a dot-matrix Earth with a beacon on Tashkent, lit by
// where the sun really is right now, a satellite on a 51.6° orbit (the SimulateUz target),
// girih stars, and a camel spaceship that flies past every now and then.

import * as THREE from '../vendor/three.min.js';
import { createCamelShip, createGirihStar, makeGlowTexture, makeLabel } from './silk-road/models.js';
import { TASHKENT, subsolarPoint } from './sun.js';

function latLonToVec3(lat, lon, r) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

export async function initHero(canvas, { reduceMotion = false } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowPower = coarse || Math.min(innerWidth, innerHeight) < 700;

  // Create the context ourselves, so a browser without WebGL 2 fails quietly (main.js keeps the CSS background).
  const context = canvas.getContext('webgl2', { alpha: true, antialias: !lowPower, depth: true, stencil: false, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL 2 is not available');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: !lowPower, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2500);
  camera.position.set(0, 0, 40);

  scene.add(new THREE.HemisphereLight(0x9fdcff, 0x3a1340, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(30, 25, 30);
  scene.add(sun);

  const glowTex = makeGlowTexture();

  /* ---------- Stars ---------- */
  const starCount = lowPower ? 1400 : 3200;
  const sPos = new Float32Array(starCount * 3);
  const sSize = new Float32Array(starCount);
  const sPhase = new Float32Array(starCount);
  const sColor = new Float32Array(starCount * 3);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0x9fefff), new THREE.Color(0xffd79a), new THREE.Color(0xc6b6ff)];
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(260 + Math.random() * 640);
    sPos.set([v.x, v.y, v.z], i * 3);
    sSize[i] = Math.random() < 0.06 ? 2.6 + Math.random() * 2 : 0.7 + Math.random() * 1.4;
    sPhase[i] = Math.random() * Math.PI * 2;
    const c = palette[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3)];
    sColor.set([c.r, c.g, c.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(sColor, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      uniform float uTime; uniform float uPixelRatio;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTw = 0.6 + 0.4 * sin(uTime * 1.3 + aPhase);
        vColor = aColor;
        gl_PointSize = aSize * uPixelRatio * (320.0 / -mv.z) * (0.75 + 0.25 * vTw);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, a * vTw);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------- Earth ---------- */
  const R = 14;
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);
  const earthSpin = new THREE.Group();
  earthGroup.add(earthSpin);
  earthGroup.rotation.z = 0.32; // axial tilt, roughly

  // Two small maps: where the land is, and where the cities are (night lights, made from real
  // city populations by tools/globe/night_lights.py).
  const loader = new THREE.TextureLoader();
  const [landTex, lightsTex] = await Promise.all(['earth-land-mask.png', 'earth-lights.png'].map(async (file) => {
    const tex = await loader.loadAsync(new URL(`../img/${file}`, import.meta.url).href);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }));

  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      uLand: { value: landTex },
      uLights: { value: lightsTex },
      uSunDir: { value: new THREE.Vector3(0.6, 0.45, 0.65).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uLand; uniform sampler2D uLights; uniform vec3 uSunDir;
      varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewDir;
      void main() {
        float rows = 130.0;
        float row = floor(vUv.y * rows);
        float rowLat = ((row + 0.5) / rows - 0.5) * 3.14159265;
        float cols = max(floor(rows * 2.0 * cos(rowLat)), 1.0);
        vec2 cell = vec2(vUv.x * cols, vUv.y * rows);
        vec2 f = fract(cell) - 0.5;
        vec2 center = (floor(cell) + 0.5) / vec2(cols, rows);
        float land = texture2D(uLand, center).r;
        float lights = texture2D(uLights, center).r;
        float dotMask = smoothstep(0.34, 0.16, length(f));

        // uSunDir points at the real sun, so the lit half is wherever it's daytime right now.
        float sunDot = dot(vNormalW, uSunDir);
        float day = smoothstep(-0.08, 0.14, sunDot);
        float light = mix(0.32, 0.62 + 0.45 * max(sunDot, 0.0), day);
        float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 2.4);

        vec3 dots = vec3(0.22, 0.78, 1.0) * land * light * 1.15;
        dots += vec3(0.10, 0.22, 0.55) * (1.0 - land) * 0.10 * light;
        // Sunrise and sunset: land along the terminator turns gold.
        float dusk = exp(-sunDot * sunDot / 0.005);
        dots = mix(dots, vec3(1.0, 0.62, 0.25) * 0.85, land * dusk * 0.6);
        // After dark, the cities light up.
        float city = smoothstep(0.1, 0.75, lights) * (1.0 - day);
        dots = mix(dots, vec3(1.0, 0.66, 0.3) * (0.4 + 0.85 * lights), city);

        vec3 col = vec3(0.012, 0.025, 0.07) + dots * dotMask;
        col += vec3(1.0, 0.31, 0.82) * dusk * 0.05; // a faint pink line along the terminator

        vec2 gUv = vec2(vUv.x * 24.0, vUv.y * 12.0);
        vec2 g = abs(fract(gUv - 0.5) - 0.5) / fwidth(gUv);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        col += vec3(0.25, 0.45, 1.0) * line * 0.10;
        col += vec3(0.30, 0.80, 1.0) * fres * 0.95;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const seg = lowPower ? [72, 48] : [112, 72];
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, seg[0], seg[1]), earthMat);
  earthSpin.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.14, 64, 40),
    new THREE.ShaderMaterial({
      uniforms: { uSunDir: earthMat.uniforms.uSunDir }, // shared, so both follow the sun
      vertexShader: /* glsl */`
        varying vec3 vNormal; varying vec3 vNormalW;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir;
        varying vec3 vNormal; varying vec3 vNormalW;
        void main() {
          float i = pow(clamp(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.6);
          float lit = 0.5 + 0.7 * smoothstep(-0.35, 0.55, dot(vNormalW, uSunDir)); // brighter on the sunny edge
          gl_FragColor = vec4(0.25, 0.7, 1.0, 1.0) * i * 1.6 * lit;
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  earthGroup.add(atmosphere);

  // Beacon on Tashkent
  const beaconPos = latLonToVec3(TASHKENT.lat, TASHKENT.lon, R);
  const normal = beaconPos.clone().normalize();
  const beacon = new THREE.Group();
  beacon.position.copy(beaconPos);
  beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.12, 5, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffbe55, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pillar.position.y = 2.5;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.55, 40),
    new THREE.MeshBasicMaterial({ color: 0xffbe55, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffbe55, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flare.scale.setScalar(2.6);
  flare.position.y = 0.2;
  const tag = makeLabel('TASHKENT', { color: '#ffbe55', height: 0.9, weight: 700 });
  tag.position.y = 5.8;
  beacon.add(pillar, ring, flare, tag);
  earthSpin.add(beacon);

  // Turn the globe so Uzbekistan faces the camera at load.
  const azimuth = Math.atan2(beaconPos.x, beaconPos.z);
  const baseSpin = -0.35 - azimuth;
  earthSpin.rotation.y = baseSpin;

  // The sun's direction from the Earth, in the globe's own frame. It's worked out again every
  // minute, and turned with the spinning globe every frame, so day and night stay on the right
  // countries however the globe is turned.
  const sunLocal = new THREE.Vector3();
  const spinQuat = new THREE.Quaternion();
  let sunAt = -Infinity;
  function updateSun() {
    const now = Date.now();
    if (Math.abs(now - sunAt) > 60000) {
      sunAt = now;
      const { lat, lon } = subsolarPoint(now);
      sunLocal.copy(latLonToVec3(lat, lon, 1));
    }
    earthMat.uniforms.uSunDir.value.copy(sunLocal).applyQuaternion(earthSpin.getWorldQuaternion(spinQuat));
  }

  // Satellite on a 51.6° orbit (the SimulateUz target orbit)
  const orbit = new THREE.Group();
  orbit.rotation.x = THREE.MathUtils.degToRad(90 - 51.6);
  orbit.rotation.y = 0.5;
  earthGroup.add(orbit);
  const orbitR = R * 1.32;
  const orbitPts = [];
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    orbitPts.push(new THREE.Vector3(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR));
  }
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(orbitPts),
    new THREE.LineDashedMaterial({ color: 0x3ee8ff, dashSize: 0.9, gapSize: 0.6, transparent: true, opacity: 0.55 }),
  );
  orbitLine.computeLineDistances();
  orbit.add(orbitLine);
  const sat = new THREE.Group();
  const satBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xdfe6f5, metalness: 0.6, roughness: 0.3 }));
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x3355cc, emissive: 0x112266, metalness: 0.4, roughness: 0.4 });
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.6), panelMat);
  panelL.position.x = -1.1;
  const panelR = panelL.clone();
  panelR.position.x = 1.1;
  const satGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x3ee8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  satGlow.scale.setScalar(2.4);
  sat.add(satBody, panelL, panelR, satGlow);
  orbit.add(sat);

  const TRAIL = 46;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailCol = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  orbit.add(trail);

  /* ---------- Girih stars ---------- */
  // They float in the empty margins beside the text column (see applyLayout), never behind words.
  const girih = [];
  const girihColors = [0x3ee8ff, 0xffbe55, 0xff4fd2, 0x5b7cff];
  const girihCount = lowPower ? 6 : 10;
  for (let i = 0; i < girihCount; i++) {
    const size = 1.6 + Math.random() * 2.2;
    const s = createGirihStar(size, girihColors[i % girihColors.length], 0.22 + Math.random() * 0.22);
    s.userData = {
      size, side: i % 2 ? 1 : -1, u: Math.random(), z: -20 - Math.random() * 50,
      spin: (Math.random() - 0.5) * 0.4, bob: Math.random() * Math.PI * 2, baseY: (Math.random() - 0.5) * 56,
    };
    girih.push(s);
    scene.add(s);
  }

  /* ---------- Camel flyby ---------- */
  const camel = createCamelShip();
  camel.group.scale.setScalar(1.3);
  camel.group.visible = false;
  scene.add(camel.group);
  let nextFlyby = 5;
  let flyStart = -1;
  const FLY_TIME = 9;

  /* ---------- Render loop state (declared early: onScroll may ask for a frame during setup) ---------- */
  let paused = false;
  let raf = 0;
  let last = performance.now();
  let firstFrame = true;
  // Adaptive quality: if frames come slowly (an older phone, or no GPU), drop the resolution
  // first and then the frame rate, so scrolling stays smooth. ?hq turns this off.
  let quality = new URLSearchParams(location.search).has('hq') ? -1 : 2; // 2 full, 1 lower resolution, 0 also 30 fps
  let perfFrames = -30; // skip the first frames, while shaders compile
  let perfTime = 0;

  /* ---------- Layout, input, scroll ---------- */
  let scrollP = 0;
  let heroP = 0;
  let endP = 0;
  let pointerX = 0;
  let pointerY = 0;
  let camX = 0;
  let camY = 0;
  const layout = { x: 0, y: 0, z: 0 };
  const away = { x: 0, y: 0, z: 0 };
  const finale = { x: 0, y: 0, z: 0 };
  const CAM_Z = 44; // average camera distance while scrolling (40 at the top, 48 at the bottom)

  function applyLayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const aspect = w / h;
    if (aspect >= 1.15) {
      Object.assign(layout, { x: 17 + Math.min(aspect - 1.15, 1) * 8, y: -10, z: -8 });
      Object.assign(finale, { x: 0, y: -24, z: -14 });
    } else if (aspect >= 0.8) {
      Object.assign(layout, { x: 9, y: -15, z: -8 });
      Object.assign(finale, { x: 0, y: -24, z: -14 });
    } else {
      Object.assign(layout, { x: 4, y: -25, z: -10 });
      Object.assign(finale, { x: 0, y: -26, z: -20 });
    }

    // Pixel geometry of the text column, matching .wrap (max-width 1180px, gutter clamp(16px, 4vw, 32px)).
    const gutter = Math.min(Math.max(w * 0.04, 16), 32);
    const margin = (w - (Math.min(w, 1180) - gutter * 2)) / 2;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const pxPerUnit = (z) => h / 2 / ((CAM_Z - z) * tanHalf);
    const xAtPx = (px, z) => ((px / w) * 2 - 1) * (CAM_Z - z) * tanHalf * aspect;

    // While you read, the globe waits in the right margin with only its edge showing.
    const awayZ = aspect >= 1.15 ? -60 : -70;
    away.z = awayZ;
    away.y = aspect >= 1.15 ? -16 : -30;
    away.x = xAtPx(w - margin + 28 + R * 1.2 * pxPerUnit(awayZ), awayZ);

    const girihOn = margin >= 96;
    for (const s of girih) {
      const d = s.userData;
      s.visible = girihOn;
      if (!girihOn) continue;
      s.scale.setScalar(Math.min(1, (margin * 0.34) / (d.size * pxPerUnit(d.z))));
      const px = margin * (0.3 + 0.4 * d.u);
      s.position.set(xAtPx(d.side > 0 ? w - px : px, d.z), d.baseY, d.z);
    }
    starMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollP = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    heroP = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.9), 0), 1);
    const e = Math.min(Math.max((scrollP - 0.86) / 0.14, 0), 1);
    endP = e * e * (3 - 2 * e);
    if (reduceMotion) requestRender();
  }

  function onPointer(e) {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  applyLayout();
  onScroll();
  window.addEventListener('resize', () => { applyLayout(); requestRender(); });
  window.addEventListener('scroll', onScroll, { passive: true });
  if (!coarse) window.addEventListener('pointermove', onPointer, { passive: true });

  /* ---------- Update & render ---------- */
  let t = 0;
  let satAngle = 0.6;
  const satHistory = [];

  function update(dt) {
    t += dt;
    starMat.uniforms.uTime.value = t;
    stars.rotation.y = t * 0.004 + scrollP * 0.5;
    stars.rotation.x = scrollP * 0.15;

    const h = heroP * heroP * (3 - 2 * heroP);
    const mx = layout.x + (away.x - layout.x) * h;
    const my = layout.y + (away.y - layout.y) * h;
    const mz = layout.z + (away.z - layout.z) * h;
    earthGroup.position.set(mx + (finale.x - mx) * endP, my + (finale.y - my) * endP, mz + (finale.z - mz) * endP);
    earthSpin.rotation.y = baseSpin + t * 0.035 + scrollP * 2.2;
    updateSun();

    // satellite
    satAngle += dt * 0.32;
    const sx = Math.cos(satAngle) * orbitR;
    const sz = Math.sin(satAngle) * orbitR;
    sat.position.set(sx, 0, sz);
    sat.rotation.y = -satAngle;
    satHistory.unshift(sx, 0, sz);
    if (satHistory.length > TRAIL * 3) satHistory.length = TRAIL * 3;
    for (let i = 0; i < TRAIL; i++) {
      const j = Math.min(i, satHistory.length / 3 - 1) * 3;
      trailPos[i * 3] = satHistory[j];
      trailPos[i * 3 + 1] = satHistory[j + 1];
      trailPos[i * 3 + 2] = satHistory[j + 2];
      const k = 1 - i / TRAIL;
      trailCol[i * 3] = 0.24 * k;
      trailCol[i * 3 + 1] = 0.9 * k;
      trailCol[i * 3 + 2] = 1.0 * k;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;

    // beacon pulse
    const pulse = (t * 0.8) % 1;
    ring.scale.setScalar(1 + pulse * 3);
    ring.material.opacity = 0.9 * (1 - pulse);
    flare.material.opacity = 0.7 + 0.3 * Math.sin(t * 3);

    for (const s of girih) {
      s.rotation.z += s.userData.spin * dt;
      s.position.y = s.userData.baseY + Math.sin(t * 0.4 + s.userData.bob) * 1.2 - scrollP * 10;
    }

    // occasional camel flyby, only on the launch pad and at the very end so it never crosses a paragraph
    if (flyStart < 0 && t > nextFlyby && (heroP < 0.5 || endP > 0.5)) {
      flyStart = t;
      camel.group.visible = true;
      camel.group.userData.dir = Math.random() < 0.5 ? 1 : -1;
      camel.group.userData.y = (Math.random() - 0.2) * 10;
    }
    if (flyStart >= 0) {
      const k = (t - flyStart) / FLY_TIME;
      const dir = camel.group.userData.dir;
      camel.group.position.set(dir * (-75 + k * 150), camel.group.userData.y + Math.sin(k * Math.PI * 2) * 2.5, -32);
      camel.group.rotation.set(Math.sin(k * Math.PI * 4) * 0.08, dir > 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(k * Math.PI * 2) * 0.2 * dir);
      camel.update(t, 1.2);
      if (k >= 1) {
        flyStart = -1;
        camel.group.visible = false;
        nextFlyby = t + 22 + Math.random() * 14;
      }
    }

    camX += (pointerX * 2.2 - camX) * Math.min(dt * 2.5, 1);
    camY += (-pointerY * 1.4 - camY) * Math.min(dt * 2.5, 1);
    camera.position.set(camX, camY - scrollP * 3, 40 + scrollP * 8);
    camera.lookAt(0, -scrollP * 3, 0);
  }

  function adapt(raw) {
    if (quality <= 0 || raw > 0.25) return;
    if (++perfFrames <= 0) return;
    perfTime += raw;
    if (perfFrames < 45) return;
    const slow = perfTime / perfFrames > 1 / 40;
    perfFrames = 0;
    perfTime = 0;
    if (!slow) return;
    quality--;
    if (quality === 1) {
      renderer.setPixelRatio(1);
      applyLayout();
    }
  }

  function frame(now) {
    raf = 0;
    if (paused || document.hidden) return;
    if (quality === 0 && now - last < 30) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 0.05);
    last = now;
    if (!reduceMotion) adapt(raw);
    update(reduceMotion ? 0 : dt);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add('is-ready');
      document.body.classList.add('has-3d');
    }
    if (!reduceMotion) raf = requestAnimationFrame(frame);
  }

  function requestRender() {
    if (!raf && !paused) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
  requestRender();

  return {
    setPaused(v) {
      paused = v;
      if (!v) requestRender();
    },
  };
}
