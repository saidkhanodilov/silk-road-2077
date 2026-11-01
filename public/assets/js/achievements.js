// Site-wide achievements. Progress lives in this browser's localStorage only.

const STORAGE_KEY = 'silkroad2077.achievements.v1';

export const ACHIEVEMENTS = [
  { id: 'hello-world', icon: '👋', title: 'Hello, World', desc: 'Loaded the site. Every journey starts with one println.' },
  { id: 'dossier', icon: '🪪', title: 'Background check', desc: 'Read the pilot dossier.' },
  { id: 'loadout', icon: '🧰', title: 'Power scanner', desc: 'Inspected the skills loadout.' },
  { id: 'missions', icon: '🛰️', title: 'Mission control', desc: 'Opened the mission log.' },
  { id: 'crew', icon: '🎖️', title: 'Crew record', desc: 'Checked the experience timeline.' },
  { id: 'orbit', icon: '🌍', title: 'Orbit reached', desc: 'Scrolled all the way up to 400 km.' },
  { id: 'liftoff', icon: '🐫', title: 'Liftoff', desc: 'Launched the Silk Road 2077 caravan.' },
  { id: 'silk-road', icon: '🏁', title: 'Silk Road complete', desc: 'Visited all five cities and reached the Cloud.' },
  { id: 'beans', icon: '☕️', title: 'Bean counter', desc: 'Collected 25 Java beans in one run.' },
  { id: 'bug-magnet', icon: '🐛', title: 'Bug magnet', desc: 'Hit 5 bugs in one run. Very realistic.' },
  { id: 'clean-code', icon: '🧼', title: 'Clean code', desc: 'Collected 15 Java beans in a row without hitting a bug.' },
  { id: 'least-privilege', icon: '🛡️', title: 'Least privilege', desc: 'Blocked a bug with the IAM policy power-up.' },
  { id: 'konami', icon: '🎮', title: 'Konami commander', desc: 'Entered the Konami code. Meme mode engaged.' },
  { id: 'curious', icon: '🔍', title: 'Curious clicker', desc: 'Clicked the logo five times and found a dev secret.' },
];

const unlocked = new Set();
let els = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) saved.forEach((id) => unlocked.add(id));
  } catch { /* private mode or blocked storage: start fresh */ }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked])); } catch { /* ignore */ }
}

function render() {
  if (!els) return;
  els.count.textContent = String(unlocked.size);
  els.total.textContent = `/${ACHIEVEMENTS.length}`;
  els.progress.textContent = `${unlocked.size} of ${ACHIEVEMENTS.length}`;
  els.list.replaceChildren(...ACHIEVEMENTS.map((a) => {
    const li = document.createElement('li');
    const got = unlocked.has(a.id);
    li.className = got ? 'is-unlocked' : 'is-locked';
    const icon = document.createElement('span');
    icon.className = 't-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = got ? a.icon : '🔒';
    const text = document.createElement('span');
    const title = document.createElement('b');
    title.textContent = got ? a.title : `${a.title} (locked)`;
    const desc = document.createElement('small');
    desc.textContent = a.desc;
    text.append(title, desc);
    li.append(icon, text);
    return li;
  }));
}

const queue = [];
let showing = 0;

export function toast(opts) {
  queue.push(opts);
  pump();
}

function pump() {
  if (!els || showing >= 2 || !queue.length) return;
  const { icon = '🏆', label = 'ACHIEVEMENT UNLOCKED', title, text = '', duration = 3400 } = queue.shift();
  showing++;
  const el = document.createElement('div');
  el.className = 'toast';
  const i = document.createElement('span');
  i.className = 'toast-icon';
  i.setAttribute('aria-hidden', 'true');
  i.textContent = icon;
  const body = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = label;
  const t = document.createElement('span');
  t.textContent = title;
  body.append(b, t);
  if (text) {
    const s = document.createElement('small');
    s.textContent = text;
    body.append(s);
  }
  el.append(i, body);
  els.toasts.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.remove();
      showing--;
      pump();
    }, 380);
  }, duration);
}

export function unlock(id) {
  if (unlocked.has(id)) return false;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return false;
  unlocked.add(id);
  save();
  render();
  toast({ icon: a.icon, title: a.title, text: a.desc });
  return true;
}

export function isUnlocked(id) {
  return unlocked.has(id);
}

export function initAchievements() {
  els = {
    count: document.getElementById('trophy-count'),
    total: document.querySelector('.trophy-total'),
    progress: document.getElementById('trophies-progress'),
    list: document.getElementById('trophy-list'),
    toasts: document.getElementById('toasts'),
    dialog: document.getElementById('trophies'),
    button: document.getElementById('trophy-btn'),
  };
  load();
  render();
  els.button.addEventListener('click', () => {
    render();
    if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
    else els.dialog.setAttribute('open', '');
  });
  // Clicking the dark backdrop closes the dialog too.
  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) els.dialog.close();
  });
}
