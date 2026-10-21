// FitPlan · Estado, tema, utilidades, modal, logros, cálculos y navegación
'use strict';

// ---------- Estado y almacenamiento ----------
const STORE_KEY = 'fitplan-v1';
const MEALS = [
  { id: 'desayuno', name: 'Desayuno', share: 0.25 },
  { id: 'almuerzo', name: 'Almuerzo', share: 0.35 },
  { id: 'cena', name: 'Cena', share: 0.28 },
  { id: 'snack', name: 'Snacks', share: 0.12 },
];
const ACTIVITY_LEVELS = [
  { v: 1.2, label: 'Sedentario (poco o nada de ejercicio)' },
  { v: 1.375, label: 'Ligero (1-3 días/semana)' },
  { v: 1.55, label: 'Moderado (3-5 días/semana)' },
  { v: 1.725, label: 'Activo (6-7 días/semana)' },
  { v: 1.9, label: 'Muy activo (trabajo físico + entreno)' },
];
const GOALS = {
  perder: { label: 'Perder grasa', adj: -500, protPerKg: 2.0, rate: -0.5 },
  mantener: { label: 'Mantener peso', adj: 0, protPerKg: 1.6, rate: 0 },
  ganar: { label: 'Ganar músculo', adj: 300, protPerKg: 2.0, rate: 0.25 },
};
const DIETS = {
  equilibrada: { label: 'Equilibrada', fatPct: 0.25 },
  proteica: { label: 'Alta en proteína', fatPct: 0.25, protBonus: 0.3 },
  lowcarb: { label: 'Baja en carbohidratos', fatPct: 0.45 },
  vegetariana: { label: 'Vegetariana', fatPct: 0.25 },
};
const EMPTY = () => ({ profile: null, days: {}, customFoods: [], routine: null, weights: [], measures: [], plan: null, ajuste: 0, lastAdjust: null, favFoods: [], workouts: [], customRecipes: [], badges: [] });

// ---------- Tema (se guarda por dispositivo) ----------
const THEME_KEY = 'fitplan-theme';
const ACCENTS = { violeta: ['#6a1bf5', '#8f5bff', '#8a55ff', '#a77dff'], azul: ['#1d6ff2', '#4b8ef7', '#4d8ff7', '#79acff'], verde: ['#0f9d6c', '#2fbf8a', '#2fc28c', '#5ad8a8'], naranja: ['#e85d04', '#f48c2b', '#f7862c', '#ffa65c'], rosa: ['#d6246e', '#ec4f8f', '#ee5b97', '#ff86b5'] };
function themePrefs() { try { return { mode: 'auto', accent: 'violeta', ...JSON.parse(localStorage.getItem(THEME_KEY)) }; } catch (e) { return { mode: 'auto', accent: 'violeta' }; } }
function applyTheme() {
  const t = themePrefs();
  const root = document.documentElement;
  if (t.mode === 'auto') delete root.dataset.theme; else root.dataset.theme = t.mode;
  const dark = t.mode === 'dark' || (t.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const a = ACCENTS[t.accent] || ACCENTS.violeta;
  root.style.setProperty('--accent', dark ? a[2] : a[0]);
  root.style.setProperty('--accent-2', dark ? a[3] : a[1]);
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${dark ? a[2] : a[0]} ${dark ? 22 : 12}%, ${dark ? '#17171d' : '#fff'})`);
  root.style.setProperty('--lavender', `color-mix(in srgb, ${dark ? a[2] : a[0]} ${dark ? 35 : 22}%, ${dark ? '#17171d' : '#fff'})`);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = a[0];
}
applyTheme();
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

let state = load();
let view = state.profile ? 'hoy' : 'perfil';
let currentDate = todayKey();
let ui = {
  foodQuery: '', foodCat: 'Todas', selFood: null, meal: guessMeal(),
  recipeTab: 'recetas', recipeType: 'todas', recipeTag: 'todas', suggest: null,
  rutTab: 'rutina', exQuery: '', exGroup: 'todos', exEquip: 'todos', sumRange: 7, cmp: [], progTab: 'peso',
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === 'object') return { ...EMPTY(), ...s };
  } catch (e) { /* almacenamiento no disponible */ }
  return EMPTY();
}
function save() {
  state._ts = Date.now();
  checkBadges();
  persist();
  if (window.FitSync) window.FitSync.notify();
}
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
}
// Puente para sync.js: leer el estado y reemplazarlo con los datos de la nube
window.__fitplan = {
  get: () => state,
  replace(s) { state = { ...EMPTY(), ...s }; persist(); render(); },
};
function day(key = currentDate) {
  if (!state.days[key]) state.days[key] = { foods: [], exercises: [], water: 0 };
  return state.days[key];
}
function peekDay(key) { return state.days[key] || { foods: [], exercises: [], water: 0 }; }

// ---------- Utilidades ----------
function todayKey(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function shiftKey(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return todayKey(d); }
function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }
function prettyDate(k) {
  if (k === todayKey()) return 'Hoy';
  if (k === shiftKey(todayKey(), -1)) return 'Ayer';
  return parseKey(k).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });
}
function shortDate(k) { return parseKey(k).toLocaleDateString('es', { day: 'numeric', month: 'short' }); }
function guessMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'desayuno';
  if (h < 16) return 'almuerzo';
  if (h < 18) return 'snack';
  return 'cena';
}
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
function allRecipes() { return [...RECIPES, ...state.customRecipes]; }
function allFoods() { return [...FOODS, ...state.customFoods]; }
function foodById(id) { return allFoods().find(f => f.id === id); }
// La biblioteca de ejercicios (≈700 KB) se carga solo cuando hace falta
function exDB() { return typeof EXERCISE_DB !== 'undefined' ? EXERCISE_DB : []; }
function exReady() { return typeof EXERCISE_DB !== 'undefined'; }
function loadExercises() {
  if (exReady()) return Promise.resolve();
  if (!loadExercises.p) {
    loadExercises.p = new Promise((ok, fail) => {
      const sc = document.createElement('script');
      sc.src = 'exercises.js';
      sc.onload = ok;
      sc.onerror = () => { loadExercises.p = null; fail(); };
      document.head.appendChild(sc);
    });
  }
  return loadExercises.p;
}
const EX_VIEWS = ['rutinas', 'progreso'];
function exById(id) { return exDB().find(e => e.id === id); }
function ytUrl(q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}
function tabs(name, current, items) {
  return `<div class="tabs" role="tablist">${items.map(([id, label]) =>
    `<button role="tab" class="${id === current ? 'active' : ''}" data-tab-${name}="${id}">${label}</button>`).join('')}</div>`;
}

// ---------- Modal ----------
function openModal(html, onBind) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal-back';
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="icon-btn modal-x" aria-label="Cerrar">✕</button>${html}</div>`;
  document.body.appendChild(m);
  document.body.style.overflow = 'hidden';
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  m.querySelector('.modal-x').addEventListener('click', closeModal);
  onBind && onBind(m);
}
function closeModal() {
  const m = $('.modal-back');
  if (!m) return;
  if (m._cleanup) m._cleanup();
  m.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ---------- Rachas y logros ----------
const logged = k => { const d = state.days[k]; return !!(d && d.foods.length); };
// Días seguidos registrando comidas (si hoy aún no registras, cuenta desde ayer)
function streak() {
  let k = todayKey();
  if (!logged(k)) k = shiftKey(k, -1);
  let n = 0;
  while (logged(k)) { n++; k = shiftKey(k, -1); }
  return n;
}
function bestStreak() {
  const ks = Object.keys(state.days).filter(logged).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of ks) { cur = prev && daysBetween(prev, k) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = k; }
  return best;
}
function dayInGoal(k, tg) {
  const d = state.days[k];
  if (!d || !d.foods.length) return false;
  const t = totals(d);
  return t.kcal <= tg.kcal + t.burned && t.kcal >= (tg.kcal + t.burned) * 0.7;
}
const BADGES = [
  { id: 'inicio', ico: '🌱', name: 'Primer paso', desc: 'Registra tu primera comida', test: () => Object.keys(state.days).some(logged) },
  { id: 'racha3', ico: '🔥', name: 'En racha', desc: '3 días seguidos registrando', test: () => bestStreak() >= 3 },
  { id: 'racha7', ico: '⚡', name: 'Semana perfecta', desc: '7 días seguidos registrando', test: () => bestStreak() >= 7 },
  { id: 'racha30', ico: '👑', name: 'Imparable', desc: '30 días seguidos registrando', test: () => bestStreak() >= 30 },
  { id: 'meta7', ico: '🎯', name: 'En la meta', desc: '7 días dentro de tu meta de calorías', test: () => { const tg = calcTargets(); return Object.keys(state.days).filter(k => dayInGoal(k, tg)).length >= 7; } },
  { id: 'agua7', ico: '💧', name: 'Bien hidratado', desc: '7 días cumpliendo tu meta de agua', test: () => { const w = calcTargets().water; return Object.values(state.days).filter(d => d.water >= w).length >= 7; } },
  { id: 'entreno1', ico: '💪', name: 'Primer entrenamiento', desc: 'Completa un entrenamiento en modo entrenamiento', test: () => state.workouts.length >= 1 },
  { id: 'entreno10', ico: '🏋️', name: 'Constante', desc: '10 entrenamientos completados', test: () => state.workouts.length >= 10 },
  { id: 'entreno50', ico: '🦾', name: 'Bestia', desc: '50 entrenamientos completados', test: () => state.workouts.length >= 50 },
  { id: 'activo20', ico: '🏃', name: 'Activo', desc: '20 días con ejercicio registrado', test: () => Object.values(state.days).filter(d => d.exercises.length).length >= 20 },
  { id: 'record', ico: '🏆', name: 'Récord personal', desc: 'Supera tu mejor marca en un ejercicio', test: () => strengthStats().some(x => x.pts.length >= 2 && Math.max(...x.pts.slice(1).map(q => q.v)) > x.pts[0].v) },
  { id: 'pesaje10', ico: '⚖️', name: 'Bajo control', desc: 'Registra tu peso 10 veces', test: () => state.weights.length >= 10 },
  { id: 'cambio2', ico: '📉', name: 'Resultados', desc: 'Avanza 2 kg hacia tu objetivo', test: () => {
    const ws = [...state.weights].sort((a, b) => a.d.localeCompare(b.d));
    if (ws.length < 2 || !state.profile) return false;
    const ch = ws[ws.length - 1].kg - ws[0].kg, obj = state.profile.objetivo;
    return obj === 'perder' ? ch <= -2 : obj === 'ganar' ? ch >= 2 : false;
  } },
  { id: 'chef', ico: '👩‍🍳', name: 'Chef', desc: 'Crea tu primera receta', test: () => state.customRecipes.length >= 1 },
  { id: 'plan', ico: '🗓️', name: 'Organizado', desc: 'Genera un plan semanal de comidas', test: () => !!state.plan },
];
function checkBadges() {
  if (!state.profile) return;
  const fresh = BADGES.filter(b => !state.badges.includes(b.id) && b.test());
  if (!fresh.length) return;
  state.badges = [...state.badges, ...fresh.map(b => b.id)];
  setTimeout(() => { toast(`🏅 Logro desbloqueado: ${fresh[0].name}${fresh.length > 1 ? ` y ${fresh.length - 1} más` : ''}`); confetti(); }, 2500);
}

// ---------- Cálculos ----------
function currentWeight() {
  const w = [...state.weights].sort((a, b) => a.d.localeCompare(b.d));
  return w.length ? w[w.length - 1].kg : state.profile ? state.profile.peso : 70;
}
function calcTargets(p = state.profile) {
  if (!p) return null;
  const peso = currentWeight();
  const bmr = 10 * peso + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'h' ? 5 : -161);
  const tdee = bmr * p.actividad;
  const goal = GOALS[p.objetivo];
  const diet = DIETS[p.dieta || 'equilibrada'];
  const ajuste = p.autoAjuste ? state.ajuste : 0;
  const kcal = Math.max(p.sexo === 'h' ? 1500 : 1200, tdee + goal.adj + ajuste);
  const prot = (goal.protPerKg + (diet.protBonus || 0)) * peso;
  const fat = (kcal * diet.fatPct) / 9;
  const carb = Math.max(0, (kcal - prot * 4 - fat * 9) / 4);
  const imc = peso / Math.pow(p.altura / 100, 2);
  const water = Math.round((peso * 35) / 250); // vasos de 250 ml
  return { bmr, tdee, kcal, prot, fat, carb, imc, water, peso, ajuste };
}
function totals(d) {
  const t = { kcal: 0, p: 0, c: 0, g: 0, burned: 0 };
  d.foods.forEach(f => { t.kcal += f.kcal; t.p += f.p; t.c += f.c; t.g += f.g; });
  d.exercises.forEach(e => { t.burned += e.kcal; });
  return t;
}
function nutrition(food, grams) {
  const k = grams / 100;
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, g: food.g * k };
}
function recipeNutrition(recipe, factor = 1) {
  const t = { kcal: 0, p: 0, c: 0, g: 0 };
  recipe.ing.forEach(([id, grams]) => {
    const f = foodById(id);
    if (!f) return;
    const n = nutrition(f, grams * factor);
    t.kcal += n.kcal; t.p += n.p; t.c += n.c; t.g += n.g;
  });
  return t;
}
function burnedKcal(met, minutes) { return met * currentWeight() * (minutes / 60); }
function imcLabel(imc) {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  return 'Obesidad';
}
// Tendencia de peso: pendiente (kg/semana) por regresión lineal de los últimos 28 días
function weightTrend() {
  const w = [...state.weights].sort((a, b) => a.d.localeCompare(b.d));
  if (w.length < 3) return null;
  const last = w[w.length - 1].d;
  const pts = w.filter(x => daysBetween(x.d, last) <= 28);
  if (pts.length < 3 || daysBetween(pts[0].d, last) < 10) return null;
  const xs = pts.map(x => daysBetween(pts[0].d, x.d)), ys = pts.map(x => x.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? (num / den) * 7 : null;
}
// Ajuste automático: compara el ritmo real con el esperado y corrige la meta (máx. ±200 kcal por vez, ±600 en total)
function autoAdjust(force = false) {
  const p = state.profile;
  if (!p || !p.autoAjuste) return null;
  if (!force && state.lastAdjust && daysBetween(state.lastAdjust, todayKey()) < 7) return null;
  const rate = weightTrend();
  if (rate === null) return null;
  const expected = GOALS[p.objetivo].rate;
  const diff = rate - expected; // kg/semana por sobre lo esperado
  if (Math.abs(diff) < 0.1) { state.lastAdjust = todayKey(); return 0; }
  const step = Math.max(-200, Math.min(200, -diff * 7700 / 7));
  state.ajuste = Math.max(-600, Math.min(600, Math.round((state.ajuste + step) / 10) * 10));
  state.lastAdjust = todayKey();
  return step;
}
function bodyFat(m, p) {
  if (!m || !m.cintura || !m.cuello) return null;
  const h = p.altura;
  if (p.sexo === 'h') {
    if (m.cintura <= m.cuello) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(m.cintura - m.cuello) + 0.15456 * Math.log10(h)) - 450;
  }
  if (!m.cadera || m.cintura + m.cadera <= m.cuello) return null;
  return 495 / (1.29579 - 0.35004 * Math.log10(m.cintura + m.cadera - m.cuello) + 0.221 * Math.log10(h)) - 450;
}

// ---------- Navegación ----------
$$('.nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
// Cualquier botón con data-go navega (delegado: sirve para todas las vistas y modales)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { e.preventDefault(); closeModal(); go(b.dataset.go); }
});
// Encabezado común de cada sección, con acceso a Perfil
function pageHead(title, sub = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button class="round-btn" data-go="perfil" aria-label="Perfil y ajustes">⚙️</button></div>`;
}
function go(v) {
  if (v === 'ejercicio') { ui.rutTab = 'actividad'; v = 'rutinas'; }
  view = v;
  render();
  window.scrollTo(0, 0);
  animateEnter();
}
// Las animaciones de entrada solo corren al cambiar de vista, no en cada redibujado
function animateEnter() {
  const m = $('#main');
  m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
  m.querySelectorAll('[data-count]').forEach(el => {
    const end = Number(el.dataset.count), t0 = performance.now(), suffix = el.dataset.suffix || '';
    const step = now => {
      const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end * e) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  clearTimeout(animateEnter._t);
  animateEnter._t = setTimeout(() => m.classList.remove('enter'), 900);
}
function confetti(n = 60) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const cols = ['var(--accent)', 'var(--prot)', 'var(--carb)', 'var(--fat)', 'var(--burn)', '#f5b301'];
  box.innerHTML = Array.from({ length: n }, () => `<i style="left:${Math.random() * 100}%;background:${cols[Math.floor(Math.random() * cols.length)]};animation-delay:${Math.random() * 0.4}s;animation-duration:${1.6 + Math.random() * 1.2}s;--x:${(Math.random() - 0.5) * 200}px;--r:${Math.random() * 720}deg"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3400);
}
const tap = () => { if (navigator.vibrate) navigator.vibrate(12); };
function render() {
  const views = { hoy: viewHoy, comidas: viewComidas, ejercicio: viewEjercicio, recetas: viewRecetas, rutinas: viewRutinas, progreso: viewProgreso, perfil: viewPerfil };
  if (!state.profile && view !== 'perfil') view = 'perfil';
  if (EX_VIEWS.includes(view) && !(view === 'rutinas' && ui.rutTab === 'actividad') && !exReady()) {
    $('#main').innerHTML = '<div class="loading"><div class="spinner"></div><p class="muted">Cargando ejercicios…</p></div>';
    const v = view;
    loadExercises().then(() => { if (view === v) { render(); animateEnter(); } }).catch(() => {
      if (view === v) $('#main').innerHTML = '<div class="loading"><p>No pude cargar los ejercicios. Revisa tu conexión.</p><button class="btn" onclick="location.reload()">Reintentar</button></div>';
    });
    return;
  }
  $('#main').innerHTML = views[view]();
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  bind[view] && bind[view]();
}
function dateBar() {
  const today = todayKey();
  const isToday = currentDate === today;
  const d = parseKey(currentDate);
  const monday = shiftKey(currentDate, -((d.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => shiftKey(monday, i));
  const month = parseKey(currentDate).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  const days = week.map((k, i) => {
    const pd = peekDay(k);
    const has = pd.foods.length || pd.exercises.length;
    return `<button class="wk-day ${k === currentDate ? 'sel' : ''} ${k === today ? 'today' : ''} ${has ? 'has' : ''}" data-day="${k}" ${k > today ? 'disabled' : ''} aria-label="${esc(prettyDate(k))}">
      <span class="dw">${'LMMJVSD'[i]}</span><span class="dn">${parseKey(k).getDate()}</span><span class="dot"></span></button>`;
  }).join('');
  return `<div class="weekstrip">
    <div class="wk-head">
      <span class="wk-month">${esc(month)}</span>
      <div class="wk-nav">
        ${isToday ? '' : '<button class="today-btn" data-shift="0">Hoy</button>'}
        <button data-shift="-7" aria-label="Semana anterior">‹</button>
        <button data-shift="7" aria-label="Semana siguiente" ${shiftKey(monday, 7) > today ? 'disabled' : ''}>›</button>
      </div>
    </div>
    <div class="wk-days">${days}</div>
  </div>`;
}
function bindDateBar() {
  $$('[data-shift]').forEach(b => b.addEventListener('click', () => {
    const n = Number(b.dataset.shift);
    currentDate = n === 0 ? todayKey() : shiftKey(currentDate, n);
    if (currentDate > todayKey()) currentDate = todayKey();
    render();
  }));
  $$('[data-day]').forEach(b => b.addEventListener('click', () => { currentDate = b.dataset.day; render(); }));
}
// Tile de métrica: etiqueta, ícono en círculo y número grande con unidad
function tile(label, value, unit, ico, cls = '', style = '') {
  return `<div class="stat ${cls}"><div class="label">${label}</div><span class="tile-ico" aria-hidden="true">${ico}</span><div class="value"${style ? ` style="${style}"` : ''}>${value} <span class="unit">${unit}</span></div></div>`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}
const MEAL_ICO = { desayuno: '🍳', almuerzo: '🍲', cena: '🥗', snack: '🍎' };
const ACT_ICO = { caminar: '🚶', caminarrapido: '🚶‍♂️', trotar: '🏃', correr: '🏃‍♂️', correrrapido: '⚡', bici: '🚴', biciestatica: '🚲', pesas: '🏋️', pesasintenso: '💪', hiit: '🔥', natacion: '🏊', futbol: '⚽', basket: '🏀', tenis: '🎾', yoga: '🧘', pilates: '🤸', baile: '💃', eliptica: '🦿', cuerda: '🪢', escaleras: '🪜', boxeo: '🥊', casa: '🧹', trekking: '🥾', spinning: '🚴‍♀️', crossfit: '🏋️‍♀️', calistenia: '🤸‍♂️', remo: '🚣', stepper: '🪜', aerobicos: '🕺', nadarintenso: '🏊‍♂️', voleibol: '🏐', escalada: '🧗', artesmarciales: '🥋', patinar: '⛸️', skate: '🛹', surf: '🏄', kayak: '🛶', golf: '⛳', cueca: '💃', estirar: '🧘‍♂️', perro: '🐕', jardin: '🌱', mudanza: '📦', bicicletaurbana: '🚲' };
const bind = {};
