// Procedural 3D models shared by the hero scene and the Silk Road 2077 game.
// Everything is built from three.js primitives, so there are no model files to download.

import * as THREE from '../../vendor/three.min.js';

const euler = new THREE.Euler();
const quat = new THREE.Quaternion();

/** Transform matrix from position, rotation (radians) and scale. */
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  euler.set(rx, ry, rz);
  quat.setFromEuler(euler);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat.clone(), new THREE.Vector3(sx, sy, sz));
}

/**
 * Merge primitive parts into one non-indexed geometry with per-vertex colors,
 * so a whole model renders in a single draw call.
 * parts: [{ geo, color, matrix }]
 */
export function mergeParts(parts) {
  const prepared = [];
  let total = 0;
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    p.geo.dispose();
    if (p.matrix) g.applyMatrix4(p.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    prepared.push([g, new THREE.Color(p.color ?? 0xffffff)]);
    total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const [g, c] of prepared) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) {
      col[(o + i) * 3] = c.r;
      col[(o + i) * 3 + 1] = c.g;
      col[(o + i) * 3 + 2] = c.b;
    }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/* ------------------------------------------------------------------ */
/* Chelak-1: a two-humped, Bactrian-class freighter. Faces -Z.         */
/* ------------------------------------------------------------------ */
export function createCamelShip() {
  const SILVER = 0xd6deee;
  const GOLD = 0xffb547;
  const TAN = 0xc6955a;
  const LAPIS = 0x5b7cff;
  const DARK = 0x262d48;

  const legs = [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.62], [0.3, 0.62]].map(([x, z]) => ({
    geo: new THREE.CylinderGeometry(0.075, 0.06, 0.85, 6), color: TAN, matrix: mat(x, -0.62, z, -0.95),
  }));

  const hull = mergeParts([
    // fuselage
    { geo: new THREE.CapsuleGeometry(0.5, 1.7, 4, 12), color: SILVER, matrix: mat(0, 0, 0, Math.PI / 2) },
    // the humps (they're fuel tanks, obviously)
    { geo: new THREE.SphereGeometry(0.44, 14, 10), color: GOLD, matrix: mat(0, 0.4, -0.5, 0, 0, 0, 1, 0.95, 1.05) },
    { geo: new THREE.SphereGeometry(0.44, 14, 10), color: GOLD, matrix: mat(0, 0.4, 0.74, 0, 0, 0, 1, 0.95, 1.05) },
    // neck, head, ears
    { geo: new THREE.CylinderGeometry(0.16, 0.24, 1.05, 10), color: SILVER, matrix: mat(0, 0.5, -1.2, -0.75) },
    { geo: new THREE.BoxGeometry(0.34, 0.32, 0.66), color: SILVER, matrix: mat(0, 0.92, -1.62, 0.12) },
    { geo: new THREE.ConeGeometry(0.06, 0.2, 5), color: TAN, matrix: mat(-0.12, 1.14, -1.42, -0.2) },
    { geo: new THREE.ConeGeometry(0.06, 0.2, 5), color: TAN, matrix: mat(0.12, 1.14, -1.42, -0.2) },
    // folded legs double as landing gear
    ...legs,
    // swept wings with a little dihedral
    { geo: new THREE.BoxGeometry(1.5, 0.07, 0.6), color: LAPIS, matrix: mat(-1.0, -0.05, 0.25, 0, 0.3, -0.12) },
    { geo: new THREE.BoxGeometry(1.5, 0.07, 0.6), color: LAPIS, matrix: mat(1.0, -0.05, 0.25, 0, -0.3, 0.12) },
    // engines
    { geo: new THREE.CylinderGeometry(0.27, 0.2, 0.5, 12), color: DARK, matrix: mat(-0.3, -0.05, 1.3, Math.PI / 2) },
    { geo: new THREE.CylinderGeometry(0.27, 0.2, 0.5, 12), color: DARK, matrix: mat(0.3, -0.05, 1.3, Math.PI / 2) },
    // tail
    { geo: new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), color: TAN, matrix: mat(0, 0.25, 1.38, 0.9) },
    { geo: new THREE.SphereGeometry(0.09, 6, 4), color: TAN, matrix: mat(0, 0.47, 1.6) },
  ]);

  const group = new THREE.Group();
  group.name = 'Chelak-1';
  const body = new THREE.Mesh(hull, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, metalness: 0.35, roughness: 0.45,
  }));
  group.add(body);

  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0x3ee8ff }));
  visor.position.set(0, 0.99, -1.96);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), new THREE.MeshBasicMaterial({ color: 0x3ee8ff, transparent: true, opacity: 0.8 }));
  cockpit.position.set(0, 0.43, 0.12);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4f6e }));
  navL.position.set(-1.72, 0.03, 0.47);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x55ffaa }));
  navR.position.set(1.72, 0.03, 0.47);
  group.add(visor, cockpit, navL, navR);

  const flameTex = makeGlowTexture();
  const flames = [];
  for (const x of [-0.3, 0.3]) {
    const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.17, 1.3, 10, 1, true), glow(0xff8a3d, 0.55));
    plume.rotation.x = Math.PI / 2;
    plume.position.set(x, -0.05, 2.2);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xff8a3d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(x, -0.05, 1.62);
    halo.scale.setScalar(1.1);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xfff2b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(x, -0.05, 1.6);
    core.scale.setScalar(0.5);
    group.add(plume, halo, core);
    flames.push({ plume, halo, core });
  }

  return {
    group,
    update(t, thrust = 1) {
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const k = thrust * (0.85 + 0.2 * Math.sin(t * 38 + i * 1.7) + 0.1 * Math.random());
        f.plume.scale.set(1, k, 1);
        f.halo.scale.setScalar(1.1 * k);
        f.core.scale.setScalar(0.5 * (0.9 + 0.2 * Math.random()));
      }
      const on = Math.sin(t * 4) > 0.6;
      navL.material.color.setHex(on ? 0xff4f6e : 0x4a1520);
      navR.material.color.setHex(on ? 0x55ffaa : 0x16402b);
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Girih star: two overlapping squares, a classic Central Asian motif. */
/* ------------------------------------------------------------------ */
export function createGirihStar(radius = 1, color = 0x3ee8ff, opacity = 0.7) {
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const group = new THREE.Group();
  const square = (rot) => {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), material);
  };
  group.add(square(0), square(Math.PI / 4));
  const circle = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    circle.push(new THREE.Vector3(Math.cos(a) * radius * 0.54, Math.sin(a) * radius * 0.54, 0));
  }
  group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle), material));
  return group;
}

/* ------------------------------------------------------------------ */
/* Text sprites                                                       */
/* ------------------------------------------------------------------ */
export function makeLabel(text, { color = '#ffffff', height = 2, font = 'Orbitron', weight = 800, glow = true } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const px = 120;
  ctx.font = `${weight} ${px}px "${font}", sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 80;
  canvas.width = w;
  canvas.height = px + 80;
  ctx.font = `${weight} ${px}px "${font}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, canvas.height / 2 + 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, w / 2, canvas.height / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/* Collectibles                                                       */
/* ------------------------------------------------------------------ */
export function createCupGeometry() {
  return mergeParts([
    { geo: new THREE.CylinderGeometry(0.42, 0.32, 0.62, 14), color: 0xffe2a8 },
    { geo: new THREE.CylinderGeometry(0.36, 0.36, 0.04, 14), color: 0x6b3a1e, matrix: mat(0, 0.3, 0) },
    { geo: new THREE.TorusGeometry(0.17, 0.06, 6, 12), color: 0xffe2a8, matrix: mat(0.44, 0.02, 0) },
    { geo: new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), color: 0xffbe55, matrix: mat(0, -0.33, 0) },
  ]);
}

export function createBugGeometry() {
  const BODY = 0xff2f4f;
  const HEAD = 0xff7a90;
  const LEG = 0x5a0c1c;
  const parts = [
    { geo: new THREE.SphereGeometry(0.5, 10, 8), color: BODY, matrix: mat(0, 0, 0.1, 0, 0, 0, 0.85, 0.6, 1.1) },
    { geo: new THREE.SphereGeometry(0.3, 8, 6), color: HEAD, matrix: mat(0, 0.05, -0.55) },
    { geo: new THREE.SphereGeometry(0.08, 6, 4), color: 0xffffff, matrix: mat(-0.12, 0.16, -0.8) },
    { geo: new THREE.SphereGeometry(0.08, 6, 4), color: 0xffffff, matrix: mat(0.12, 0.16, -0.8) },
    { geo: new THREE.BoxGeometry(0.05, 0.55, 0.05), color: HEAD, matrix: mat(-0.14, 0.4, -0.72, -0.6, 0, 0.35) },
    { geo: new THREE.BoxGeometry(0.05, 0.55, 0.05), color: HEAD, matrix: mat(0.14, 0.4, -0.72, -0.6, 0, -0.35) },
    { geo: new THREE.BoxGeometry(0.9, 0.05, 0.05), color: LEG, matrix: mat(0, 0.2, 0.1) },
  ];
  for (const z of [-0.25, 0.1, 0.45]) {
    for (const side of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.6, 0.06, 0.06), color: LEG, matrix: mat(side * 0.55, -0.15, z, 0, 0, side * -0.5) });
    }
  }
  return mergeParts(parts);
}

/** The IAM policy power-up: an AWS-orange shield with a check mark. Faces +Z. */
export function createShieldGeometry() {
  const outline = (s) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.52 * s, 0.56 * s);
    sh.lineTo(0.52 * s, 0.56 * s);
    sh.lineTo(0.52 * s, 0.08 * s);
    sh.quadraticCurveTo(0.48 * s, -0.42 * s, 0, -0.72 * s);
    sh.quadraticCurveTo(-0.48 * s, -0.42 * s, -0.52 * s, 0.08 * s);
    sh.closePath();
    return sh;
  };
  const slab = (s, depth) => new THREE.ExtrudeGeometry(outline(s), {
    depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10,
  });
  return mergeParts([
    { geo: slab(1, 0.16), color: 0xff9900, matrix: mat(0, 0, -0.08) },
    { geo: slab(0.74, 0.1), color: 0x232f3e, matrix: mat(0, 0.03, 0.06) },
    { geo: new THREE.BoxGeometry(0.12, 0.25, 0.08), color: 0xffffff, matrix: mat(-0.14, -0.06, 0.22, 0, 0, 0.73) },
    { geo: new THREE.BoxGeometry(0.12, 0.5, 0.08), color: 0xffffff, matrix: mat(0.09, 0.03, 0.22, 0, 0, -0.67) },
  ]);
}

/** A soft force field around the ship while the IAM policy is active. */
export function createShieldBubble() {
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 18),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(0xff9900) } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform float uAlpha; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float rim = pow(1.0 - abs(dot(vN, vV)), 3.0);
          // faint hexagon-ish cells drifting over the surface
          vec2 cell = abs(fract(vec2(atan(vP.x, vP.z) * 3.0, vP.y * 5.0 - uTime * 0.6)) - 0.5);
          float lines = smoothstep(0.42, 0.5, max(cell.x, cell.y));
          float a = (rim * 0.75 + lines * 0.12) * uAlpha * 0.8;
          gl_FragColor = vec4(uColor, a);
        }`,
    }),
  );
  bubble.scale.set(2.2, 1.25, 2.3);
  bubble.position.y = 0.15;
  bubble.renderOrder = 2;
  bubble.visible = false;
  return bubble;
}

/** Soft round glow texture for halos and sparks. */
export function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* City skylines: hologram buildings made of merged primitives.        */
/* ------------------------------------------------------------------ */
const P = {
  dome(x, z, r, drum = r * 0.9, y = 0) {
    return [
      { geo: new THREE.CylinderGeometry(r, r, drum, 12), matrix: mat(x, y + drum / 2, z) },
      { geo: new THREE.SphereGeometry(r * 1.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(x, y + drum, z, 0, 0, 0, 1, 1.25, 1) },
      { geo: new THREE.ConeGeometry(r * 0.12, r * 0.6, 6), matrix: mat(x, y + drum + r * 1.32 + r * 0.25, z) },
    ];
  },
  minaret(x, z, h, r, y = 0) {
    return [
      { geo: new THREE.CylinderGeometry(r * 0.75, r, h, 10), matrix: mat(x, y + h / 2, z) },
      { geo: new THREE.CylinderGeometry(r * 1.15, r * 0.8, h * 0.08, 10), matrix: mat(x, y + h + h * 0.04, z) },
      { geo: new THREE.ConeGeometry(r * 0.7, h * 0.12, 10), matrix: mat(x, y + h * 1.14, z) },
    ];
  },
  portal(x, z, w, h, ry = 0, depth = 1.6) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h);
    shape.lineTo(-w / 2, h);
    shape.lineTo(-w / 2, 0);
    const a = w * 0.42;
    const archY = h * 0.55;
    const hole = new THREE.Path();
    hole.moveTo(-a / 2, h * 0.04);
    hole.lineTo(a / 2, h * 0.04);
    hole.lineTo(a / 2, archY);
    hole.absarc(0, archY, a / 2, 0, Math.PI, false);
    hole.lineTo(-a / 2, h * 0.04);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    return [{ geo, matrix: mat(x, 0, z, 0, ry, 0) }];
  },
  box(x, z, w, h, d, ry = 0, y = 0, rz = 0) {
    return [{ geo: new THREE.BoxGeometry(w, h, d), matrix: mat(x, y + h / 2, z, 0, ry, rz) }];
  },
  house(x, z, s = 1, ry = 0) {
    return [
      { geo: new THREE.BoxGeometry(2.4 * s, 1.8 * s, 2.4 * s), matrix: mat(x, 0.9 * s, z, 0, ry, 0) },
      { geo: new THREE.ConeGeometry(1.9 * s, 1.2 * s, 4), matrix: mat(x, 2.4 * s, z, 0, ry + Math.PI / 4, 0) },
    ];
  },
  wall(x, z, len, h, thick = 1.6) {
    const parts = [{ geo: new THREE.BoxGeometry(thick, h, len), matrix: mat(x, h / 2, z) }];
    for (let i = -len / 2 + 1; i < len / 2; i += 2.2) {
      parts.push({ geo: new THREE.BoxGeometry(thick * 1.05, 0.9, 1.1), matrix: mat(x, h + 0.45, z + i) });
    }
    for (let i = -len / 2; i <= len / 2; i += len / 3) {
      parts.push({ geo: new THREE.CylinderGeometry(thick * 1.5, thick * 1.9, h * 1.15, 10), matrix: mat(x, (h * 1.15) / 2, z + i) });
    }
    return parts;
  },
  ring(x, y, z, r, tube, arc, rx = 0, ry = 0, rz = 0) {
    return [{ geo: new THREE.TorusGeometry(r, tube, 6, 28, arc), matrix: mat(x, y, z, rx, ry, rz) }];
  },
  stripedTower(x, z, rBottom, rTop, h) {
    const parts = [];
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands;
      const t1 = (i + 1) / bands;
      const r0 = rBottom + (rTop - rBottom) * t0;
      const r1 = rBottom + (rTop - rBottom) * t1;
      parts.push({ geo: new THREE.CylinderGeometry(r1, r0, h / bands - 0.15, 14), matrix: mat(x, h * t0 + h / bands / 2, z) });
    }
    return parts;
  },
  tvTower(x, z, h) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      parts.push({ geo: new THREE.CylinderGeometry(0.25, 0.45, h * 0.3, 6), matrix: mat(x + Math.cos(a) * 2, h * 0.13, z + Math.sin(a) * 2, Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32) });
    }
    parts.push({ geo: new THREE.CylinderGeometry(0.45, 0.8, h * 0.75, 8), matrix: mat(x, h * 0.25 + (h * 0.75) / 2, z) });
    parts.push({ geo: new THREE.SphereGeometry(2.2, 12, 8), matrix: mat(x, h * 0.7, z, 0, 0, 0, 1, 0.55, 1) });
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.25, h * 0.35, 6), matrix: mat(x, h + h * 0.17, z) });
    return parts;
  },
  cloud(x, y, z, s = 1) {
    const parts = [];
    const puffs = [[0, 0, 0, 2.6], [2.4, -0.4, 0.4, 2.0], [-2.5, -0.5, -0.2, 2.1], [1.1, 1.2, -0.3, 1.9], [-1.0, 1.0, 0.6, 1.7], [3.9, -0.9, -0.3, 1.3], [-4.0, -0.9, 0.3, 1.3]];
    for (const [px, py, pz, r] of puffs) parts.push({ geo: new THREE.IcosahedronGeometry(r * s, 1), matrix: mat(x + px * s, y + py * s, z + pz * s) });
    return parts;
  },
};

function skyline(parts, color, { fillOpacity = 0.5, edgeOpacity = 0.95 } = {}) {
  const geo = mergeParts(parts);
  const group = new THREE.Group();
  const c = new THREE.Color(color);
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: c.clone().multiplyScalar(0.18), transparent: true, opacity: fillOpacity, depthWrite: true,
  }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), new THREE.LineBasicMaterial({
    color: c, transparent: true, opacity: edgeOpacity,
  }));
  group.add(fill, edges);
  return group;
}

/** Build the skyline for one station. The road runs along Z through x = 0, so buildings stay at |x| > 8. */
export function createCity(id, color) {
  const parts = [];
  const extras = [];
  const add = (arr) => parts.push(...arr);

  switch (id) {
    case 'chelak': {
      const spots = [[-11, 6], [-15, -4], [-20, 4], [-13, -16], [-24, -10], [12, 4], [16, -6], [22, 2], [14, -18], [26, -14], [-30, 0], [31, -4]];
      spots.forEach(([x, z], i) => add(P.house(x, z, 0.9 + (i % 3) * 0.25, i * 0.4)));
      // a little server rack: where the first client websites lived
      add(P.box(19, -26, 4, 11, 4));
      for (let y = 1.5; y < 11; y += 1.6) add(P.box(19, -23.9, 3.2, 0.25, 0.3, 0, y));
      extras.push({ label: 'EC2', x: 19, y: 14, z: -26, height: 2.6 });
      // a stage with a big X for TEDxChelak Youth
      add(P.box(-20, -26, 10, 1, 6));
      add(P.box(-20, -28, 0.8, 9, 0.8, 0, 1, 0.7));
      add(P.box(-20, -28, 0.8, 9, 0.8, 0, 1, -0.7));
      extras.push({ label: 'TEDxChelak Youth', x: -20, y: 12.5, z: -28, height: 1.8, color: '#ff5a6e' });
      break;
    }
    case 'samarkand': {
      // Registan-style ensemble on both sides of the road
      add(P.portal(-15, -8, 11, 13, 0.45));
      add(P.portal(15, -8, 11, 13, -0.45));
      add(P.dome(-23, -18, 3.4, 3));
      add(P.dome(23, -18, 3.4, 3));
      add(P.minaret(-9.5, -2, 17, 0.8));
      add(P.minaret(-20, -1, 17, 0.8));
      add(P.minaret(9.5, -2, 17, 0.8));
      add(P.minaret(20, -1, 17, 0.8));
      add(P.portal(-30, -34, 14, 16, 0.2));
      add(P.dome(-30, -44, 4.2, 3.4));
      // Ulugh Beg's meridian arc, the giant instrument of his observatory
      add(P.ring(30, 0, -36, 13, 0.45, Math.PI / 2, 0, Math.PI / 2, 0));
      add(P.box(30, -36, 2.4, 1.2, 28, 0));
      extras.push({ label: 'Ulugh Beg Observatory · 1420s', x: 30, y: 17, z: -36, height: 1.5 });
      break;
    }
    case 'bukhara': {
      // Kalyan minaret
      add(P.minaret(-13, -14, 27, 2.1));
      add(P.portal(14, -10, 12, 13, -0.4));
      add(P.dome(20, -20, 2.8, 2.6));
      add(P.dome(25, -8, 2.8, 2.6));
      add(P.dome(-24, -28, 3.6, 2.8));
      // the library: stacked books, because Ibn Sina read all of them
      const books = [[-22, 2, 1.4, 6], [-20.3, 2, 1.1, 7.5], [-18.8, 2, 1.6, 5.4], [-17, 2, 1.2, 8.2], [-15.4, 2, 1.3, 6.6]];
      books.forEach(([x, z, w, h], i) => add(P.box(x, z, w, h, 4.4, (i % 2 ? 0.05 : -0.05))));
      add(P.box(-24.5, 0, 1.3, 6.8, 4.4, 0.35));
      extras.push({ label: 'Samanid royal library', x: -19, y: 11.5, z: 2, height: 1.4 });
      break;
    }
    case 'khiva': {
      // Itchan Kala walls on both sides
      add(P.wall(-11, -18, 54, 5));
      add(P.wall(11, -18, 54, 5));
      // Kalta Minor: wide, short and striped
      add(P.stripedTower(-24, -22, 7, 5.6, 12));
      // Islam Khoja minaret
      add(P.minaret(22, -26, 30, 1.5));
      add(P.dome(28, -12, 3, 2.6));
      add(P.portal(-26, -2, 10, 11, 0.5));
      extras.push({ label: 'x² + 10x = 39', x: -24, y: 18, z: -22, height: 2.2 });
      extras.push({ label: 'al-Khwārizmī → "algorithm"', x: 22, y: 38.5, z: -26, height: 1.5 });
      break;
    }
    case 'tashkent': {
      add(P.tvTower(-20, -26, 36));
      const towers = [[13, -4, 5, 18], [19, -10, 6, 26], [26, -2, 5, 15], [15, -24, 7, 30], [24, -22, 5, 21], [32, -14, 6, 24]];
      towers.forEach(([x, z, w, h], i) => add(P.box(x, z, w, h, w, i * 0.2)));
      // the university campus
      add(P.box(-17, 0, 14, 6, 7, 0.25));
      for (let i = -5; i <= 5; i += 2.5) add(P.box(-17 + i, 4, 0.6, 5.6, 0.6, 0.25));
      add(P.box(-17, 0, 15, 0.8, 8, 0.25, 6));
      extras.push({ label: 'Central Asian University', x: -17, y: 10, z: 0, height: 1.5 });
      extras.push({ label: 'AWS Student Builder Group', x: -17, y: 8.2, z: 0, height: 1.0, color: '#ffbe55' });
      break;
    }
    case 'cloud': {
      add(P.cloud(-16, 9, -10, 1.6));
      add(P.cloud(17, 12, -18, 1.9));
      add(P.cloud(-26, 15, -32, 2.1));
      add(P.cloud(28, 7, -2, 1.2));
      add(P.cloud(0, 22, -46, 2.6));
      for (let i = 0; i < 7; i++) {
        const s = i % 2 ? 1 : -1;
        add(P.box(s * (12 + i * 2.6), -14 + i * 4.2, 2.2, 2.2, 2.2, i, 2 + (i % 3) * 3));
      }
      extras.push({ label: 'Next stop: your team?', x: 0, y: 14, z: -20, height: 2 });
      break;
    }
    default:
      break;
  }

  const group = skyline(parts, color, id === 'cloud' ? { fillOpacity: 0.35, edgeOpacity: 0.8 } : undefined);
  for (const e of extras) {
    const label = makeLabel(e.label, { color: e.color || cssColor(color), height: e.height, weight: 700 });
    label.position.set(e.x, e.y, e.z);
    group.add(label);
  }
  return group;
}

/** The gate you fly through when you reach a city. */
export function createGate(name, color) {
  const group = new THREE.Group();
  const c = new THREE.Color(color);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.24, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c }));
  const inner = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.07, 6, 64, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  const sheen = new THREE.Mesh(
    new THREE.CircleGeometry(7.1, 48, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const label = makeLabel(name.toUpperCase(), { color: cssColor(color), height: 2.4 });
  label.position.set(0, 9.6, 0);
  group.add(arch, inner, sheen, label);
  return group;
}

export function cssColor(hex) {
  return `#${new THREE.Color(hex).getHexString()}`;
}
