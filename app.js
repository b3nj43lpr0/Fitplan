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
const EMPTY = () => ({ profile: null, days: {}, customFoods: [], routine: null, weights: [], measures: [], plan: null, ajuste: 0, lastAdjust: null });

let state = load();
let view = state.profile ? 'hoy' : 'perfil';
let currentDate = todayKey();
let ui = {
  foodQuery: '', foodCat: 'Todas', selFood: null, meal: guessMeal(),
  recipeTab: 'recetas', recipeType: 'todas', recipeTag: 'todas', suggest: null,
  rutTab: 'rutina', exQuery: '', exGroup: 'todos', exEquip: 'todos',
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === 'object') return { ...EMPTY(), ...s };
  } catch (e) { /* almacenamiento no disponible */ }
  return EMPTY();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
}
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
function allFoods() { return [...FOODS, ...state.customFoods]; }
function foodById(id) { return allFoods().find(f => f.id === id); }
function exById(id) { return EXERCISE_DB.find(e => e.id === id); }
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
function go(v) {
  view = v;
  render();
  window.scrollTo(0, 0);
}
function render() {
  const views = { hoy: viewHoy, comidas: viewComidas, ejercicio: viewEjercicio, recetas: viewRecetas, rutinas: viewRutinas, progreso: viewProgreso, perfil: viewPerfil };
  if (!state.profile && view !== 'perfil') view = 'perfil';
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
const ACT_ICO = { caminar: '🚶', caminarrapido: '🚶‍♂️', trotar: '🏃', correr: '🏃‍♂️', correrrapido: '⚡', bici: '🚴', biciestatica: '🚲', pesas: '🏋️', pesasintenso: '💪', hiit: '🔥', natacion: '🏊', futbol: '⚽', basket: '🏀', tenis: '🎾', yoga: '🧘', pilates: '🤸', baile: '💃', eliptica: '🦿', cuerda: '🪢', escaleras: '🪜', boxeo: '🥊', casa: '🧹' };
const bind = {};

// ---------- Vista: Hoy ----------
function ring(value, max, color, size = 170, stroke = 14, track = 'var(--soft)') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
  </svg>`;
}
function macroRing(label, val, goal, color) {
  return `<div class="mring">
    <div class="ring">${ring(val, goal, color, 96, 10)}<div class="center"><span class="big">${r0(val)}</span></div></div>
    <div class="lbl"><i style="background:${color}"></i>${label}</div>
    <div class="of">de ${r0(goal)} g</div>
  </div>`;
}
function macroBar(label, val, goal, color) {
  const pct = Math.min(100, goal > 0 ? (val / goal) * 100 : 0);
  return `<div>
    <div class="row small"><span><b>${label}</b></span><span class="muted">${r0(val)} / ${r0(goal)} g</span></div>
    <div class="bar"><span style="width:${pct}%;background:${color}"></span></div>
  </div>`;
}
function viewHoy() {
  const tg = calcTargets();
  const d = peekDay(currentDate);
  const t = totals(d);
  const budget = tg.kcal + t.burned;
  const left = budget - t.kcal;
  const over = left < 0;

  const meals = MEALS.map(m => {
    const items = d.foods.filter(f => f.meal === m.id);
    const sum = items.reduce((a, f) => a + f.kcal, 0);
    return `<div class="meal"><div class="meal-head"><h3><span class="ico-c">${MEAL_ICO[m.id] || '🍽️'}</span>${m.name}</h3><span class="muted small">${r0(sum)} kcal</span></div>
      <div class="list">${items.length ? items.map(f => `
        <div class="item">
          <div class="info"><div class="name">${esc(f.name)}</div><div class="muted small">${f.grams ? r0(f.grams) + ' g · ' : ''}P ${r0(f.p)} · C ${r0(f.c)} · G ${r0(f.g)}</div></div>
          <span class="kcal">${r0(f.kcal)}</span>
          <button class="icon-btn" data-del-food="${f.id}" aria-label="Eliminar">✕</button>
        </div>`).join('') : '<div class="empty">Sin registros</div>'}</div></div>`;
  }).join('');

  const ex = d.exercises.length ? d.exercises.map(e => `
    <div class="item">
      <div class="info"><div class="name">${esc(e.name)}</div><div class="muted small">${e.minutes ? e.minutes + ' min' : 'manual'}</div></div>
      <span class="kcal" style="color:var(--burn)">−${r0(e.kcal)}</span>
      <button class="icon-btn" data-del-ex="${e.id}" aria-label="Eliminar">✕</button>
    </div>`).join('') : '<div class="empty">Aún no registras ejercicio.</div>';

  const days = [];
  for (let i = 6; i >= 0; i--) days.push(shiftKey(currentDate, -i));
  const vals = days.map(k => { const tt = totals(peekDay(k)); return { k, kcal: tt.kcal, goal: tg.kcal + tt.burned }; });
  const maxV = Math.max(tg.kcal * 1.2, ...vals.map(v => v.kcal));
  const chart = vals.map(v => `<div class="col ${v.k === currentDate ? 'sel' : ''}">
      <span class="v">${v.kcal ? r0(v.kcal) : ''}</span>
      <div class="b ${!v.kcal ? 'zero' : v.kcal > v.goal ? 'over' : ''}" style="height:${(v.kcal / maxV) * 100}%"></div>
      <span class="lbl">${parseKey(v.k).toLocaleDateString('es', { weekday: 'short' }).slice(0, 3)}</span>
    </div>`).join('');

  const glasses = Array.from({ length: Math.max(tg.water, d.water) }, (_, i) =>
    `<button class="glass ${i < d.water ? 'full' : ''}" data-water="${i + 1}" aria-label="Vaso ${i + 1}"></button>`).join('');

  // Lo que dice el plan semanal para hoy
  const planDay = state.plan ? state.plan.days.find(x => x.date === currentDate) : null;
  const planHtml = planDay ? MEALS.map(m => {
    const pm = planDay.meals[m.id];
    const r = pm && RECIPES.find(x => x.id === pm.id);
    return r ? `<div class="item"><div class="info"><div class="muted small">${m.name}</div><div class="name">${esc(r.name)}</div></div>
      <span class="kcal">${r0(recipeNutrition(r, pm.f).kcal)}</span>
      <button class="btn ghost sm" data-log-recipe="${r.id}" data-factor="${pm.f}" data-meal="${m.id}">+ Agregar</button></div>` : '';
  }).join('') : '';

  return `
    <div class="hello">
      <div class="avatar" aria-hidden="true">${esc((state.profile.nombre || 'T').trim().charAt(0).toUpperCase())}</div>
      <div class="who"><div class="greet">${greeting()} 👋</div><div class="name">${esc(state.profile.nombre || 'Hola')}</div></div>
      <button class="round-btn" data-go="perfil" aria-label="Perfil">⚙️</button>
    </div>
    ${dateBar()}
    <div class="hero">
      <div class="ring">${ring(t.kcal, budget, over ? 'var(--danger)' : '#a77dff', 150, 14, 'rgba(255,255,255,.12)')}
        <div class="center"><span class="big">${budget > 0 ? Math.round(Math.min(999, t.kcal / budget * 100)) : 0}%</span><span class="muted small">consumido</span></div>
      </div>
      <div class="hero-text">
        <div class="hero-title">${over ? `Te pasaste por ${r0(-left)} kcal` : `Te quedan ${r0(left)} kcal`}</div>
        <div class="hero-sub">${currentDate === todayKey() ? 'Hoy' : esc(prettyDate(currentDate))} · meta ${r0(tg.kcal)} kcal${t.burned ? ` + ${r0(t.burned)} de ejercicio` : ''}</div>
        <div class="hero-stats">
          <div><b>${r0(t.kcal)}</b><span>consumidas</span></div>
          <div><b>${r0(t.burned)}</b><span>quemadas</span></div>
          <div><b>${r0(tg.tdee + t.burned)}</b><span>gasto total</span></div>
        </div>
        ${tg.ajuste ? `<span class="pill">Ajuste automático ${tg.ajuste > 0 ? '+' : ''}${tg.ajuste} kcal</span>` : ''}
      </div>
    </div>
    <div class="grid g4" style="margin-bottom:16px">
      ${tile('Objetivo', r0(tg.kcal), 'kcal', '🎯')}
      ${tile('Consumidas', r0(t.kcal), 'kcal', '🍽️', 'accent')}
      ${tile('Quemadas', r0(t.burned), 'kcal', '🔥', 'burn')}
      ${tile('Agua', d.water, `/ ${tg.water} vasos`, '💧')}
    </div>
    <div class="card">
      <div class="row"><h2>Macros del día</h2><button class="see" data-go="recetas">Ver recetas ›</button></div>
      <div class="rings3">
        ${macroRing('Proteína', t.p, tg.prot, 'var(--prot)')}
        ${macroRing('Carbos', t.c, tg.carb, 'var(--carb)')}
        ${macroRing('Grasas', t.g, tg.fat, 'var(--fat)')}
      </div>
    </div>
    <div class="grid g2">
      <div>
        <div class="card">
          <div class="row"><h2>Comidas</h2><button class="btn sm" data-go="comidas">+ Agregar</button></div>
          ${meals}
        </div>
        ${planHtml ? `<div class="card"><div class="row"><h2>Tu plan para hoy</h2><button class="btn ghost sm" data-go="recetas">Ver plan</button></div><div class="list">${planHtml}</div></div>` : ''}
      </div>
      <div>
        <div class="card">
          <div class="row"><h2>Ejercicio</h2><button class="btn sm burn" data-go="ejercicio">+ Agregar</button></div>
          <div class="list">${ex}</div>
        </div>
        <div class="card">
          <div class="row"><h2>Agua</h2><span class="muted small">${d.water} / ${tg.water} vasos (250 ml)</span></div>
          <div class="water">${glasses}</div>
        </div>
        <div class="card">
          <div class="row"><h2>Últimos 7 días</h2><button class="see" data-go="progreso">Ver progreso ›</button></div>
          <div class="chart">${chart}</div>
          <div class="legend"><span><i style="background:var(--carb)"></i>Dentro de tu meta</span><span><i style="background:var(--prot)"></i>Te pasaste</span></div>
        </div>
        <div class="card">
          <h2>¿Qué como ahora?</h2>
          <p class="muted small" style="margin-top:0">${over ? 'Ya alcanzaste tu objetivo. Si tienes hambre, elige algo liviano y alto en proteína.' : `Te quedan ${r0(left)} kcal y ${r0(Math.max(0, tg.prot - t.p))} g de proteína por cubrir.`}</p>
          <button class="btn ghost" data-go="recetas">Ver sugerencias de recetas →</button>
        </div>
      </div>
    </div>`;
}
bind.hoy = () => {
  bindDateBar();
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $$('[data-del-food]').forEach(b => b.addEventListener('click', () => {
    const d = day(); d.foods = d.foods.filter(f => f.id !== b.dataset.delFood); save(); render();
  }));
  $$('[data-del-ex]').forEach(b => b.addEventListener('click', () => {
    const d = day(); d.exercises = d.exercises.filter(e => e.id !== b.dataset.delEx); save(); render();
  }));
  $$('[data-water]').forEach(b => b.addEventListener('click', () => {
    const d = day(); const n = Number(b.dataset.water);
    d.water = d.water === n ? n - 1 : n; save(); render();
  }));
  bindLogRecipe(currentDate);
};

// ---------- Vista: Comidas ----------
function viewComidas() {
  const cats = ['Todas', ...new Set(allFoods().map(f => f.cat))];
  const q = norm(ui.foodQuery.trim());
  const list = allFoods().filter(f =>
    (ui.foodCat === 'Todas' || f.cat === ui.foodCat) && (!q || norm(f.name).includes(q)));
  const shown = list.slice(0, 120);
  const sel = ui.selFood ? foodById(ui.selFood) : null;

  return `
    <h1>Comidas</h1>
    <p class="sub">Busca entre ${allFoods().length} alimentos o escanea un producto, mira sus calorías y agrégalo a tu día.</p>
    ${dateBar()}
    <div class="grid g2">
      <div class="card">
        <div class="search-row">
          <input id="foodSearch" type="search" placeholder="Buscar: pollo, arroz, plátano…" value="${esc(ui.foodQuery)}" autocomplete="off">
          <button class="btn" id="scanBtn" title="Escanear código de barras">📷 Escanear</button>
        </div>
        <div class="chips scroll-x">${cats.map(c => `<button class="chip ${c === ui.foodCat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <div class="list scroll" id="foodList">
          ${shown.length ? shown.map(f => `
            <div class="item food-row ${ui.selFood === f.id ? 'sel' : ''}" data-food="${f.id}">
              <div class="info"><div class="name">${esc(f.name)}</div><div class="muted small">por 100 g · P ${r1(f.p)} · C ${r1(f.c)} · G ${r1(f.g)}</div></div>
              <span class="kcal">${r0(f.kcal)} <span class="muted small">kcal</span></span>
            </div>`).join('') : '<div class="empty">No encontré ese alimento. Puedes escanearlo o crearlo abajo.</div>'}
          ${list.length > shown.length ? `<div class="empty">Mostrando 120 de ${list.length}. Escribe para filtrar.</div>` : ''}
        </div>
      </div>
      <div>
        <div class="card" id="addBox">
          ${sel ? `
            <h2>${esc(sel.name)}</h2>
            ${sel.brand ? `<p class="muted small" style="margin-top:-8px">${esc(sel.brand)}</p>` : ''}
            <div class="chips">
              <button class="chip" data-grams="100">100 g</button>
              ${sel.por ? `<button class="chip" data-grams="${sel.por}">1 porción (${sel.por} g)</button><button class="chip" data-grams="${sel.por * 2}">2 porciones</button>` : ''}
            </div>
            <div class="grid g2" style="gap:10px">
              <div class="field"><label for="grams">Cantidad (g)</label><input id="grams" type="number" min="1" value="${sel.por || 100}" inputmode="decimal"></div>
              <div class="field"><label for="meal">Comida</label><select id="meal">${MEALS.map(m => `<option value="${m.id}" ${m.id === ui.meal ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
            </div>
            <div class="result-box" id="preview"></div>
            <button class="btn" id="addFood" style="width:100%">Agregar a ${esc(prettyDate(currentDate).toLowerCase())}</button>
          ` : '<h2>Selecciona un alimento</h2><p class="muted">Toca cualquier alimento de la lista para ver cuántas calorías tiene según la cantidad.</p>'}
        </div>
        <div class="card">
          <h2>Crear alimento propio</h2>
          <p class="muted small" style="margin-top:-6px">Copia los datos de la etiqueta nutricional (por 100 g).</p>
          <div class="field"><label for="cfName">Nombre</label><input id="cfName" placeholder="Ej: Barra de cereal X"></div>
          <div class="grid g4" style="gap:8px">
            <div class="field"><label for="cfKcal">kcal</label><input id="cfKcal" type="number" min="0"></div>
            <div class="field"><label for="cfP">Prot.</label><input id="cfP" type="number" min="0"></div>
            <div class="field"><label for="cfC">Carb.</label><input id="cfC" type="number" min="0"></div>
            <div class="field"><label for="cfG">Grasa</label><input id="cfG" type="number" min="0"></div>
          </div>
          <button class="btn ghost" id="cfSave">Guardar alimento</button>
        </div>
        <div class="card">
          <h2>Registro rápido</h2>
          <p class="muted small" style="margin-top:-6px">¿Comiste algo y solo sabes las calorías?</p>
          <div class="grid g2" style="gap:8px">
            <div class="field"><label for="qName">Descripción</label><input id="qName" placeholder="Ej: Completo"></div>
            <div class="field"><label for="qKcal">kcal</label><input id="qKcal" type="number" min="0"></div>
          </div>
          <button class="btn ghost" id="qAdd">Agregar</button>
        </div>
      </div>
    </div>`;
}
bind.comidas = () => {
  bindDateBar();
  const search = $('#foodSearch');
  search.addEventListener('input', () => {
    ui.foodQuery = search.value;
    const pos = search.selectionStart;
    render();
    const s = $('#foodSearch'); s.focus(); s.setSelectionRange(pos, pos);
  });
  $('#scanBtn').addEventListener('click', openScanner);
  $$('[data-cat]').forEach(b => b.addEventListener('click', () => { ui.foodCat = b.dataset.cat; render(); }));
  $$('[data-food]').forEach(r => r.addEventListener('click', () => {
    ui.selFood = r.dataset.food; render();
    if (window.innerWidth <= 760) $('#addBox').scrollIntoView({ behavior: 'smooth' });
  }));
  if ($('#grams')) {
    const sel = foodById(ui.selFood);
    const upd = () => {
      const g = Number($('#grams').value) || 0;
      const n = nutrition(sel, g);
      $('#preview').innerHTML = `<div class="row"><b style="font-size:22px">${r0(n.kcal)} kcal</b><span class="muted small">${g} g</span></div>
        <div class="macro-pills" style="margin:6px 0 0"><span>Proteína <b>${r1(n.p)} g</b></span><span>Carbs <b>${r1(n.c)} g</b></span><span>Grasa <b>${r1(n.g)} g</b></span></div>`;
    };
    $('#grams').addEventListener('input', upd);
    $$('[data-grams]').forEach(b => b.addEventListener('click', () => { $('#grams').value = b.dataset.grams; upd(); }));
    $('#meal').addEventListener('change', e => { ui.meal = e.target.value; });
    upd();
    $('#addFood').addEventListener('click', () => {
      const g = Number($('#grams').value);
      if (!(g > 0)) return toast('Ingresa una cantidad válida');
      const n = nutrition(sel, g);
      day().foods.push({ id: uid(), foodId: sel.id, name: sel.name, grams: g, meal: $('#meal').value, ...n });
      save(); toast(`Agregado: ${sel.name} (${r0(n.kcal)} kcal)`); render();
    });
  }
  $('#cfSave').addEventListener('click', () => {
    const name = $('#cfName').value.trim();
    const kcal = Number($('#cfKcal').value);
    if (!name || $('#cfKcal').value === '' || !(kcal >= 0)) return toast('Completa al menos nombre y kcal');
    const f = { id: 'c_' + uid(), name, cat: 'Mis alimentos', kcal, p: Number($('#cfP').value) || 0, c: Number($('#cfC').value) || 0, g: Number($('#cfG').value) || 0 };
    state.customFoods.push(f); ui.selFood = f.id; ui.foodCat = 'Todas'; ui.foodQuery = '';
    save(); toast('Alimento guardado'); render();
  });
  $('#qAdd').addEventListener('click', () => {
    const kcal = Number($('#qKcal').value);
    if (!(kcal > 0)) return toast('Ingresa las calorías');
    day().foods.push({ id: uid(), name: $('#qName').value.trim() || 'Registro rápido', grams: 0, meal: ui.meal, kcal, p: 0, c: 0, g: 0 });
    save(); toast('Agregado'); render();
  });
};

// ---------- Escáner de código de barras (Open Food Facts) ----------
function openScanner() {
  openModal(`
    <h2>Escanear código de barras</h2>
    <p class="muted small" style="margin-top:-6px">Apunta la cámara al código del envase. Los datos vienen de Open Food Facts (necesita internet).</p>
    <div class="scan-box"><video id="scanVideo" playsinline muted></video><div class="scan-line"></div></div>
    <p class="muted small" id="scanStatus">Iniciando cámara…</p>
    <div class="search-row">
      <input id="scanCode" inputmode="numeric" placeholder="O escribe el número del código">
      <button class="btn" id="scanSearch">Buscar</button>
    </div>
    <div id="scanResult"></div>`, m => {
    let stopped = false, stream = null, reader = null, timer = null;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      if (reader) try { reader.reset(); } catch (e) { /* ignorar */ }
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
    m._cleanup = stop;
    const found = code => { if (stopped) return; stop(); m.querySelector('#scanCode').value = code; lookupBarcode(code, m); };
    m.querySelector('#scanSearch').addEventListener('click', () => {
      const code = m.querySelector('#scanCode').value.replace(/\D/g, '');
      if (code.length < 6) return toast('Escribe un código válido');
      stop(); lookupBarcode(code, m);
    });
    const status = t => { const s = m.querySelector('#scanStatus'); if (s) s.textContent = t; };
    const video = m.querySelector('#scanVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status('Este navegador no permite usar la cámara aquí. Escribe el código a mano.');
      return;
    }
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s; video.srcObject = s; video.play(); status('Buscando código…');
        timer = setInterval(() => {
          if (video.readyState < 2) return;
          det.detect(video).then(r => { if (r.length) found(r[0].rawValue); }).catch(() => {});
        }, 300);
      }).catch(() => status('No pude abrir la cámara. Revisa los permisos o escribe el código.'));
    } else if (window.ZXing) {
      reader = new window.ZXing.BrowserMultiFormatReader();
      status('Buscando código…');
      reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, res => { if (res) found(res.getText()); })
        .catch(() => status('No pude abrir la cámara. Revisa los permisos o escribe el código.'));
    } else {
      status('No pude cargar el lector. Escribe el código a mano.');
    }
  });
}
function lookupBarcode(code, m) {
  const box = m.querySelector('#scanResult');
  const existing = state.customFoods.find(f => f.id === 'off_' + code);
  if (existing) { closeModal(); ui.selFood = existing.id; ui.foodQuery = ''; ui.foodCat = 'Todas'; render(); return; }
  box.innerHTML = '<p class="muted">Buscando producto…</p>';
  fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity,image_front_small_url`)
    .then(r => r.json())
    .then(j => {
      const p = j && j.product;
      const n = p && p.nutriments;
      const kcal = n && (n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined));
      if (!p || kcal === undefined) {
        box.innerHTML = `<div class="result-box">No encontré el producto ${esc(code)} en Open Food Facts. Puedes crearlo con los datos de la etiqueta en "Crear alimento propio".</div>`;
        return;
      }
      const f = {
        id: 'off_' + code, name: p.product_name_es || p.product_name || 'Producto ' + code, brand: p.brands || '', cat: 'Escaneados',
        kcal: r0(kcal), p: r1(n.proteins_100g || 0), c: r1(n.carbohydrates_100g || 0), g: r1(n.fat_100g || 0),
      };
      if (p.serving_quantity > 0) f.por = r0(Number(p.serving_quantity));
      box.innerHTML = `<div class="result-box">
        <div class="row">${p.image_front_small_url ? `<img src="${esc(p.image_front_small_url)}" alt="" class="prod-img">` : ''}<div style="flex:1"><b>${esc(f.name)}</b><div class="muted small">${esc(f.brand)}</div></div></div>
        <div class="macro-pills" style="margin:8px 0">Por 100 g: <b>${f.kcal} kcal</b><span>P ${f.p} g</span><span>C ${f.c} g</span><span>G ${f.g} g</span></div>
        <button class="btn" id="offSave" style="width:100%">Usar este producto</button></div>`;
      box.querySelector('#offSave').addEventListener('click', () => {
        state.customFoods.push(f); save();
        closeModal(); ui.selFood = f.id; ui.foodQuery = ''; ui.foodCat = 'Todas'; render();
        toast('Producto guardado en "Escaneados"');
      });
    })
    .catch(() => { box.innerHTML = '<div class="result-box">No pude conectarme a Open Food Facts. Revisa tu conexión a internet.</div>'; });
}

// ---------- Vista: Ejercicio ----------
function viewEjercicio() {
  const d = peekDay(currentDate);
  const t = totals(d);
  return `
    <h1>Ejercicio</h1>
    <p class="sub">Registra tu actividad y calcula las calorías que quemaste según tu peso (${r1(currentWeight())} kg).</p>
    ${dateBar()}
    <div class="grid g2">
      <div class="card">
        <h2>Agregar actividad</h2>
        <input type="hidden" id="act" value="${ACTIVITIES[0].id}">
        <div class="act-grid" role="radiogroup" aria-label="Actividad">${ACTIVITIES.map((a, i) => `<button class="act ${i === 0 ? 'sel' : ''}" data-act="${a.id}" role="radio" aria-checked="${i === 0}"><span class="ae">${ACT_ICO[a.id] || '🏅'}</span>${esc(a.name)}</button>`).join('')}</div>
        <label for="mins">Duración (minutos)</label>
        <div class="chips">${[15, 30, 45, 60, 90].map(m => `<button class="chip ${m === 30 ? 'active' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>
        <div class="field"><input id="mins" type="number" min="1" value="30" inputmode="numeric" aria-label="Minutos"></div>
        <div class="result-box" id="burnPrev"></div>
        <button class="btn burn" id="addEx" style="width:100%">Registrar</button>
        <hr class="sep">
        <h3>¿Tu reloj ya te dio las calorías?</h3>
        <div class="grid g2" style="gap:8px">
          <div class="field"><label for="mxName">Actividad</label><input id="mxName" placeholder="Ej: Clase de spinning"></div>
          <div class="field"><label for="mxKcal">kcal quemadas</label><input id="mxKcal" type="number" min="0"></div>
        </div>
        <button class="btn ghost" id="mxAdd">Agregar</button>
      </div>
      <div class="card">
        <div class="row"><h2>Actividad del día</h2><b style="color:var(--burn)">${r0(t.burned)} kcal</b></div>
        <div class="list">${d.exercises.length ? d.exercises.map(e => `
          <div class="item">
            <div class="info"><div class="name">${esc(e.name)}</div><div class="muted small">${e.minutes ? e.minutes + ' min' : 'manual'}</div></div>
            <span class="kcal" style="color:var(--burn)">−${r0(e.kcal)}</span>
            <button class="icon-btn" data-del-ex="${e.id}" aria-label="Eliminar">✕</button>
          </div>`).join('') : '<div class="empty">Nada registrado todavía.</div>'}</div>
        <p class="muted small">Las calorías del ejercicio se suman a tu presupuesto del día: si quemas 300 kcal, puedes comer 300 kcal más y mantener tu objetivo.</p>
        <button class="btn ghost" data-go="rutinas">Ver mi rutina y la biblioteca de ejercicios →</button>
      </div>
    </div>`;
}
bind.ejercicio = () => {
  bindDateBar();
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  const upd = () => {
    const a = ACTIVITIES.find(x => x.id === $('#act').value);
    const m = Number($('#mins').value) || 0;
    $('#burnPrev').innerHTML = `<b style="font-size:22px;color:var(--burn)">🔥 ${r0(burnedKcal(a.met, m))} kcal</b> <span class="muted small">${esc(a.name)} · ${m} min</span>`;
  };
  $$('[data-act]').forEach(b => b.addEventListener('click', () => {
    $('#act').value = b.dataset.act;
    $$('[data-act]').forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', x === b); });
    upd();
  }));
  $$('[data-min]').forEach(b => b.addEventListener('click', () => {
    $('#mins').value = b.dataset.min;
    $$('[data-min]').forEach(x => x.classList.toggle('active', x === b));
    upd();
  }));
  $('#mins').addEventListener('input', () => { $$('[data-min]').forEach(x => x.classList.toggle('active', x.dataset.min === $('#mins').value)); upd(); });
  upd();
  $('#addEx').addEventListener('click', () => {
    const a = ACTIVITIES.find(x => x.id === $('#act').value);
    const m = Number($('#mins').value);
    if (!(m > 0)) return toast('Ingresa los minutos');
    day().exercises.push({ id: uid(), name: a.name, minutes: m, kcal: burnedKcal(a.met, m) });
    save(); toast('Ejercicio registrado 💪'); render();
  });
  $('#mxAdd').addEventListener('click', () => {
    const k = Number($('#mxKcal').value);
    if (!(k > 0)) return toast('Ingresa las calorías');
    day().exercises.push({ id: uid(), name: $('#mxName').value.trim() || 'Actividad', minutes: 0, kcal: k });
    save(); toast('Ejercicio registrado 💪'); render();
  });
  $$('[data-del-ex]').forEach(b => b.addEventListener('click', () => {
    const d = day(); d.exercises = d.exercises.filter(e => e.id !== b.dataset.delEx); save(); render();
  }));
};

// ---------- Vista: Recetas (sugerencias, plan semanal, lista de compras) ----------
function nextMealTarget() {
  const tg = calcTargets();
  const d = peekDay(todayKey());
  const t = totals(d);
  const left = tg.kcal + t.burned - t.kcal;
  const eaten = new Set(d.foods.map(f => f.meal));
  const order = ['desayuno', 'almuerzo', 'snack', 'cena'];
  const now = order.indexOf(guessMeal());
  const pending = MEALS.filter(m => !eaten.has(m.id) && order.indexOf(m.id) >= now);
  const meal = pending.find(m => m.id === guessMeal()) || pending[0] || MEALS.find(m => m.id === 'snack');
  const shareLeft = pending.reduce((a, m) => a + m.share, 0) || meal.share;
  const target = Math.max(150, left * (meal.share / shareLeft));
  return { meal, target, left };
}
function scaleFactor(recipe, target) {
  const base = recipeNutrition(recipe).kcal;
  const f = Math.min(2, Math.max(0.5, target / base));
  return Math.round(f * 4) / 4;
}
function recipesFor(mealId) {
  const veg = state.profile.dieta === 'vegetariana';
  return RECIPES.filter(r => (r.tipo === mealId || (mealId === 'cena' && r.tipo === 'almuerzo') || (mealId === 'almuerzo' && r.tipo === 'cena'))
    && (!veg || r.tags.includes('vegetariana')));
}
function recipeScore(r, target) {
  const n = recipeNutrition(r);
  const p = state.profile;
  let s = Math.abs(n.kcal - target) / target + Math.random() * 0.4;
  if ((p.objetivo !== 'mantener' || p.dieta === 'proteica') && r.tags.includes('alta-proteina')) s -= 0.2;
  if (p.dieta === 'lowcarb') s += (n.c * 4) / Math.max(1, n.kcal) * 0.6;
  return s;
}
function recipeCard(rec, factor = 1, note = '') {
  const n = recipeNutrition(rec, factor);
  return `<div class="card recipe">
    <div class="row"><h3 style="margin:0">${esc(rec.name)}</h3><b style="white-space:nowrap">${r0(n.kcal)} kcal</b></div>
    <div class="tags"><span class="tag type">${rec.tipo}</span>${rec.tags.map(t => `<span class="tag">${t.replace('-', ' ')}</span>`).join('')}${factor !== 1 ? `<span class="tag neutral">porción ×${factor}</span>` : ''}</div>
    ${note ? `<p class="muted small" style="margin:0 0 8px">${note}</p>` : ''}
    <div class="macro-pills"><span style="color:var(--prot)">P <b>${r0(n.p)} g</b></span><span style="color:var(--carb)">C <b>${r0(n.c)} g</b></span><span style="color:var(--fat)">G <b>${r0(n.g)} g</b></span></div>
    <details><summary>Ingredientes y preparación</summary>
      <ul>${rec.ing.map(([id, g]) => { const f = foodById(id); return f ? `<li>${r0(g * factor)} g ${esc(f.name.toLowerCase())} <span class="muted small">(${r0(f.kcal * g * factor / 100)} kcal)</span></li>` : ''; }).join('')}</ul>
      <ol>${rec.pasos.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
    </details>
    <div class="btn-row">
      <button class="btn sm" data-log-recipe="${rec.id}" data-factor="${factor}">Agregar a hoy</button>
      <a class="btn ghost sm" href="${ytUrl('receta ' + rec.name)}" target="_blank" rel="noopener">▶ Ver video</a>
    </div>
  </div>`;
}
function bindLogRecipe(dateKey = todayKey()) {
  $$('[data-log-recipe]').forEach(b => b.addEventListener('click', () => {
    const rec = RECIPES.find(r => r.id === b.dataset.logRecipe);
    const factor = Number(b.dataset.factor);
    const n = recipeNutrition(rec, factor);
    const grams = rec.ing.reduce((a, [, g]) => a + g * factor, 0);
    const mealId = b.dataset.meal || rec.tipo;
    day(dateKey).foods.push({ id: uid(), name: rec.name, grams, meal: mealId, ...n });
    save(); toast(`Agregado: ${rec.name} (${r0(n.kcal)} kcal)`);
    if (view === 'hoy') render();
  }));
}
function viewRecetas() {
  const head = `<h1>Recetas</h1>
    <p class="sub">${RECIPES.length} recetas con calorías calculadas, un plan semanal y tu lista de compras.</p>
    ${tabs('rec', ui.recipeTab, [['recetas', 'Qué comer'], ['plan', 'Plan semanal'], ['compras', 'Lista de compras']])}`;
  if (ui.recipeTab === 'plan') return head + viewPlan();
  if (ui.recipeTab === 'compras') return head + viewCompras();

  const { meal, target, left } = nextMealTarget();
  const tipos = ['todas', 'desayuno', 'almuerzo', 'cena', 'snack'];
  const tags = ['todas', 'alta-proteina', 'vegetariana', 'rapida', 'economica'];
  const list = RECIPES.filter(r => (ui.recipeType === 'todas' || r.tipo === ui.recipeType) && (ui.recipeTag === 'todas' || r.tags.includes(ui.recipeTag)));
  const sugg = (ui.suggest || []).map(id => RECIPES.find(r => r.id === id)).filter(Boolean);
  return head + `
    <div class="card" style="border-color:var(--accent)">
      <div class="row" style="flex-wrap:wrap">
        <div>
          <h2 style="margin-bottom:4px">Tu próxima comida: ${meal.name.toLowerCase()}</h2>
          <div class="muted small">${left > 0 ? `Te quedan ${r0(left)} kcal hoy. Para esta comida apunta a unas <b>${r0(target)} kcal</b>.` : 'Ya cubriste tus calorías de hoy; te sugiero opciones livianas.'}</div>
        </div>
        <button class="btn" id="suggestBtn">✨ Sugerirme recetas</button>
      </div>
    </div>
    ${sugg.length ? `<h2>Sugerencias para ti</h2><div class="grid g3">${sugg.map(r => recipeCard(r, scaleFactor(r, left > 0 ? target : 200), 'Porción ajustada a tus calorías restantes.')).join('')}</div>` : ''}
    <h2 style="margin-top:8px">Todas las recetas</h2>
    <div class="chips">${tipos.map(t => `<button class="chip ${t === ui.recipeType ? 'active' : ''}" data-rtype="${t}">${t === 'todas' ? 'Todas' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    <div class="chips">${tags.map(t => `<button class="chip ${t === ui.recipeTag ? 'active' : ''}" data-rtag="${t}">${t === 'todas' ? 'Cualquiera' : t.replace('-', ' ')}</button>`).join('')}</div>
    <div class="grid g3">${list.map(r => recipeCard(r)).join('') || '<p class="muted">No hay recetas con esos filtros.</p>'}</div>`;
}
function generatePlan() {
  const tg = calcTargets();
  const days = [];
  const used = {};
  for (let i = 0; i < 7; i++) {
    const date = shiftKey(todayKey(), i);
    const meals = {};
    MEALS.forEach(m => {
      const target = tg.kcal * m.share;
      const pool = recipesFor(m.id).length ? recipesFor(m.id) : RECIPES.filter(r => r.tipo === m.id);
      // Evita repetir la misma receta en días seguidos y dentro del mismo día
      const dayIds = Object.values(meals).map(x => x.id);
      const scored = pool.map(r => ({ r, s: recipeScore(r, target) + (used[r.id] || 0) * 0.5 + (dayIds.includes(r.id) ? 5 : 0) }))
        .sort((a, b) => a.s - b.s);
      const r = scored[0].r;
      used[r.id] = (used[r.id] || 0) + 1;
      meals[m.id] = { id: r.id, f: scaleFactor(r, target) };
    });
    days.push({ date, meals });
  }
  state.plan = { created: todayKey(), days, checked: {} };
}
function viewPlan() {
  const p = state.plan;
  if (!p) return `<div class="card"><h2>Plan de comidas semanal</h2>
    <p class="muted">Armo 7 días de desayuno, almuerzo, snack y cena con nuestras recetas, ajustando cada porción a tu meta de ${r0(calcTargets().kcal)} kcal${state.profile.dieta && state.profile.dieta !== 'equilibrada' ? ' y a tu dieta ' + DIETS[state.profile.dieta].label.toLowerCase() : ''}. Después puedes cambiar cualquier comida y sacar la lista de compras.</p>
    <button class="btn" id="genPlan">✨ Generar mi plan</button></div>`;
  return `<div class="row" style="margin-bottom:12px;flex-wrap:wrap"><span class="muted small">Plan creado el ${shortDate(p.created)}. Toca 🔄 para cambiar una comida.</span>
      <button class="btn ghost sm" id="genPlan">🔄 Generar plan nuevo</button></div>
    <div class="grid g2">${p.days.map((d, di) => {
      let tot = 0;
      const rows = MEALS.map(m => {
        const pm = d.meals[m.id];
        const r = pm && RECIPES.find(x => x.id === pm.id);
        if (!r) return '';
        const n = recipeNutrition(r, pm.f); tot += n.kcal;
        return `<div class="item"><div class="info"><div class="muted small">${m.name}${pm.f !== 1 ? ` · ×${pm.f}` : ''}</div><div class="name">${esc(r.name)}</div></div>
          <span class="kcal">${r0(n.kcal)}</span>
          <button class="icon-btn swap" data-swap="${di}:${m.id}" aria-label="Cambiar" title="Cambiar">🔄</button>
          ${d.date === todayKey() ? `<button class="icon-btn swap" data-log-recipe="${r.id}" data-factor="${pm.f}" data-meal="${m.id}" title="Agregar a hoy" aria-label="Agregar a hoy">＋</button>` : ''}</div>`;
      }).join('');
      return `<div class="card ${d.date === todayKey() ? 'today' : ''}"><div class="row"><h3 style="margin:0;text-transform:capitalize">${esc(prettyDate(d.date) === 'Hoy' ? 'Hoy' : parseKey(d.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric' }))}</h3><span class="muted small">${r0(tot)} kcal</span></div><div class="list">${rows}</div></div>`;
    }).join('')}</div>`;
}
function shoppingList() {
  const p = state.plan;
  const tot = {};
  p.days.filter(d => d.date >= todayKey()).forEach(d => Object.values(d.meals).forEach(pm => {
    const r = RECIPES.find(x => x.id === pm.id);
    if (r) r.ing.forEach(([id, g]) => { tot[id] = (tot[id] || 0) + g * pm.f; });
  }));
  const groups = {};
  Object.entries(tot).forEach(([id, g]) => {
    const f = foodById(id); if (!f) return;
    (groups[f.cat] = groups[f.cat] || []).push({ id, name: f.name, g });
  });
  Object.values(groups).forEach(l => l.sort((a, b) => a.name.localeCompare(b.name)));
  return groups;
}
function fmtQty(g) { return g >= 1000 ? r1(g / 1000) + ' kg' : (Math.ceil(g / 10) * 10) + ' g'; }
function viewCompras() {
  if (!state.plan) return `<div class="card"><h2>Lista de compras</h2><p class="muted">Primero genera tu plan semanal y aquí aparecerán todos los ingredientes sumados.</p><button class="btn" data-tab-rec="plan">Ir al plan semanal</button></div>`;
  const groups = shoppingList();
  const checked = state.plan.checked || {};
  return `<div class="row" style="margin-bottom:12px;flex-wrap:wrap"><span class="muted small">Ingredientes de tu plan desde hoy. Marca lo que ya tienes o compraste.</span>
      <button class="btn ghost sm" id="copyList">📋 Copiar lista</button></div>
    <div class="grid g2">${Object.entries(groups).map(([cat, items]) => `<div class="card"><h3>${esc(cat)}</h3>
      ${items.map(it => `<label class="check ${checked[it.id] ? 'done' : ''}"><input type="checkbox" data-check="${it.id}" ${checked[it.id] ? 'checked' : ''}><span>${esc(it.name)}</span><b>${fmtQty(it.g)}</b></label>`).join('')}
    </div>`).join('')}</div>`;
}
bind.recetas = () => {
  $$('[data-tab-rec]').forEach(b => b.addEventListener('click', () => { ui.recipeTab = b.dataset.tabRec; render(); }));
  $$('[data-rtype]').forEach(b => b.addEventListener('click', () => { ui.recipeType = b.dataset.rtype; render(); }));
  $$('[data-rtag]').forEach(b => b.addEventListener('click', () => { ui.recipeTag = b.dataset.rtag; render(); }));
  const sb = $('#suggestBtn');
  if (sb) sb.addEventListener('click', () => {
    const { meal, target, left } = nextMealTarget();
    let pool = recipesFor(meal.id);
    if (left <= 0) pool = RECIPES.filter(r => r.tipo === 'snack');
    const tgt = left > 0 ? target : 200;
    ui.suggest = pool.map(r => ({ r, s: recipeScore(r, tgt) })).sort((a, b) => a.s - b.s).slice(0, 3).map(x => x.r.id);
    render();
    toast('Sugerencias listas');
  });
  const gp = $('#genPlan');
  if (gp) gp.addEventListener('click', () => { generatePlan(); save(); render(); toast('Plan semanal listo'); });
  $$('[data-swap]').forEach(b => b.addEventListener('click', () => {
    const [di, mealId] = b.dataset.swap.split(':');
    const d = state.plan.days[Number(di)];
    const cur = d.meals[mealId].id;
    const target = calcTargets().kcal * MEALS.find(m => m.id === mealId).share;
    const pool = recipesFor(mealId).filter(r => r.id !== cur);
    if (!pool.length) return toast('No hay otra receta para esa comida');
    const r = pool.map(r => ({ r, s: recipeScore(r, target) + Math.random() })).sort((a, c) => a.s - c.s)[0].r;
    d.meals[mealId] = { id: r.id, f: scaleFactor(r, target) };
    save(); render();
  }));
  $$('[data-check]').forEach(c => c.addEventListener('change', () => {
    state.plan.checked = state.plan.checked || {};
    state.plan.checked[c.dataset.check] = c.checked;
    c.closest('.check').classList.toggle('done', c.checked);
    save();
  }));
  const cl = $('#copyList');
  if (cl) cl.addEventListener('click', () => {
    const groups = shoppingList();
    const txt = Object.entries(groups).map(([cat, items]) => cat + ':\n' + items.filter(i => !(state.plan.checked || {})[i.id]).map(i => `- ${i.name}: ${fmtQty(i.g)}`).join('\n')).join('\n\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Lista copiada')).catch(() => toast('No pude copiar la lista'));
  });
  bindLogRecipe();
};

// ---------- Vista: Rutinas y biblioteca de ejercicios ----------
const SPLITS = {
  2: [['Cuerpo completo A', ['piernas', 'pecho', 'espalda', 'hombros', 'core']], ['Cuerpo completo B', ['piernas', 'espalda', 'pecho', 'brazos', 'core']]],
  3: [['Cuerpo completo A', ['piernas', 'pecho', 'espalda', 'core']], ['Cuerpo completo B', ['piernas', 'hombros', 'espalda', 'brazos']], ['Cuerpo completo C', ['piernas', 'pecho', 'hombros', 'core']]],
  4: [['Tren superior A', ['pecho', 'espalda', 'hombros', 'brazos']], ['Tren inferior A', ['piernas', 'piernas', 'core']], ['Tren superior B', ['espalda', 'pecho', 'hombros', 'brazos']], ['Tren inferior B', ['piernas', 'piernas', 'core']]],
  5: [['Empuje (pecho, hombro, tríceps)', ['pecho', 'pecho', 'hombros', 'brazos:tríceps']], ['Tirón (espalda, bíceps)', ['espalda', 'espalda', 'brazos:bíceps', 'core']], ['Piernas', ['piernas', 'piernas', 'piernas', 'core']], ['Tren superior', ['pecho', 'espalda', 'hombros', 'brazos']], ['Piernas y core', ['piernas', 'piernas', 'core', 'core']]],
  6: [['Empuje A', ['pecho', 'pecho', 'hombros', 'brazos:tríceps']], ['Tirón A', ['espalda', 'espalda', 'brazos:bíceps', 'core']], ['Piernas A', ['piernas', 'piernas', 'piernas', 'core']], ['Empuje B', ['hombros', 'pecho', 'pecho', 'brazos:tríceps']], ['Tirón B', ['espalda', 'espalda', 'brazos:bíceps', 'core']], ['Piernas B', ['piernas', 'piernas', 'piernas', 'core']]],
};
const LEG_FOCUS = ['cuádriceps', 'isquiotibiales', 'glúteo mayor', 'gemelos'];
const ARM_FOCUS = ['bíceps', 'tríceps'];
const EQUIP_OPTS = { casa: 'En casa, sin equipo', casa_equipo: 'En casa con mancuernas o bandas', gym: 'Gimnasio' };
function exPool(equipo, nivel) {
  const lv = { principiante: ['principiante'], intermedio: ['principiante', 'intermedio'], avanzado: ['principiante', 'intermedio', 'avanzado'] }[nivel];
  return EXERCISE_DB.filter(e => (e.cat === 'fuerza' || (nivel === 'avanzado' && e.cat === 'olímpico'))
    && lv.includes(e.lv)
    && (equipo === 'gym' || (equipo === 'casa' ? e.bw : e.home)));
}
function pickExercise(pool, slot, used, equipo, focusIdx) {
  let [grp, focus] = slot.split(':');
  if (!focus && grp === 'piernas') focus = LEG_FOCUS[focusIdx % LEG_FOCUS.length];
  if (!focus && grp === 'brazos') focus = ARM_FOCUS[focusIdx % ARM_FOCUS.length];
  let opts = pool.filter(e => e.g === grp && !used.has(e.id) && (!focus || e.m.includes(focus)));
  if (!opts.length) opts = pool.filter(e => e.g === grp && !used.has(e.id));
  if (!opts.length) return null;
  // En gimnasio, preferimos ejercicios con equipo; los bilaterales primero para principiantes
  opts = shuffle(opts).sort((a, b) => (equipo === 'gym' ? (a.bw - b.bw) : 0));
  return opts[0];
}
function generateRoutine(opts) {
  const { objetivo, nivel, dias, equipo, minutos } = opts;
  const scheme = {
    perder: { series: nivel === 'principiante' ? 3 : 4, reps: '12-15', rest: '45 s' },
    mantener: { series: 3, reps: '10-12', rest: '60 s' },
    ganar: { series: nivel === 'principiante' ? 3 : 4, reps: '8-12', rest: '90 s' },
  }[objetivo];
  const pool = exPool(equipo, nivel);
  const extra = minutos >= 60 ? 2 : minutos >= 45 ? 1 : 0;
  const counters = { piernas: 0, brazos: 0 };
  const days = SPLITS[dias].map(([name, groups]) => {
    const used = new Set();
    const g = [...groups];
    for (let i = 0; i < extra; i++) g.push(groups[i % groups.length]);
    g.sort((a, b) => (a === 'core') - (b === 'core'));
    const list = g.map(slot => {
      const grp = slot.split(':')[0];
      const ex = pickExercise(pool, slot, used, equipo, counters[grp] !== undefined ? counters[grp]++ : 0);
      if (!ex) return null;
      used.add(ex.id);
      const isCore = grp === 'core';
      const hold = /plancha|plank|hold|isométric/i.test(ex.n);
      return { ex: ex.id, series: scheme.series, reps: hold ? '30-45 s' : isCore ? '12-20' : scheme.reps, rest: scheme.rest };
    }).filter(Boolean);
    if (objetivo === 'perder') {
      const cardio = shuffle(EXERCISE_DB.filter(e => e.cat === 'cardio' && (equipo === 'gym' || (equipo === 'casa' ? e.bw : e.home))))[0];
      if (cardio) list.push({ ex: cardio.id, series: nivel === 'principiante' ? 3 : 4, reps: '40 s', rest: '20 s', finisher: true });
    }
    // Un estiramiento al final para los grupos trabajados
    const mainGroups = new Set(groups.map(s => s.split(':')[0]));
    const stretch = shuffle(EXERCISE_DB.filter(e => e.cat === 'estiramiento' && mainGroups.has(e.g) && e.bw))[0];
    if (stretch) list.push({ ex: stretch.id, series: 1, reps: '30 s por lado', rest: '-', stretch: true });
    return { name, exercises: list, done: false };
  });
  return { ...opts, days, created: todayKey(), v: 2 };
}
function exThumb(e) {
  return `<img class="ex-thumb" loading="lazy" src="${EX_IMG_BASE + e.img[e.img.length - 1]}" alt="" onerror="this.style.visibility='hidden'">`;
}
function viewRutinas() {
  const head = `<h1>Rutinas</h1>
    <p class="sub">Genera tu rutina semanal o explora ${EXERCISE_DB.length} ejercicios con imágenes y técnica.</p>
    ${tabs('rut', ui.rutTab, [['rutina', 'Mi rutina'], ['biblioteca', 'Biblioteca de ejercicios']])}`;
  return head + (ui.rutTab === 'biblioteca' ? viewBiblioteca() : viewMiRutina());
}
function viewMiRutina() {
  let r = state.routine;
  if (r && r.v !== 2) r = state.routine = null; // rutinas antiguas usaban otra lista de ejercicios
  const p = state.profile;
  const o = r || { objetivo: p.objetivo, nivel: 'principiante', dias: 3, equipo: 'gym', minutos: 45 };
  const kcalSesion = burnedKcal(o.objetivo === 'perder' ? 6 : 5, o.minutos);
  return `
    <div class="card">
      <div class="grid g4" style="gap:10px">
        <div class="field"><label for="rObj">Objetivo</label><select id="rObj">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${k === o.objetivo ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
        <div class="field"><label for="rNivel">Nivel</label><select id="rNivel">${['principiante', 'intermedio', 'avanzado'].map(n => `<option ${n === o.nivel ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label for="rDias">Días por semana</label><select id="rDias">${[2, 3, 4, 5, 6].map(n => `<option ${n === Number(o.dias) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label for="rMin">Minutos por sesión</label><select id="rMin">${[30, 45, 60, 75].map(n => `<option ${n === Number(o.minutos) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <div class="field" style="max-width:340px"><label for="rEq">Dónde entrenas</label><select id="rEq">${Object.entries(EQUIP_OPTS).map(([k, l]) => `<option value="${k}" ${o.equipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <button class="btn" id="genRoutine">${r ? '🔄 Generar nueva rutina' : '✨ Generar rutina'}</button>
    </div>
    ${r ? `
      <div class="row" style="margin-bottom:10px;flex-wrap:wrap"><h2 style="margin:0">Tu rutina (${r.dias} días · ${EQUIP_OPTS[r.equipo].toLowerCase()})</h2><span class="muted small">≈ ${r0(kcalSesion)} kcal por sesión</span></div>
      <p class="muted small" style="margin-top:0">Calienta 5-10 min antes. Toca un ejercicio para ver cómo se hace. Si una serie se siente fácil, sube el peso o las repeticiones la semana siguiente.</p>
      <div class="grid g2">${r.days.map((dd, i) => `
        <div class="card day ${dd.done ? 'done' : ''}">
          <h3 style="margin:0">Día ${i + 1}: ${esc(dd.name)}</h3>
          <div style="margin:8px 0">${dd.exercises.map((x, j) => { const e = exById(x.ex); return e ? `
            <div class="ex" data-ex="${e.id}" data-slot="${i}:${j}" tabindex="0" role="button">
              ${exThumb(e)}
              <span class="ex-name">${esc(e.n)}${x.finisher ? ' <span class="tag type">final</span>' : ''}${x.stretch ? ' <span class="tag neutral">estiramiento</span>' : ''}<span class="muted small">${esc(e.m.slice(0, 2).join(', '))}</span></span>
              <span class="sr">${x.series} × ${x.reps}${x.rest !== '-' ? '<span class="rest">' + x.rest + '</span>' : ''}</span>
            </div>` : ''; }).join('')}</div>
          <button class="btn sm ${dd.done ? 'ghost' : 'burn'}" data-done="${i}">${dd.done ? '✓ Hecho (desmarcar)' : 'Marcar como hecho hoy'}</button>
        </div>`).join('')}</div>` : ''}`;
}
function viewBiblioteca() {
  const groups = ['todos', 'pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'core', 'cuerpo completo'];
  const equips = { todos: 'Cualquier equipo', casa: 'Sin equipo', casa_equipo: 'En casa', gym: 'Solo gimnasio' };
  const q = norm(ui.exQuery.trim());
  const list = EXERCISE_DB.filter(e =>
    (ui.exGroup === 'todos' || e.g === ui.exGroup)
    && (ui.exEquip === 'todos' || (ui.exEquip === 'casa' ? e.bw : ui.exEquip === 'casa_equipo' ? e.home : !e.home))
    && (!q || norm(e.n + ' ' + e.m.join(' ') + ' ' + e.eq).includes(q)));
  const shown = list.slice(0, 60);
  return `
    <div class="card">
      <input id="exSearch" type="search" placeholder="Buscar: sentadilla, bíceps, mancuernas…" value="${esc(ui.exQuery)}" autocomplete="off" style="margin-bottom:10px">
      <div class="chips scroll-x">${groups.map(g => `<button class="chip ${g === ui.exGroup ? 'active' : ''}" data-exg="${g}">${g === 'todos' ? 'Todos' : g[0].toUpperCase() + g.slice(1)}</button>`).join('')}</div>
      <div class="chips">${Object.entries(equips).map(([k, l]) => `<button class="chip ${k === ui.exEquip ? 'active' : ''}" data-exe="${k}">${l}</button>`).join('')}</div>
      <div class="muted small">${list.length} ejercicios${list.length > shown.length ? ` (mostrando ${shown.length}; filtra para ver otros)` : ''}</div>
    </div>
    <div class="ex-grid">${shown.map(e => `
      <button class="ex-card" data-ex="${e.id}">
        ${exThumb(e)}
        <span class="ex-card-body"><b>${esc(e.n)}</b><span class="muted small">${esc(e.m.slice(0, 2).join(', '))} · ${esc(e.eq)}</span><span class="tag ${e.lv === 'avanzado' ? 'type' : ''}">${e.lv}</span></span>
      </button>`).join('')}</div>
    <p class="muted small">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener">RepDB (repdb.co)</a></p>`;
}
function openExercise(id, slot) {
  const e = exById(id);
  if (!e) return;
  openModal(`
    <h2 style="padding-right:30px">${esc(e.n)}</h2>
    <div class="tags"><span class="tag">${esc(e.g)}</span><span class="tag type">${esc(e.lv)}</span><span class="tag neutral">${esc(e.eq)}</span></div>
    <div class="ex-imgs">${e.img.map((im, i) => `<figure><img src="${EX_IMG_BASE + im}" alt="${esc(e.n)}" onerror="this.parentNode.style.display='none'"><figcaption class="muted small">${e.img.length > 1 ? (i ? 'Final' : 'Inicio') : ''}</figcaption></figure>`).join('')}</div>
    ${e.d ? `<p>${esc(e.d)}</p>` : ''}
    <p class="small"><b>Músculos:</b> ${esc(e.m.join(', '))}${e.m2.length ? ` <span class="muted">(también ${esc(e.m2.join(', '))})</span>` : ''}</p>
    <h3>Cómo se hace</h3>
    <ol>${e.ins.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${e.tips.length ? `<h3>Consejos</h3><ul>${e.tips.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    <div class="btn-row">
      <a class="btn" href="${ytUrl('cómo hacer ' + e.n + ' técnica')}" target="_blank" rel="noopener">▶ Ver video en YouTube</a>
      ${slot ? '<button class="btn ghost" id="swapEx">🔄 Cambiar por otro ejercicio</button>' : ''}
    </div>
    <p class="muted small">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener">RepDB (repdb.co)</a></p>`, m => {
    const sw = m.querySelector('#swapEx');
    if (sw) sw.addEventListener('click', () => {
      const [di, xi] = slot.split(':').map(Number);
      const r = state.routine;
      const dd = r.days[di];
      const cur = dd.exercises[xi];
      const usedIds = new Set(dd.exercises.map(x => x.ex));
      let pool = cur.stretch ? EXERCISE_DB.filter(x => x.cat === 'estiramiento' && x.g === e.g && x.bw)
        : cur.finisher ? EXERCISE_DB.filter(x => x.cat === 'cardio')
          : exPool(r.equipo, r.nivel).filter(x => x.g === e.g);
      pool = pool.filter(x => !usedIds.has(x.id));
      const sameMuscle = pool.filter(x => x.m.some(mm => e.m.includes(mm)));
      const pick = shuffle(sameMuscle.length ? sameMuscle : pool)[0];
      if (!pick) return toast('No encontré otro ejercicio parecido');
      cur.ex = pick.id; save(); closeModal(); render();
      toast('Cambiado por: ' + pick.n);
    });
  });
}
bind.rutinas = () => {
  $$('[data-tab-rut]').forEach(b => b.addEventListener('click', () => { ui.rutTab = b.dataset.tabRut; render(); }));
  $$('[data-ex]').forEach(el => {
    const open = () => openExercise(el.dataset.ex, el.dataset.slot);
    el.addEventListener('click', open);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') open(); });
  });
  const exs = $('#exSearch');
  if (exs) exs.addEventListener('input', () => {
    ui.exQuery = exs.value;
    const pos = exs.selectionStart;
    render();
    const s = $('#exSearch'); s.focus(); s.setSelectionRange(pos, pos);
  });
  $$('[data-exg]').forEach(b => b.addEventListener('click', () => { ui.exGroup = b.dataset.exg; render(); }));
  $$('[data-exe]').forEach(b => b.addEventListener('click', () => { ui.exEquip = b.dataset.exe; render(); }));
  const gr = $('#genRoutine');
  if (gr) gr.addEventListener('click', () => {
    state.routine = generateRoutine({
      objetivo: $('#rObj').value, nivel: $('#rNivel').value, dias: Number($('#rDias').value),
      equipo: $('#rEq').value, minutos: Number($('#rMin').value),
    });
    save(); render(); toast('Rutina generada');
  });
  $$('[data-done]').forEach(b => b.addEventListener('click', () => {
    const r = state.routine;
    const dd = r.days[Number(b.dataset.done)];
    dd.done = !dd.done;
    const d = day(todayKey());
    const tag = 'rutina-' + b.dataset.done;
    if (dd.done) {
      const met = r.objetivo === 'perder' ? 6 : 5;
      d.exercises.push({ id: uid(), tag, name: 'Rutina: ' + dd.name, minutes: r.minutos, kcal: burnedKcal(met, r.minutos) });
      toast('¡Bien! Ejercicio sumado a hoy 💪');
    } else {
      d.exercises = d.exercises.filter(e => e.tag !== tag);
    }
    if (r.days.every(x => x.done)) { r.days.forEach(x => { x.done = false; }); toast('¡Semana completa! La rutina se reinició 🎉'); }
    save(); render();
  }));
};

// ---------- Vista: Progreso (peso, medidas, ajuste automático) ----------
function weightChart(ws) {
  if (ws.length < 2) return '<p class="muted small">Registra al menos 2 pesos para ver el gráfico.</p>';
  const W = 600, H = 220, P = 50;
  const first = ws[0].d, span = Math.max(1, daysBetween(first, ws[ws.length - 1].d));
  const kgs = ws.map(w => w.kg);
  let lo = Math.min(...kgs), hi = Math.max(...kgs);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const x = d => P + (daysBetween(first, d) / span) * (W - P - 10);
  const y = kg => 10 + (1 - (kg - lo) / (hi - lo)) * (H - 40);
  // Media móvil de 7 días
  const avg = ws.map(w => { const win = ws.filter(o => daysBetween(o.d, w.d) >= 0 && daysBetween(o.d, w.d) < 7); return { d: w.d, kg: win.reduce((a, o) => a + o.kg, 0) / win.length }; });
  const ticks = [lo, (lo + hi) / 2, hi];
  const last = ws[ws.length - 1];
  const line = avg.map(a => `${x(a.d)},${y(a.kg)}`).join(' ');
  const area = `${x(avg[0].d)},${H - 30} ${line} ${x(avg[avg.length - 1].d)},${H - 30}`;
  return `<svg viewBox="0 0 ${W} ${H}" class="wchart" role="img" aria-label="Gráfico de peso">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a55ff" stop-opacity=".55"/><stop offset="1" stop-color="#8a55ff" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(255,255,255,.08)"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${r1(t)}</text>`).join('')}
    <polygon fill="url(#wg)" points="${area}"/>
    <polyline fill="none" stroke="#a77dff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>
    ${ws.map(w => `<circle cx="${x(w.d)}" cy="${y(w.kg)}" r="3" fill="rgba(255,255,255,.55)"><title>${shortDate(w.d)}: ${w.kg} kg</title></circle>`).join('')}
    <line x1="${x(last.d)}" x2="${x(last.d)}" y1="10" y2="${H - 30}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4"/>
    <circle cx="${x(last.d)}" cy="${y(last.kg)}" r="7" fill="#fff" stroke="#8a55ff" stroke-width="4"/>
    <text x="${P}" y="${H - 6}" class="axis">${shortDate(first)}</text><text x="${W - 10}" y="${H - 6}" text-anchor="end" class="axis">${shortDate(last.d)}</text>
  </svg><div class="muted small">Puntos = cada pesaje · Línea violeta = promedio de 7 días (más confiable que un día suelto).</div>`;
}
function viewProgreso() {
  const p = state.profile;
  const tg = calcTargets();
  const ws = [...state.weights].sort((a, b) => a.d.localeCompare(b.d));
  const ms = [...state.measures].sort((a, b) => a.d.localeCompare(b.d));
  const lastM = ms[ms.length - 1];
  const bf = bodyFat(lastM, p);
  const trend = weightTrend();
  const expected = GOALS[p.objetivo].rate;
  const change = ws.length ? ws[ws.length - 1].kg - ws[0].kg : 0;
  return `
    <h1>Progreso</h1>
    <p class="sub">Registra tu peso y medidas. Con eso la app ajusta tu meta de calorías según cómo respondes de verdad.</p>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat"><div class="label">Peso actual</div><span class="tile-ico" aria-hidden="true">⚖️</span><div class="value">${r1(currentWeight())} <span class="unit">kg</span></div></div>
      <div class="stat"><div class="label">Cambio total</div><span class="tile-ico" aria-hidden="true">📉</span><div class="value">${ws.length ? (change > 0 ? '+' : '') + r1(change) : '—'} <span class="unit">kg</span></div></div>
      <div class="stat"><div class="label">Ritmo (últimas 4 semanas)</div><span class="tile-ico" aria-hidden="true">📈</span><div class="value">${trend === null ? '—' : (trend > 0 ? '+' : '') + r1(trend)} <span class="unit">kg/sem</span></div></div>
      <div class="stat"><div class="label">% grasa estimado</div><span class="tile-ico" aria-hidden="true">📏</span><div class="value">${bf ? r1(bf) : '—'} <span class="unit">%</span></div></div>
    </div>
    <div class="grid g2">
      <div>
        <div class="card">
          <h2>Registrar peso</h2>
          <div class="grid g2" style="gap:10px">
            <div class="field"><label for="wDate">Fecha</label><input id="wDate" type="date" value="${todayKey()}" max="${todayKey()}"></div>
            <div class="field"><label for="wKg">Peso (kg)</label><input id="wKg" type="number" step="0.1" min="30" max="300" inputmode="decimal" value="${r1(currentWeight())}"></div>
          </div>
          <button class="btn" id="addWeight" style="width:100%">Guardar peso</button>
          <p class="muted small">Consejo: pésate en ayunas, después de ir al baño, 2-3 veces por semana.</p>
        </div>
        <div class="card">
          <h2>Ajuste automático de la meta</h2>
          <label class="check" style="border:0;padding:0"><input type="checkbox" id="autoAdj" ${p.autoAjuste ? 'checked' : ''}><span>Ajustar mis calorías según mi progreso real</span></label>
          <p class="muted small">Cada semana comparo tu ritmo real con el esperado para "${GOALS[p.objetivo].label.toLowerCase()}" (${expected > 0 ? '+' : ''}${expected} kg/semana) y corrijo la meta hasta 200 kcal por vez. Necesito al menos 3 pesajes en 10 días o más.</p>
          ${p.autoAjuste ? `<div class="result-box small">Ajuste actual: <b>${state.ajuste > 0 ? '+' : ''}${state.ajuste} kcal</b> · Meta de hoy: <b>${r0(tg.kcal)} kcal</b>${state.lastAdjust ? ` · Último cálculo: ${shortDate(state.lastAdjust)}` : ''}</div>
            <div class="btn-row"><button class="btn ghost sm" id="recalc">Recalcular ahora</button><button class="btn ghost sm" id="resetAdj">Volver a 0</button></div>` : ''}
        </div>
      </div>
      <div class="card dark-card">
        <div class="row"><h2>Evolución del peso</h2><span class="big-num">${r1(currentWeight())}<small>kg</small></span></div>
        ${weightChart(ws)}
        <div class="list" style="margin-top:10px">${ws.slice(-8).reverse().map(w => `
          <div class="item"><div class="info"><div class="name">${shortDate(w.d)}</div></div><span class="kcal">${r1(w.kg)} kg</span><button class="icon-btn" data-del-w="${w.d}" aria-label="Eliminar">✕</button></div>`).join('')}</div>
      </div>
    </div>
    <div class="card">
      <h2>Medidas corporales</h2>
      <p class="muted small" style="margin-top:-6px">Con cintura y cuello${p.sexo === 'm' ? ' (y cadera)' : ''} estimo tu % de grasa (método de la Marina de EE.UU.). Mide en cm.</p>
      <div class="grid g4" style="gap:10px">
        <div class="field"><label for="mCint">Cintura (ombligo)</label><input id="mCint" type="number" step="0.5" inputmode="decimal" value="${lastM ? lastM.cintura || '' : ''}"></div>
        <div class="field"><label for="mCuello">Cuello</label><input id="mCuello" type="number" step="0.5" inputmode="decimal" value="${lastM ? lastM.cuello || '' : ''}"></div>
        <div class="field"><label for="mCadera">Cadera</label><input id="mCadera" type="number" step="0.5" inputmode="decimal" value="${lastM ? lastM.cadera || '' : ''}"></div>
        <div class="field"><label for="mBrazo">Brazo</label><input id="mBrazo" type="number" step="0.5" inputmode="decimal" value="${lastM ? lastM.brazo || '' : ''}"></div>
      </div>
      <button class="btn ghost" id="addMeasure">Guardar medidas de hoy</button>
      ${ms.length ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Cintura</th><th>Cuello</th><th>Cadera</th><th>Brazo</th><th>% grasa</th></tr></thead><tbody>
        ${ms.slice(-6).reverse().map(m => { const b = bodyFat(m, p); return `<tr><td>${shortDate(m.d)}</td><td>${m.cintura || '—'}</td><td>${m.cuello || '—'}</td><td>${m.cadera || '—'}</td><td>${m.brazo || '—'}</td><td>${b ? r1(b) + '%' : '—'}</td></tr>`; }).join('')}
      </tbody></table>` : ''}
    </div>`;
}
bind.progreso = () => {
  $('#addWeight').addEventListener('click', () => {
    const d = $('#wDate').value, kg = Number($('#wKg').value);
    if (!d || !(kg >= 30 && kg <= 300)) return toast('Revisa la fecha y el peso');
    state.weights = state.weights.filter(w => w.d !== d);
    state.weights.push({ d, kg: r1(kg) });
    state.profile.peso = currentWeight();
    const step = autoAdjust();
    save(); render();
    toast(step ? `Peso guardado. Ajusté tu meta ${step > 0 ? '+' : ''}${r0(step)} kcal` : 'Peso guardado');
  });
  $$('[data-del-w]').forEach(b => b.addEventListener('click', () => {
    state.weights = state.weights.filter(w => w.d !== b.dataset.delW); save(); render();
  }));
  $('#autoAdj').addEventListener('change', e => {
    state.profile.autoAjuste = e.target.checked;
    if (e.target.checked) autoAdjust(true);
    save(); render();
  });
  const rc = $('#recalc');
  if (rc) rc.addEventListener('click', () => {
    const step = autoAdjust(true);
    save(); render();
    toast(step === null ? 'Aún faltan pesajes (mínimo 3 en 10 días)' : step === 0 ? 'Vas al ritmo esperado: sin cambios' : `Meta ajustada ${step > 0 ? '+' : ''}${r0(step)} kcal`);
  });
  const ra = $('#resetAdj');
  if (ra) ra.addEventListener('click', () => { state.ajuste = 0; state.lastAdjust = null; save(); render(); });
  $('#addMeasure').addEventListener('click', () => {
    const v = id => Number($(id).value) || null;
    const m = { d: todayKey(), cintura: v('#mCint'), cuello: v('#mCuello'), cadera: v('#mCadera'), brazo: v('#mBrazo') };
    if (!m.cintura && !m.cuello && !m.cadera && !m.brazo) return toast('Ingresa al menos una medida');
    state.measures = state.measures.filter(x => x.d !== m.d);
    state.measures.push(m); save(); render(); toast('Medidas guardadas');
  });
};

// ---------- Vista: Perfil ----------
function viewPerfil() {
  const p = state.profile || { nombre: '', sexo: 'h', edad: 25, peso: 70, altura: 170, actividad: 1.375, objetivo: 'mantener', dieta: 'equilibrada' };
  const tg = state.profile ? calcTargets() : null;
  return `
    <h1>${state.profile ? 'Perfil' : 'Bienvenido 👋'}</h1>
    <p class="sub">${state.profile ? 'Actualiza tus datos para recalcular tus calorías.' : 'Completa tus datos para calcular cuántas calorías necesitas al día.'}</p>
    <div class="grid g2">
      <div class="card">
        <div class="field"><label for="pNombre">Nombre</label><input id="pNombre" value="${esc(p.nombre || '')}" placeholder="Opcional"></div>
        <div class="grid g2" style="gap:10px">
          <div class="field"><label for="pSexo">Sexo</label><select id="pSexo"><option value="h" ${p.sexo === 'h' ? 'selected' : ''}>Hombre</option><option value="m" ${p.sexo === 'm' ? 'selected' : ''}>Mujer</option></select></div>
          <div class="field"><label for="pEdad">Edad</label><input id="pEdad" type="number" min="12" max="100" value="${p.edad}"></div>
          <div class="field"><label for="pPeso">Peso (kg)</label><input id="pPeso" type="number" min="30" max="300" step="0.1" value="${state.profile ? r1(currentWeight()) : p.peso}"></div>
          <div class="field"><label for="pAltura">Altura (cm)</label><input id="pAltura" type="number" min="120" max="230" value="${p.altura}"></div>
        </div>
        <div class="field"><label for="pAct">Nivel de actividad</label><select id="pAct">${ACTIVITY_LEVELS.map(a => `<option value="${a.v}" ${a.v === Number(p.actividad) ? 'selected' : ''}>${a.label}</option>`).join('')}</select></div>
        <div class="grid g2" style="gap:10px">
          <div class="field"><label for="pObj">Objetivo</label><select id="pObj">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${k === p.objetivo ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
          <div class="field"><label for="pDieta">Tipo de dieta</label><select id="pDieta">${Object.entries(DIETS).map(([k, d]) => `<option value="${k}" ${k === (p.dieta || 'equilibrada') ? 'selected' : ''}>${d.label}</option>`).join('')}</select></div>
        </div>
        <button class="btn" id="saveProfile" style="width:100%">${state.profile ? 'Guardar cambios' : 'Calcular y empezar'}</button>
      </div>
      <div>
        ${tg ? `
        <div class="card">
          <h2>Tus números</h2>
          <div class="grid g2" style="gap:10px">
            <div class="stat"><div class="label">Metabolismo basal</div><span class="tile-ico" aria-hidden="true">🫀</span><div class="value">${r0(tg.bmr)} <span class="unit">kcal</span></div></div>
            <div class="stat"><div class="label">Gasto diario (TDEE)</div><span class="tile-ico" aria-hidden="true">⚡</span><div class="value">${r0(tg.tdee)} <span class="unit">kcal</span></div></div>
            <div class="stat accent"><div class="label">Objetivo diario</div><span class="tile-ico" aria-hidden="true">🎯</span><div class="value">${r0(tg.kcal)} <span class="unit">kcal</span></div></div>
            <div class="stat"><div class="label">IMC</div><span class="tile-ico" aria-hidden="true">🧮</span><div class="value">${r1(tg.imc)} <span class="unit">${imcLabel(tg.imc)}</span></div></div>
          </div>
          <div class="macro-pills" style="margin-top:14px"><span style="color:var(--prot)">Proteína <b>${r0(tg.prot)} g</b></span><span style="color:var(--carb)">Carbos <b>${r0(tg.carb)} g</b></span><span style="color:var(--fat)">Grasas <b>${r0(tg.fat)} g</b></span><span style="color:var(--prot)">Agua <b>${r1(tg.water * 0.25)} L</b></span></div>
          <p class="muted small">Cálculo con la fórmula Mifflin-St Jeor. Es una estimación: activa el ajuste automático en Progreso para que se corrija con tu peso real.</p>
        </div>` : ''}
        <div class="card">
          <h2>Tus datos</h2>
          <p class="muted small" style="margin-top:-6px">Todo se guarda en este dispositivo. Usa exportar/importar para pasar tus datos del PC al teléfono.</p>
          <div class="btn-row">
            <button class="btn ghost sm" id="exportBtn">⬇ Exportar</button>
            <label class="btn ghost sm" style="margin:0;color:var(--text)">⬆ Importar<input type="file" id="importFile" accept="application/json" hidden></label>
            ${state.profile ? '<button class="btn ghost sm" id="resetBtn" style="color:var(--danger)">Borrar todo</button>' : ''}
          </div>
        </div>
        <div class="card">
          <h2>Créditos</h2>
          <ul class="small credits">
            <li>Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener">RepDB (repdb.co)</a></li>
            <li>Alimentos: <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> (SR Legacy, dominio público)</li>
            <li>Productos escaneados: <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts</a> (ODbL)</li>
            <li>Lector de códigos: ZXing (MIT)</li>
          </ul>
        </div>
      </div>
    </div>`;
}
bind.perfil = () => {
  $('#saveProfile').addEventListener('click', () => {
    const p = {
      ...(state.profile || {}),
      nombre: $('#pNombre').value.trim(), sexo: $('#pSexo').value, edad: Number($('#pEdad').value),
      peso: Number($('#pPeso').value), altura: Number($('#pAltura').value), actividad: Number($('#pAct').value),
      objetivo: $('#pObj').value, dieta: $('#pDieta').value,
    };
    if (!(p.edad >= 12 && p.peso >= 30 && p.altura >= 120)) return toast('Revisa edad, peso y altura');
    const first = !state.profile;
    // Si cambió el peso, queda registrado como pesaje de hoy
    if (first || Math.abs(p.peso - currentWeight()) >= 0.05) {
      state.weights = state.weights.filter(w => w.d !== todayKey());
      state.weights.push({ d: todayKey(), kg: r1(p.peso) });
    }
    state.profile = p; save();
    toast(first ? `¡Listo! Tu objetivo es ${r0(calcTargets().kcal)} kcal/día` : 'Perfil actualizado');
    first ? go('hoy') : render();
  });
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitplan-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(txt => {
      const s = JSON.parse(txt);
      if (!s || typeof s !== 'object' || !('days' in s)) throw new Error('formato');
      state = { ...EMPTY(), ...s };
      save(); toast('Datos importados'); go(state.profile ? 'hoy' : 'perfil');
    }).catch(() => toast('Ese archivo no es válido'));
  });
  const reset = $('#resetBtn');
  if (reset) reset.addEventListener('click', () => {
    if (!confirm('¿Borrar todos tus datos de este dispositivo?')) return;
    state = EMPTY();
    save(); render();
  });
};

// ---------- Inicio ----------
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
