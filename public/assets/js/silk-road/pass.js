// The boarding pass you get at the end of Silk Road 2077: a ticket-shaped picture of your
// flight, drawn on a canvas, to save or share. It uses plain shapes and the site's own fonts
// (no emoji), so it looks the same on every device.

const W = 1200;
const H = 630;
const STUB = 860; // the tear-off stub starts here
const PAD = 56;
const COLORS = {
  text: '#e9f2ff', muted: '#a3b3d3', dim: '#7384a8', line: 'rgba(110, 190, 255, 0.28)',
  cyan: '#3ee8ff', gold: '#ffbe55', magenta: '#ff4fd2', red: '#ff5a6e',
};
const DISPLAY = 'Orbitron, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// A small seeded random generator, so the same flight always gets the same stars and barcode.
function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function write(ctx, str, x, y, { font, color = COLORS.text, align = 'left', spacing = 0 }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = `${spacing}px`; // ignored where canvases don't support it yet
  ctx.fillText(str, x, y);
}

// The largest font size, from `size` down to `min`, at which the text fits `maxWidth`.
function fit(ctx, str, weight, family, size, min, maxWidth) {
  ctx.letterSpacing = '0px';
  for (; size > min; size--) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(str).width <= maxWidth) break;
  }
  return `${weight} ${size}px ${family}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the pass and resolve to an image blob. `rank` is { title, note }, `photo` an optional
 * canvas with a snapshot of the camel (cropped to fit), and `link` where to fly it yourself.
 */
export async function makeBoardingPass({ beans, bugs, time, rank, photo, link, date = new Date(), scale = 2, type = 'image/jpeg' }) {
  await Promise.all([`900 92px ${DISPLAY}`, `500 14px ${MONO}`].map((f) => document.fonts.load(f).catch(() => {})));
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';
  const rand = seeded(beans * 7919 + bugs * 104729 + time.length * 31 + date.getDate());

  // Deep space, a magenta glow behind the route, and a scatter of stars.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0e1438');
  bg.addColorStop(1, '#04050d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(430, 170, 10, 430, 170, 430);
  glow.addColorStop(0, 'rgba(255, 79, 210, 0.22)');
  glow.addColorStop(1, 'rgba(255, 79, 210, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STUB, H);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.12 + rand() * 0.4).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 0.4 + rand() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const strip = ctx.createLinearGradient(0, 0, W, 0);
  strip.addColorStop(0, COLORS.magenta);
  strip.addColorStop(0.5, COLORS.gold);
  strip.addColorStop(1, COLORS.cyan);
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, W, 6);

  // The perforation between the pass and its stub, with a notch punched at each end.
  ctx.strokeStyle = 'rgba(163, 179, 211, 0.5)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([1, 10]);
  ctx.beginPath();
  ctx.moveTo(STUB, 40);
  ctx.lineTo(STUB, H - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#020308';
  for (const y of [0, H]) {
    ctx.beginPath();
    ctx.arc(STUB, y, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- the pass ---------- */
  write(ctx, 'SILK ROAD 2077', PAD, 64, { font: `900 26px ${DISPLAY}`, color: COLORS.cyan, spacing: 3 });
  write(ctx, 'BOARDING PASS', STUB - PAD, 62, { font: `500 15px ${MONO}`, color: COLORS.muted, align: 'right', spacing: 5 });
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(PAD, 88, STUB - PAD * 2, 1);

  // From Chelak to the Cloud, with a dot for each city on the way.
  const codeFont = `900 92px ${DISPLAY}`;
  write(ctx, 'CHL', PAD - 4, 194, { font: codeFont });
  const from = ctx.measureText('CHL').width;
  write(ctx, 'CLD', STUB - PAD, 194, { font: codeFont, align: 'right' });
  const to = ctx.measureText('CLD').width;
  write(ctx, 'CHELAK', PAD, 228, { font: `500 15px ${MONO}`, color: COLORS.muted, spacing: 4 });
  write(ctx, 'THE CLOUD', STUB - PAD, 228, { font: `500 15px ${MONO}`, color: COLORS.muted, align: 'right', spacing: 4 });
  const x1 = PAD + from + 26;
  const x2 = STUB - PAD - to - 30;
  const ry = 158;
  ctx.strokeStyle = COLORS.cyan;
  ctx.globalAlpha = 0.75;
  ctx.setLineDash([7, 8]);
  ctx.beginPath();
  ctx.moveTo(x1, ry);
  ctx.lineTo(x2, ry);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.moveTo(x2 + 16, ry);
  ctx.lineTo(x2, ry - 8);
  ctx.lineTo(x2, ry + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(x1 + ((x2 - x1) * i) / 5, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  write(ctx, 'VIA SAMARKAND · BUKHARA · KHIVA · TASHKENT', PAD, 262, { font: `500 13px ${MONO}`, color: COLORS.dim, spacing: 2 });

  // Two rows of ticket fields.
  const colW = (STUB - PAD * 2) / 4;
  const fields = [
    ['PILOT', 'YOU'], ['FLIGHT', 'CHELAK-1'], ['DATE', `${date.getDate()} ${MONTHS[date.getMonth()]} 2077`], ['SEAT', 'HUMP 2'],
    ['JAVA BEANS', String(beans), COLORS.gold], ['BUGS HIT', String(bugs), COLORS.red], ['FLIGHT TIME', time, COLORS.cyan], ['CLASS', 'BACTRIAN'],
  ];
  fields.forEach(([label, value, color], i) => {
    const x = PAD + (i % 4) * colW;
    const y = 318 + Math.floor(i / 4) * 82;
    write(ctx, label, x, y, { font: `500 13px ${MONO}`, color: COLORS.dim, spacing: 3 });
    write(ctx, value, x, y + 34, { font: fit(ctx, value, 700, DISPLAY, 24, 14, colW - 18), color });
  });

  // The rank, with its note ("zero bugs (suspicious)") on a line of its own.
  write(ctx, 'RANK', PAD, 492, { font: `500 13px ${MONO}`, color: COLORS.dim, spacing: 3 });
  write(ctx, rank.title, PAD, 532, { font: fit(ctx, rank.title, 800, DISPLAY, 32, 18, STUB - PAD * 2), color: COLORS.gold });
  if (rank.note) write(ctx, rank.note, PAD, 562, { font: `500 16px ${MONO}`, color: COLORS.muted });
  write(ctx, 'Baggage: 1 laptop, unlimited coffee. Bugs are not allowed on board.', PAD, 604, { font: `400 13px ${MONO}`, color: COLORS.dim });

  /* ---------- the stub ---------- */
  const sx = STUB + 36;
  const sw = W - sx - 36;
  write(ctx, 'CHELAK-1', sx, 64, { font: `900 20px ${DISPLAY}`, spacing: 2 });
  write(ctx, 'SEAT HUMP 2', W - 36, 62, { font: `500 13px ${MONO}`, color: COLORS.dim, align: 'right', spacing: 2 });

  const py = 88;
  const ph = 300;
  ctx.save();
  roundRect(ctx, sx, py, sw, ph, 16);
  ctx.clip();
  if (photo) {
    // Crop the snapshot to the frame's shape, keeping its middle.
    const k = Math.min(photo.width / sw, photo.height / ph);
    ctx.drawImage(photo, (photo.width - sw * k) / 2, (photo.height - ph * k) / 2, sw * k, ph * k, sx, py, sw, ph);
  } else {
    const sky = ctx.createLinearGradient(sx, py, sx, py + ph);
    sky.addColorStop(0, '#2a1450');
    sky.addColorStop(1, COLORS.magenta);
    ctx.fillStyle = sky;
    ctx.fillRect(sx, py, sw, ph);
  }
  ctx.restore();
  roundRect(ctx, sx, py, sw, ph, 16);
  ctx.strokeStyle = 'rgba(62, 232, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const gy = py + ph + 36;
  write(ctx, 'GATE', sx, gy, { font: `500 12px ${MONO}`, color: COLORS.dim, spacing: 3 });
  write(ctx, 'AMPLIFY', sx, gy + 26, { font: `700 18px ${DISPLAY}` });
  write(ctx, 'BOARDING', W - 36, gy, { font: `500 12px ${MONO}`, color: COLORS.dim, align: 'right', spacing: 3 });
  write(ctx, 'NOW', W - 36, gy + 26, { font: `700 18px ${DISPLAY}`, color: COLORS.cyan, align: 'right' });

  // A barcode that only scans in 2077.
  const by = gy + 52;
  ctx.fillStyle = COLORS.text;
  for (let bx = sx; bx < sx + sw - 4;) {
    const w = Math.min(1 + Math.floor(rand() * 4), sx + sw - bx);
    ctx.fillRect(bx, by, w, 56);
    bx += w + 2 + Math.floor(rand() * 3);
  }

  write(ctx, 'FLY IT YOURSELF', sx, by + 94, { font: `500 12px ${MONO}`, color: COLORS.dim, spacing: 3 });
  write(ctx, link, sx, by + 116, { font: fit(ctx, link, 500, MONO, 15, 9, sw), color: COLORS.cyan });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the boarding pass'))), type, 0.92);
  });
}
