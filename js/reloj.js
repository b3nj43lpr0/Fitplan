// FitPlan · Reloj: en la app Android lee Health Connect (Mi Fitness lo llena) y lo guarda en cada día.
// Lo leído viaja con la sincronización, así que en el PC también se ve.
'use strict';

const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const HC = NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins.Health : null;
const APK_URL = 'https://github.com/b3nj43lpr0/Fitplan/releases/download/android/FitPlan.apk';
const WATCH_READ = ['steps', 'distance', 'calories', 'totalCalories', 'heartRate', 'restingHeartRate', 'sleep', 'oxygenSaturation', 'weight', 'workouts'];
const WATCH_KEY = pkey('fitplan-reloj');
// Nombres en español de los entrenamientos de Health Connect y su intensidad (MET) si el reloj no trae calorías
const WORKOUT_ES = {
  walking: ['Caminata', 3.5], running: ['Trote', 8], runningTreadmill: ['Trote en cinta', 8], cycling: ['Bicicleta', 7], bikingStationary: ['Bicicleta estática', 6.8],
  swimming: ['Natación', 7], swimmingPool: ['Natación en piscina', 7], swimmingOpenWater: ['Natación en aguas abiertas', 8], hiking: ['Trekking', 6],
  strengthTraining: ['Fuerza', 5], traditionalStrengthTraining: ['Pesas', 5], functionalStrengthTraining: ['Entrenamiento funcional', 6], weightlifting: ['Pesas', 5],
  highIntensityIntervalTraining: ['HIIT', 8], crossTraining: ['Entrenamiento cruzado', 7], elliptical: ['Elíptica', 5], rowing: ['Remo', 7], rowingMachine: ['Máquina de remo', 7],
  yoga: ['Yoga', 2.5], pilates: ['Pilates', 3], dance: ['Baile', 5], dancing: ['Baile', 5], soccer: ['Fútbol', 7], basketball: ['Básquetbol', 6.5], tennis: ['Tenis', 7],
  stairClimbing: ['Subir escaleras', 8], stairClimbingMachine: ['Escaladora', 9], jumpRope: ['Saltar la cuerda', 11], boxing: ['Boxeo', 9], martialArts: ['Artes marciales', 10],
  stretching: ['Elongación', 2.3], calisthenics: ['Calistenia', 5], other: ['Entrenamiento del reloj', 5],
};

function watchCfg() {
  try { return { on: false, workouts: true, last: 0, ...JSON.parse(localStorage.getItem(WATCH_KEY)) }; } catch (e) { return { on: false, workouts: true, last: 0 }; }
}
function setWatchCfg(c) { try { localStorage.setItem(WATCH_KEY, JSON.stringify({ ...watchCfg(), ...c })); } catch (e) { /* ignorar */ } }

// ---------- Leer un día de Health Connect ----------
async function readWatchDay(k) {
  const s = parseKey(k), e = parseKey(shiftKey(k, 1));
  const now = new Date();
  const range = { startDate: s.toISOString(), endDate: (e > now ? now : e).toISOString() };
  const samples = async (t, rg = range) => { try { return (await HC.readSamples({ dataType: t, ...rg, limit: 5000, ascending: true })).samples || []; } catch (err) { return []; } };
  // Pasos, distancia y calorías: la suma rápida de Health Connect, y si no trae nada (o el tipo no se puede sumar),
  // se suman los registros uno por uno por cada fuente (reloj, teléfono…) y se toma la mayor, para no contar dos veces
  const agg = async t => {
    try { const r = await HC.queryAggregated({ dataType: t, ...range, bucket: 'day', aggregation: 'sum' }); return r.samples.reduce((a, x) => a + (x.value || 0), 0); } catch (err) { return 0; }
  };
  const total = async t => {
    const [a, list] = await Promise.all([agg(t), samples(t)]);
    const by = {};
    for (const x of list) { const k = x.sourceId || x.sourceName || '?'; by[k] = (by[k] || 0) + (x.value || 0); }
    const last = list.reduce((m, x) => (x.endDate > m ? x.endDate : m), '');
    return { v: Math.max(a, ...Object.values(by), 0), last, n: list.length };
  };
  // El sueño de "hoy" es la noche que terminó esta mañana: desde las 18:00 de ayer hasta las 18:00 de hoy
  const sleepRange = { startDate: new Date(s.getTime() - 6 * 3600e3).toISOString(), endDate: new Date(Math.min(s.getTime() + 18 * 3600e3, now.getTime())).toISOString() };
  const [st, dist, act, tot, hr, rhr, spo2, wts, sleep, wk] = await Promise.all([
    total('steps'), total('distance'), total('calories'), total('totalCalories'),
    samples('heartRate'), samples('restingHeartRate'), samples('oxygenSaturation'), samples('weight'), samples('sleep', sleepRange),
    HC.queryWorkouts({ ...range, limit: 50, ascending: true }).then(r => r.workouts || []).catch(() => []),
  ]);
  const steps = st.v, meters = dist.v, active = act.v;
  const lastData = [st.last, act.last, tot.last, ...hr.map(x => x.endDate)].reduce((m, x) => (x && x > m ? x : m), '');
  const vals = a => a.map(x => x.value).filter(v => v > 0);
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const h = vals(hr), ox = vals(spo2);
  const sl = { min: 0, deep: 0, rem: 0, light: 0, awake: 0 };
  for (const x of sleep) {
    if (x.stages && x.stages.length) {
      for (const st of x.stages) {
        if (st.stage === 'awake' || st.stage === 'inBed') sl.awake += st.durationMinutes;
        else { sl.min += st.durationMinutes; if (sl[st.stage] !== undefined) sl[st.stage] += st.durationMinutes; }
      }
    } else if (x.sleepState !== 'awake' && x.sleepState !== 'inBed') sl.min += x.value || 0;
  }
  return {
    steps: Math.round(steps), km: Math.round(meters / 10) / 100, active: Math.round(active), total: Math.round(tot.v), last: lastData || null,
    hr: h.length ? { avg: Math.round(avg(h)), min: Math.min(...h), max: Math.max(...h) } : null,
    rhr: vals(rhr).length ? Math.round(vals(rhr).pop()) : null,
    spo2: ox.length ? Math.round(avg(ox)) : null,
    sleep: sl.min ? Object.fromEntries(Object.entries(sl).map(([a, b]) => [a, Math.round(b)])) : null,
    weight: vals(wts).length ? vals(wts).pop() : null,
    workouts: wk,
  };
}

// Guarda lo leído en el día: los números en day.watch y los entrenamientos como ejercicios (una sola vez cada uno)
function storeWatchDay(k, r) {
  const d = day(k);
  const prev = d.watch || {};
  const imp = new Set(prev.imp || []);
  let added = 0;
  if (watchCfg().workouts) {
    for (const w of r.workouts) {
      const id = 'hc-' + (w.platformId || w.startDate);
      if (imp.has(id)) continue;
      imp.add(id);
      const [name, met] = WORKOUT_ES[w.workoutType] || WORKOUT_ES.other;
      const minutes = Math.max(1, Math.round((w.duration || 0) / 60));
      const km = w.totalDistance ? Math.round(w.totalDistance / 10) / 100 : undefined;
      d.exercises.push({ id, name: `⌚ ${name}${km ? ` · ${km.toLocaleString('es')} km` : ''}`, minutes, kcal: Math.round(w.totalEnergyBurned || burnedKcal(met, minutes)), km, src: 'reloj' });
      added++;
    }
  }
  const { workouts, weight, ...nums } = r;
  d.watch = { ...nums, n: r.workouts.length, imp: [...imp], at: Date.now() };
  // Peso de una balanza conectada: solo si ese día no tiene uno anotado
  if (weight && weight >= 30 && weight <= 300 && !state.weights.some(w => w.d === k)) {
    state.weights.push({ d: k, kg: r1(weight) });
    state.weights.sort((a, b) => (a.d < b.d ? -1 : 1));
    state.profile.peso = currentWeight();
  }
  return added;
}

let watchBusy = false;
async function syncWatch({ days = 2, quiet = false } = {}) {
  if (!HC || watchBusy || !state.profile) return;
  watchBusy = true;
  if (!quiet && days > 2) toast(`⌚ Leyendo ${days} días del reloj…`);
  try {
    let added = 0;
    for (let i = days - 1; i >= 0; i--) {
      const k = shiftKey(todayKey(), -i);
      added += storeWatchDay(k, await readWatchDay(k));
    }
    setWatchCfg({ last: Date.now() });
    save(); render();
    if (!quiet) toast(added ? `⌚ Reloj actualizado · ${added} ${added === 1 ? 'entrenamiento nuevo' : 'entrenamientos nuevos'}` : '⌚ Reloj actualizado');
  } catch (e) {
    if (!quiet) toast('No pude leer Health Connect. Revisa los permisos.');
  } finally { watchBusy = false; }
}

async function connectWatch() {
  if (!HC) return;
  try {
    const av = await HC.isAvailable();
    if (!av.available) {
      return openModal(`<h2>⌚ Falta Health Connect</h2>
        <p>Para leer tu reloj, instala <b>Health Connect</b> de Google desde la Play Store y en <b>Mi Fitness</b> activa compartir datos con Health Connect.</p>
        <button class="btn" style="width:100%" onclick="window.open('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata','_system')">Abrir Play Store</button>`);
    }
    const st = await HC.requestAuthorization({ read: WATCH_READ, write: [] });
    if (!st.readAuthorized || !st.readAuthorized.length) return toast('Sin permisos no puedo leer el reloj');
    setWatchCfg({ on: true });
    await syncWatch({ days: 30 });
  } catch (e) { toast('No pude conectar con Health Connect'); }
}

// ---------- Tarjeta en Hoy ----------
function fmtSleep(m) { return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; }
function watchCard() {
  const w = peekDay(currentDate).watch;
  const cfg = watchCfg();
  if (!w) {
    if (!NATIVE) return '';
    return `<div class="card watch-card">
      <h2>⌚ Tu reloj</h2>
      <p class="muted small" style="margin-top:-4px">${cfg.on ? 'Aún no hay datos del reloj para este día.' : 'Conecta tu reloj y FitPlan leerá solo tus pasos, calorías, entrenamientos, pulso, sueño y oxígeno desde Health Connect (lo llena Mi Fitness).'}</p>
      <button class="btn" data-watch="${cfg.on ? 'sync' : 'connect'}" style="width:100%">${cfg.on ? '↻ Leer el reloj ahora' : 'Conectar reloj'}</button>
    </div>`;
  }
  const ago = Math.round((Date.now() - (w.at || 0)) / 60000);
  const m = (v, lbl, ico) => `<div class="mini"><span class="wico">${ico}</span><b>${v}</b><span>${lbl}</span></div>`;
  return `<div class="card watch-card">
    <div class="row"><h2>⌚ Tu reloj</h2>${NATIVE ? '<button class="see" data-watch="sync">↻ Actualizar</button>' : ''}</div>
    <div class="minis watch-minis">
      ${m(w.steps.toLocaleString('es'), w.km ? `pasos · ${w.km.toLocaleString('es')} km` : 'pasos', '👣')}
      ${m(w.active || w.total || 0, w.active ? 'kcal activas' : 'kcal totales', '🔥')}
      ${w.hr ? m(w.hr.avg, `pulso prom. (${w.hr.min}–${w.hr.max})`, '❤️') : w.rhr ? m(w.rhr, 'pulso en reposo', '❤️') : ''}
      ${w.sleep ? m(fmtSleep(w.sleep.min), w.sleep.deep ? `sueño · ${fmtSleep(w.sleep.deep)} profundo` : 'de sueño', '😴') : ''}
      ${w.spo2 ? m(w.spo2 + '%', 'oxígeno (SpO2)', '🩸') : ''}
      ${w.n ? m(w.n, w.n === 1 ? 'entrenamiento' : 'entrenamientos', '🏃') : ''}
    </div>
    <p class="muted small" style="margin:8px 0 0">${ago < 1 ? 'Leído recién' : ago < 60 ? `Leído hace ${ago} min` : `Leído hace ${Math.round(ago / 60)} h`}${w.last ? ` · último dato del reloj: ${new Date(w.last).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}${w.n && watchCfg().workouts ? ' · los entrenamientos se suman en Ejercicio' : ''}</p>
    ${NATIVE && currentDate === todayKey() && (!w.last || Date.now() - new Date(w.last) > 90 * 60e3) ? '<p class="small watch-hint">¿Faltan pasos recientes? Abre <b>Mi Fitness</b>, deja que sincronice el reloj y vuelve aquí: Mi Fitness pasa los datos a Health Connect solo cuando sincroniza.</p>' : ''}
  </div>`;
}

// ---------- Tarjeta en Perfil ----------
function watchPerfilCard() {
  const cfg = watchCfg();
  if (!NATIVE) {
    return `<div class="card">
      <h2>⌚ Reloj y app Android</h2>
      <p class="muted small" style="margin-top:-6px">Instala FitPlan en tu teléfono Android para que lea solo tu reloj (Mi Fitness → Health Connect). Lo que lea se ve también aquí.</p>
      <a class="btn sm" href="${APK_URL}" style="text-decoration:none">⬇ Descargar app Android</a>
    </div>`;
  }
  return `<div class="card">
    <h2>⌚ Reloj</h2>
    <p class="muted small" style="margin-top:-6px">${cfg.on ? `Conectado a Health Connect${cfg.last ? ` · última lectura ${new Date(cfg.last).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.` : 'Aún no conectas tu reloj.'}</p>
    <label class="he-check" style="margin:6px 0 12px"><input type="checkbox" data-watch-opt="workouts" ${cfg.workouts ? 'checked' : ''}><span>Agregar los entrenamientos del reloj a Ejercicio</span></label>
    <div class="btn-row">
      ${cfg.on ? '<button class="btn sm" data-watch="sync30">↻ Leer últimos 30 días</button>' : '<button class="btn sm" data-watch="connect">Conectar reloj</button>'}
      <button class="btn ghost sm" data-watch="settings">Permisos de Health Connect</button>
      ${cfg.on ? '<button class="btn ghost sm" data-watch="diag">🔎 ¿Qué llega del reloj?</button>' : ''}
      ${cfg.on ? '<button class="btn ghost sm" data-watch="off">Desconectar</button>' : ''}
    </div>
  </div>`;
}

// ---------- Diagnóstico: qué está llegando a Health Connect hoy ----------
async function watchDiag() {
  if (!HC) return;
  openModal('<h2>⌚ Qué llega del reloj</h2><p class="muted">Revisando Health Connect…</p>');
  const s = parseKey(todayKey());
  const range = { startDate: s.toISOString(), endDate: new Date().toISOString() };
  const names = { steps: 'Pasos', distance: 'Distancia', calories: 'Calorías activas', totalCalories: 'Calorías totales', heartRate: 'Pulso', restingHeartRate: 'Pulso en reposo', oxygenSaturation: 'Oxígeno', sleep: 'Sueño', weight: 'Peso' };
  let denied = [];
  try { const a = await HC.checkAuthorization({ read: WATCH_READ, write: [] }); denied = a.readDenied || []; } catch (e) { /* ignorar */ }
  const rows = [];
  for (const t of Object.keys(names)) {
    let list = [], err = '';
    try { list = (await HC.readSamples({ dataType: t, ...range, limit: 5000 })).samples || []; } catch (e) { err = e.message || 'error'; }
    const srcs = [...new Set(list.map(x => x.sourceName || x.sourceId).filter(Boolean))];
    const sum = list.reduce((a, x) => a + (x.value || 0), 0);
    const last = list.reduce((m, x) => (x.endDate > m ? x.endDate : m), '');
    rows.push(`<div class="item"><div style="flex:1"><b>${names[t]}</b><div class="muted small">${denied.includes(t) ? '🚫 sin permiso' : err ? 'error: ' + esc(err) : list.length ? `${list.length} registros · ${['steps', 'distance', 'calories', 'totalCalories'].includes(t) ? 'suma ' + Math.round(sum) + ' · ' : ''}último ${last ? new Date(last).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}${srcs.length ? ' · de ' + esc(srcs.join(', ')) : ''}` : 'sin datos hoy'}</div></div></div>`);
  }
  let wk = 0;
  try { wk = ((await HC.queryWorkouts({ ...range, limit: 50 })).workouts || []).length; } catch (e) { /* ignorar */ }
  const m = $('.modal');
  if (m) m.innerHTML = `<h2>⌚ Qué llega del reloj (hoy)</h2>
    ${rows.join('')}<div class="item"><div><b>Entrenamientos</b><div class="muted small">${denied.includes('workouts') ? '🚫 sin permiso' : wk ? wk + ' hoy' : 'ninguno hoy'}</div></div></div>
    <p class="muted small">Si algo dice "sin datos hoy", revisa en Mi Fitness → Perfil → Health Connect que ese dato esté activado. Si dice "sin permiso", toca abajo y dale permiso a FitPlan.</p>
    <div class="btn-row"><button class="btn sm" data-watch="settings">Permisos de Health Connect</button><button class="btn ghost sm" onclick="closeModal()">Cerrar</button></div>`;
}

// Botones del reloj (en cualquier pantalla)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-watch]');
  if (b) {
    const a = b.dataset.watch;
    if (a === 'connect') connectWatch();
    if (a === 'sync') syncWatch();
    if (a === 'sync7') syncWatch({ days: 7 });
    if (a === 'sync30') syncWatch({ days: 30 });
    if (a === 'diag') watchDiag();
    if (a === 'settings' && HC) HC.openHealthConnectSettings().catch(() => toast('No pude abrir Health Connect'));
    if (a === 'off') { setWatchCfg({ on: false }); render(); toast('Reloj desconectado (lo ya leído se mantiene)'); }
    return;
  }
  const o = e.target.closest('[data-watch-opt]');
  if (o) setWatchCfg({ [o.dataset.watchOpt]: o.checked });
});

// Lectura automática: al abrir la app y al volver a ella (como mucho cada 10 minutos)
if (HC) {
  const auto = () => { const c = watchCfg(); if (c.on && Date.now() - c.last > 10 * 60e3) syncWatch({ quiet: true }); };
  setTimeout(auto, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auto(); });
}

// ---------- Progreso → Reloj: tendencias de pasos, sueño, pulso y calorías ----------
const STEP_GOAL = 8000, SLEEP_GOAL = 7 * 60;
function watchSeries(n) {
  return Array.from({ length: n }, (_, i) => { const k = shiftKey(todayKey(), -(n - 1 - i)); return { k, w: peekDay(k).watch || null }; });
}
function watchAvg(list, f) {
  const v = list.map(x => x.w && f(x.w)).filter(x => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
// Barras por día con línea de meta; sin dato = barra vacía
function watchBars(list, f, { color, goal, fmt = v => r0(v), unit = '', zoom = false }) {
  const vals = list.map(x => (x.w ? f(x.w) || 0 : 0));
  const max = Math.max(goal || 0, ...vals) * 1.1 || 1;
  // zoom: el eje parte cerca del mínimo (el pulso cambia pocos latidos y desde 0 todas las barras se ven iguales)
  const pos = vals.filter(v => v > 0);
  const lo = zoom && pos.length ? Math.max(0, Math.min(...pos) - 6) : 0;
  const W = 600, H = 170, B = 22, n = list.length, bw = (W - 10) / n;
  const y = v => H - B - ((v - lo) / (max - lo)) * (H - B - 12);
  const lbl = i => (n <= 7 ? 'LMMJVSD'[(parseKey(list[i].k).getDay() + 6) % 7] : (i % 5 === 0 || i === n - 1 ? parseKey(list[i].k).getDate() : ''));
  return `<svg viewBox="0 0 ${W} ${H}" class="wchart" role="img">
    ${goal ? `<line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" stroke="${color}" stroke-dasharray="5 5" opacity=".6"/><text x="${W - 4}" y="${y(goal) - 5}" text-anchor="end" class="axis">meta ${fmt(goal)}${unit}</text>` : ''}
    ${vals.map((v, i) => `<rect x="${5 + i * bw + bw * 0.15}" y="${v ? y(v) : H - B - 2}" width="${bw * 0.7}" height="${v ? H - B - y(v) : 2}" rx="${Math.min(6, bw * 0.25)}" fill="${color}" opacity="${v ? (goal && v < goal ? 0.55 : 1) : 0.15}"><title>${shortDate(list[i].k)}: ${v ? fmt(v) + unit : 'sin datos'}</title></rect>
      <text x="${5 + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" class="axis">${lbl(i)}</text>`).join('')}
  </svg>`;
}
function watchTab() {
  const n = ui.watchRange || 7;
  const list = watchSeries(n);
  const has = list.some(x => x.w);
  const range = `<div class="chips" style="margin-bottom:12px">${[[7, '7 días'], [30, '30 días']].map(([v, l]) => `<button class="chip ${n === v ? 'active' : ''}" data-watch-range="${v}">${l}</button>`).join('')}${NATIVE ? '<button class="chip" data-watch="sync30">↻ Leer 30 días</button>' : ''}</div>`;
  if (!has) {
    return range + `<div class="card"><h2>⌚ Tu reloj</h2><p class="muted">Aún no hay datos del reloj en ${n === 7 ? 'esta semana' : 'estos 30 días'}.</p>
      ${NATIVE ? '<button class="btn" data-watch="connect">Conectar reloj</button>' : `<p class="muted small">Instala la app Android (Perfil → Descargar app Android) y conecta tu reloj: lo que lea se verá aquí también en el PC.</p>`}</div>`;
  }
  const st = watchAvg(list, w => w.steps), sl = watchAvg(list, w => w.sleep && w.sleep.min), rhr = watchAvg(list, w => w.rhr || (w.hr && w.hr.min));
  const kc = watchAvg(list, w => w.active || 0), deep = watchAvg(list, w => w.sleep && w.sleep.deep);
  const stepDays = list.filter(x => x.w && x.w.steps >= STEP_GOAL).length, sleepDays = list.filter(x => x.w && x.w.sleep && x.w.sleep.min >= SLEEP_GOAL).length;
  // Pulso en reposo: semana actual vs anterior (si sube varios latidos puede ser cansancio o poco descanso)
  const r7 = watchAvg(watchSeries(7), w => w.rhr), rPrev = watchAvg(watchSeries(14).slice(0, 7), w => w.rhr);
  return range + `
    <div class="grid g4 keep" style="margin-bottom:16px">
      <div class="stat"><div class="label">Pasos promedio</div><span class="tile-ico">👣</span><div class="value">${st ? r0(st).toLocaleString('es') : '—'}</div></div>
      <div class="stat"><div class="label">Sueño promedio</div><span class="tile-ico">😴</span><div class="value">${sl ? fmtSleep(r0(sl)) : '—'}</div></div>
      <div class="stat"><div class="label">Pulso en reposo</div><span class="tile-ico">❤️</span><div class="value">${rhr ? r0(rhr) : '—'} <span class="unit">lpm</span></div></div>
      <div class="stat"><div class="label">Kcal activas</div><span class="tile-ico">🔥</span><div class="value">${kc ? r0(kc) : '—'} <span class="unit">/día</span></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="row"><h2>👣 Pasos</h2><span class="muted small">${stepDays} de ${n} días sobre ${STEP_GOAL.toLocaleString('es')}</span></div>${watchBars(list, w => w.steps, { color: 'var(--carb)', goal: STEP_GOAL, fmt: v => r0(v).toLocaleString('es') })}</div>
      <div class="card"><div class="row"><h2>😴 Sueño</h2><span class="muted small">${sleepDays} de ${n} noches con 7 h o más</span></div>${watchBars(list, w => w.sleep && w.sleep.min, { color: 'var(--water)', goal: SLEEP_GOAL, fmt: v => fmtSleep(r0(v)) })}
        ${deep ? `<p class="muted small" style="margin:6px 0 0">Sueño profundo promedio: ${fmtSleep(r0(deep))} por noche.</p>` : ''}</div>
      <div class="card"><div class="row"><h2>❤️ Pulso en reposo</h2>${r7 && rPrev ? `<span class="muted small">${r7 - rPrev >= 0 ? '+' : ''}${r0(r7 - rPrev)} lpm vs. semana anterior</span>` : ''}</div>${watchBars(list, w => w.rhr || (w.hr && w.hr.min), { color: 'var(--prot)', fmt: v => r0(v), unit: ' lpm', zoom: true })}
        <p class="muted small" style="margin:6px 0 0">Si sube 5 o más latidos por varios días, suele ser cansancio, poco sueño o que te estás enfermando: ese día entrena más suave.</p></div>
      <div class="card"><div class="row"><h2>🔥 Calorías activas</h2></div>${watchBars(list, w => w.active || 0, { color: 'var(--burn)', fmt: v => r0(v), unit: ' kcal' })}</div>
    </div>`;
}
// Para el coach: lo del reloj en pocas líneas
function watchCoachLines() {
  const list = watchSeries(7).filter(x => x.w);
  if (!list.length) return [];
  const st = watchAvg(list, w => w.steps), sl = watchAvg(list, w => w.sleep && w.sleep.min), rhr = watchAvg(list, w => w.rhr);
  const r7 = rhr, rPrev = watchAvg(watchSeries(14).slice(0, 7), w => w.rhr);
  const t = peekDay(todayKey()).watch;
  return [
    'Reloj (Mi Fitness → Health Connect), últimos 7 días: ' + list.map(x => `${x.k}: ${x.w.steps} pasos${x.w.active ? `, ${x.w.active} kcal activas` : ''}${x.w.sleep ? `, sueño ${fmtSleep(x.w.sleep.min)}${x.w.sleep.deep ? ` (${fmtSleep(x.w.sleep.deep)} profundo)` : ''}` : ''}${x.w.rhr ? `, pulso reposo ${x.w.rhr}` : ''}${x.w.spo2 ? `, SpO2 ${x.w.spo2}%` : ''}`).join('; ') + '.',
    `Promedios: ${st ? r0(st) + ' pasos/día' : 'sin pasos'}, ${sl ? 'sueño ' + fmtSleep(r0(sl)) : 'sin sueño'}${rhr ? `, pulso en reposo ${r0(rhr)}${rPrev ? ` (semana anterior ${r0(rPrev)})` : ''}` : ''}.`,
    t ? `Hoy según el reloj: ${t.steps} pasos${t.sleep ? `, durmió ${fmtSleep(t.sleep.min)} anoche` : ''}${t.hr ? `, pulso promedio ${t.hr.avg}` : ''}.` : '',
  ].filter(Boolean);
}
// Para el coach básico (sin IA): qué va bien y qué mejorar según el reloj
function watchCoachTips() {
  const list = watchSeries(7).filter(x => x.w);
  const good = [], improve = [];
  if (!list.length) return { good, improve };
  const st = watchAvg(list, w => w.steps), sl = watchAvg(list, w => w.sleep && w.sleep.min);
  const rhr = watchAvg(list, w => w.rhr), rPrev = watchAvg(watchSeries(14).slice(0, 7), w => w.rhr);
  const last = peekDay(todayKey()).watch;
  if (st >= STEP_GOAL) good.push(`Caminaste ${r0(st).toLocaleString('es')} pasos al día en promedio: sobre la meta de ${STEP_GOAL.toLocaleString('es')}.`);
  else if (st) improve.push(`Pasos: ${r0(st).toLocaleString('es')} al día. Una caminata de 20 min suma unos 2.000; apunta a ${STEP_GOAL.toLocaleString('es')}.`);
  if (sl >= SLEEP_GOAL) good.push(`Dormiste ${fmtSleep(r0(sl))} en promedio: buen descanso para recuperar.`);
  else if (sl) improve.push(`Sueño: ${fmtSleep(r0(sl))} en promedio. Con menos de 7 h da más hambre y cuesta más bajar; intenta acostarte 30 min antes.`);
  if (rhr && rPrev && rhr - rPrev >= 5) improve.push(`Tu pulso en reposo subió ${r0(rhr - rPrev)} latidos vs. la semana pasada: puede ser cansancio. Prioriza dormir y baja la intensidad un par de días.`);
  if (last && last.sleep && last.sleep.min < 6 * 60) improve.unshift(`Anoche dormiste ${fmtSleep(last.sleep.min)}: hoy entrena más suave y no te castigues si tienes más hambre.`);
  return { good, improve };
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-watch-range]');
  if (b) { ui.watchRange = Number(b.dataset.watchRange); render(); }
});

// ---------- Widget de la pantalla de inicio (app Android) ----------
// Cada vez que se guarda algo, se le pasan al widget los números de hoy (los mismos que muestra Hoy)
const WIDGET = NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins.FitPlanWidget : null;
let widgetTimer = 0;
function pushWidget() {
  if (!WIDGET || !state.profile) return;
  const k = todayKey(), d = peekDay(k), tg = calcTargets(), t = totals(d);
  const budget = tg.kcal + t.burned, left = budget - t.kcal;
  WIDGET.update({
    day: k, left: Math.round(left), eaten: Math.round(t.kcal), goal: Math.round(budget), over: left < 0,
    prot: Math.round(t.p), protGoal: Math.round(tg.prot), steps: d.watch ? d.watch.steps : -1, water: d.water, waterGoal: tg.water,
  }).catch(() => {});
}
if (WIDGET) {
  const baseSave = save;
  save = function (...a) { const r = baseSave.apply(this, a); clearTimeout(widgetTimer); widgetTimer = setTimeout(pushWidget, 800); return r; };
  setTimeout(pushWidget, 2000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushWidget(); });
}
