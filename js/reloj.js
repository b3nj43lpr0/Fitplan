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
  const sum = async t => {
    try { const r = await HC.queryAggregated({ dataType: t, ...range, bucket: 'day', aggregation: 'sum' }); return r.samples.reduce((a, x) => a + (x.value || 0), 0); } catch (err) { return 0; }
  };
  const samples = async (t, rg = range) => { try { return (await HC.readSamples({ dataType: t, ...rg, limit: 2000, ascending: true })).samples || []; } catch (err) { return []; } };
  // El sueño de "hoy" es la noche que terminó esta mañana: desde las 18:00 de ayer hasta las 18:00 de hoy
  const sleepRange = { startDate: new Date(s.getTime() - 6 * 3600e3).toISOString(), endDate: new Date(Math.min(s.getTime() + 18 * 3600e3, now.getTime())).toISOString() };
  const [steps, meters, active, total, hr, rhr, spo2, wts, sleep, wk] = await Promise.all([
    sum('steps'), sum('distance'), sum('calories'), sum('totalCalories'),
    samples('heartRate'), samples('restingHeartRate'), samples('oxygenSaturation'), samples('weight'), samples('sleep', sleepRange),
    HC.queryWorkouts({ ...range, limit: 50, ascending: true }).then(r => r.workouts || []).catch(() => []),
  ]);
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
    steps: Math.round(steps), km: Math.round(meters / 10) / 100, active: Math.round(active), total: Math.round(total),
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
    await syncWatch({ days: 7 });
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
    <p class="muted small" style="margin:8px 0 0">${ago < 1 ? 'Recién actualizado' : ago < 60 ? `Hace ${ago} min` : `Hace ${Math.round(ago / 60)} h`} · Mi Fitness → Health Connect${w.n && watchCfg().workouts ? ' · los entrenamientos se suman en Ejercicio' : ''}</p>
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
      ${cfg.on ? '<button class="btn sm" data-watch="sync7">↻ Leer últimos 7 días</button>' : '<button class="btn sm" data-watch="connect">Conectar reloj</button>'}
      <button class="btn ghost sm" data-watch="settings">Permisos de Health Connect</button>
      ${cfg.on ? '<button class="btn ghost sm" data-watch="off">Desconectar</button>' : ''}
    </div>
  </div>`;
}

// Botones del reloj (en cualquier pantalla)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-watch]');
  if (b) {
    const a = b.dataset.watch;
    if (a === 'connect') connectWatch();
    if (a === 'sync') syncWatch();
    if (a === 'sync7') syncWatch({ days: 7 });
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
