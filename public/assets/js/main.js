// Page behaviour: navigation, HUD, reveal animations, achievements, easter eggs,
// and lazy loading of the 3D scene and the Silk Road 2077 game.

import { initAchievements, unlock, toast } from './achievements.js';

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------- Reveal on scroll (elements already on screen show immediately) ---------- */
function initReveal() {
  const items = $$('.reveal');
  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-visible');
  }
  root.classList.add('js-ready');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.filter((el) => !el.classList.contains('is-visible')).forEach((el) => io.observe(el));
}

/* ---------- Navigation ---------- */
function initNav() {
  const toggle = $('#menu-toggle');
  const nav = $('#site-nav');
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  const links = new Map($$('a', nav).map((a) => [a.getAttribute('href').slice(1), a]));
  const sectionAchievements = { about: 'dossier', skills: 'loadout', projects: 'missions', experience: 'crew' };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.id;
      links.forEach((a, key) => a.classList.toggle('is-active', key === id));
      if (sectionAchievements[id]) unlock(sectionAchievements[id]);
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('main > section[id]').forEach((s) => io.observe(s));
}

/* ---------- HUD: Tashkent clock, status memes, altimeter ---------- */
function initHud() {
  const timeEl = $('#hud-time');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
  const tick = () => { timeEl.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 15000);

  const statuses = [
    'compiling ☕️', 'it works on my machine ✓', 'warming up the JVM…', 'fixing a bug I wrote 5 minutes ago',
    'downloading more RAM', 'rebasing on main (scared)', 'deploying to AWS Amplify 🚀', 'feeding the camel 🐫',
    'reading the docs (for once)', 'git push --force-with-lease',
  ];
  const statusEl = $('#hud-status');
  let s = 0;
  setInterval(() => { s = (s + 1) % statuses.length; statusEl.textContent = statuses[s]; }, 5200);

  const fill = $('#alt-fill');
  const km = $('#alt-km');
  const v = $('#alt-v');
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    fill.style.height = `${(p * 100).toFixed(1)}%`;
    km.textContent = String(Math.round(p * 400));
    v.textContent = (p * 7.67).toFixed(1);
    if (p > 0.985) unlock('orbit');
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

/* ---------- Hero: typed roles and counters ---------- */
function initTyped() {
  const el = $('#typed');
  const roles = [
    'Java backend engineer',
    'rocket simulator (C++, RK4)',
    'AWS Student Builder Group Leader',
    'TEDxChelak Youth organizer',
    'professional NullPointerException survivor',
    'camel spaceship pilot',
  ];
  if (reduceMotion) {
    let i = 0;
    setInterval(() => { i = (i + 1) % roles.length; el.textContent = roles[i]; }, 3500);
    return;
  }
  let i = 0;
  let n = roles[0].length;
  let deleting = false;
  const step = () => {
    const word = roles[i];
    if (!deleting) {
      n++;
      el.textContent = word.slice(0, n);
      if (n >= word.length) { deleting = true; return setTimeout(step, 1900); }
      return setTimeout(step, 45 + Math.random() * 50);
    }
    n--;
    el.textContent = word.slice(0, n);
    if (n <= 0) { deleting = false; i = (i + 1) % roles.length; return setTimeout(step, 300); }
    return setTimeout(step, 24);
  };
  setTimeout(() => { deleting = true; step(); }, 2200);
}

function initCounters() {
  const nums = $$('[data-count]');
  if (reduceMotion || !nums.length) return;
  const run = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const start = performance.now();
    const dur = 1400;
    const frame = (now) => {
      const k = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    }
  }, { threshold: 0.6 });
  nums.forEach((el) => io.observe(el));
}

/* ---------- 3D tilt on holo cards ---------- */
function initTilt() {
  if (!finePointer || reduceMotion) return;
  for (const el of $$('.tilt')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--glare', '1');
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--glare', '0');
    });
  }
}

/* ---------- SimulateUz screenshot stack ---------- */
function initShots() {
  const stack = $('#shot-stack');
  if (!stack) return;
  stack.addEventListener('click', (e) => {
    if (!e.target.closest('.shot')) return;
    const front = $('.shot--front', stack);
    const back = $('.shot--back', stack);
    front.classList.replace('shot--front', 'shot--back');
    back.classList.replace('shot--back', 'shot--front');
  });
}

/* ---------- Easter eggs ---------- */
function emojiRain(emojis, count = 36) {
  if (reduceMotion) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'emoji-drop';
    el.textContent = emojis[i % emojis.length];
    el.style.left = `${Math.random() * 100}vw`;
    el.style.animationDuration = `${2.4 + Math.random() * 2.6}s`;
    el.style.animationDelay = `${Math.random() * 1.2}s`;
    el.style.fontSize = `${1.4 + Math.random() * 1.6}rem`;
    document.body.append(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

function initEasterEggs() {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0;
  document.addEventListener('keydown', (e) => {
    if (!$('#game').hidden) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = key === code[pos] ? pos + 1 : (key === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      const on = document.body.classList.toggle('meme-mode');
      emojiRain(['☕️', '🐛', '🐫', '🚀', '☁️', '💾']);
      if (!unlock('konami')) {
        toast({ icon: '🎮', label: 'MEME MODE', title: on ? 'Comic Sans protocol engaged' : 'Professionalism restored' });
      }
    }
  });

  let clicks = 0;
  let timer = 0;
  $('#brand').addEventListener('click', () => {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 2500);
    if (clicks >= 5) {
      clicks = 0;
      unlock('curious');
      toast({ icon: '🤫', label: 'DEV SECRET', title: 'I still debug with System.out.println.', text: 'Please don\'t tell my professors.' });
    }
  });

  const big = 'font: 700 16px/1.4 monospace; color: #3ee8ff;';
  const small = 'font: 12px/1.5 monospace; color: #a3b3d3;';
  console.log('%c🐫 Silk Road 2077 · SAIDXON.OS', big);
  console.log('%cHey, you opened the console. That makes you my kind of person.\n' +
    'This site is plain HTML, CSS and JavaScript with three.js, hosted on AWS Amplify.\n' +
    'Source: https://github.com/saidkhanodilov/silk-road-2077\n' +
    'Try the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A', small);
}

/* ---------- WebGL check ---------- */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

/* ---------- 3D background ---------- */
let hero = null;
function initHeroScene() {
  if (!hasWebGL()) return;
  const start = () => {
    import('./hero-scene.js')
      .then((m) => m.initHero($('#space'), { reduceMotion }))
      .then((h) => { hero = h; })
      .catch((err) => console.warn('3D scene unavailable:', err));
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 300);
}

/* ---------- Silk Road 2077 game ---------- */
let gamePromise = null;
function initGameLaunchers() {
  const launch = async (mode, opener) => {
    if (!gamePromise) {
      gamePromise = import('./silk-road/game.js').then((m) => m.createGame({
        root: $('#game'),
        webgl: hasWebGL(),
        reduceMotion,
        unlock,
        onOpen: () => hero && hero.setPaused(true),
        onClose: () => hero && hero.setPaused(false),
      }));
    }
    try {
      const game = await gamePromise;
      game.open(mode, opener);
    } catch (err) {
      console.error(err);
      gamePromise = null;
      toast({ icon: '🛠️', label: 'HOUSTON, WE HAVE A PROBLEM', title: 'The game failed to load.', text: 'Please refresh and try again.' });
    }
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-launch-game]');
    if (!btn) return;
    e.preventDefault();
    launch(btn.dataset.launchGame === 'text' ? 'text' : 'play', btn);
  });
}

/* ---------- Boot ---------- */
initReveal();
initAchievements();
initNav();
initHud();
initTyped();
initCounters();
initTilt();
initShots();
initEasterEggs();
initGameLaunchers();
initHeroScene();
setTimeout(() => unlock('hello-world'), 1800);
