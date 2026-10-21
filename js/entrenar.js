// FitPlan · Rutina semanal, biblioteca de ejercicios y modo entrenamiento
'use strict';

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
  return exDB().filter(e => (e.cat === 'fuerza' || (nivel === 'avanzado' && e.cat === 'olímpico'))
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
// Tipos de rutina. Cada día es [nombre, espacios]; un espacio es "grupo", "grupo:músculo", "id:ejercicio" o "cardio"
const LEGS = ['piernas:cuádriceps', 'piernas:isquiotibiales', 'piernas:glúteo mayor', 'piernas:gemelos'];
const PROGRAMS = {
  auto: { label: 'Recomendada según tus días' },
  ppl: { label: 'Empuje / Tirón / Pierna', cycle: [['Empuje (pecho, hombro, tríceps)', ['pecho', 'pecho', 'hombros', 'hombros', 'brazos:tríceps']], ['Tirón (espalda, bíceps)', ['espalda', 'espalda', 'espalda', 'brazos:bíceps', 'brazos:bíceps']], ['Pierna', [...LEGS, 'core']]] },
  torso: { label: 'Torso / Pierna', cycle: [['Torso', ['pecho', 'espalda', 'hombros', 'espalda', 'brazos']], ['Pierna', [...LEGS, 'core']]] },
  full: { label: 'Cuerpo completo', cycle: SPLITS[3] },
  bro: { label: 'Un grupo por día', cycle: [['Pecho', ['pecho', 'pecho', 'pecho', 'pecho']], ['Espalda', ['espalda', 'espalda', 'espalda', 'espalda']], ['Piernas', LEGS], ['Hombros y abdomen', ['hombros', 'hombros', 'hombros', 'core', 'core']], ['Brazos', ['brazos:bíceps', 'brazos:tríceps', 'brazos:bíceps', 'brazos:tríceps']]] },
  gluteos: { label: 'Glúteos y piernas', cycle: [['Glúteos', ['piernas:glúteo mayor', 'piernas:glúteo mayor', 'piernas:isquiotibiales', 'piernas:glúteo medio', 'core']], ['Tren superior', ['espalda', 'pecho', 'hombros', 'brazos']], ['Piernas', ['piernas:cuádriceps', 'piernas:glúteo mayor', 'piernas:isquiotibiales', 'piernas:gemelos']]] },
  fuerza: { label: 'Fuerza 5×5 (básicos con barra)', gym: true, fixed: true, scheme: { series: 5, reps: '5', rest: '150 s' }, cycle: [['Fuerza A', ['id:squat', 'id:bench-press', 'id:barbell-row', 'core']], ['Fuerza B', ['id:squat', 'id:ohp', 'id:deadlift', 'core']]] },
  circuito: { label: 'Circuito quema grasa', fixed: true, scheme: { series: 3, reps: '40 s', rest: '15 s' }, cycle: [['Circuito A', ['piernas', 'pecho', 'espalda', 'cardio', 'core', 'cuerpo completo']], ['Circuito B', ['piernas', 'hombros', 'espalda', 'cardio', 'core', 'cuerpo completo']]] },
};
function programDays(prog, dias) {
  const p = PROGRAMS[prog];
  if (!p || !p.cycle) return SPLITS[dias];
  const n = p.cycle.length;
  return Array.from({ length: dias }, (_, i) => [p.cycle[i % n][0] + (dias > n ? ' ' + 'ABC'[Math.floor(i / n)] : ''), p.cycle[i % n][1]]);
}
// Arma un día: elige ejercicios para cada espacio y agrega calentamiento, superseries, final y estiramiento
function buildDay(name, groups, o, extra = 0) {
  const { objetivo, nivel, equipo } = o;
  const prog = PROGRAMS[o.programa] || {};
  const scheme = o.scheme || prog.scheme || {
    perder: { series: nivel === 'principiante' ? 3 : 4, reps: '12-15', rest: '45 s' },
    mantener: { series: 3, reps: '10-12', rest: '60 s' },
    ganar: { series: nivel === 'principiante' ? 3 : 4, reps: '8-12', rest: '90 s' },
  }[objetivo];
  const pool = exPool(equipo, nivel);
  const cardioPool = exDB().filter(e => e.cat === 'cardio' && (equipo === 'gym' || (equipo === 'casa' ? e.bw : e.home)));
  const used = new Set();
  const counters = o.counters || { piernas: 0, brazos: 0 };
  const g = [...groups];
  for (let i = 0; i < extra; i++) g.push(groups[i % groups.length]);
  if (!o.keepOrder) g.sort((a, b) => (a === 'core') - (b === 'core'));
  const list = g.map(slot => {
    const grp = slot.split(':')[0];
    let ex;
    if (grp === 'id') ex = exById(slot.slice(3));
    else if (grp === 'cardio') ex = shuffle(cardioPool.filter(e => !used.has(e.id)))[0];
    else ex = pickExercise(pool, slot, used, equipo, counters[grp] !== undefined ? counters[grp]++ : 0);
    if (!ex) return null;
    used.add(ex.id);
    const isCore = grp === 'core';
    const hold = /plancha|plank|hold|isométric/i.test(ex.n);
    const timed = /s\b|min/.test(scheme.reps);
    return { ex: ex.id, series: scheme.series, reps: hold && !timed ? '30-45 s' : isCore && !timed && !o.scheme ? '12-20' : scheme.reps, rest: scheme.rest };
  }).filter(Boolean);
  if (objetivo === 'perder' && !prog.fixed && !o.noFinisher) {
    const cardio = shuffle(cardioPool)[0];
    if (cardio) list.push({ ex: cardio.id, series: nivel === 'principiante' ? 3 : 4, reps: '40 s', rest: '20 s', finisher: true });
  }
  // Superseries (intermedio y avanzado): dos ejercicios seguidos de grupos distintos, descanso al final del par
  if (nivel !== 'principiante' && !prog.fixed && !o.scheme) {
    let letter = 0;
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      const ga = exById(a.ex).g, gb = exById(b.ex).g;
      if (a.finisher || b.finisher || ga === 'core' || gb === 'core' || ga === gb) continue;
      a.ss = b.ss = 'ABCDEF'[letter++];
      i++;
    }
  }
  // Calentamiento: 5 minutos de cardio suave y movilidad de los grupos del día
  const mainGroups = new Set(groups.map(x => x.startsWith('id:') ? (exById(x.slice(3)) || {}).g : x.split(':')[0]));
  const warm = [];
  const easy = shuffle(cardioPool)[0];
  if (easy && !o.noWarm) warm.push({ ex: easy.id, series: 1, reps: '5 min suave', rest: '-', warm: true });
  const mob = shuffle(exDB().filter(e => e.cat === 'estiramiento' && mainGroups.has(e.g) && e.bw))[0];
  if (mob && !o.noWarm) warm.push({ ex: mob.id, series: 1, reps: '30 s por lado', rest: '-', warm: true });
  // Un estiramiento al final para los grupos trabajados
  const stretch = shuffle(exDB().filter(e => e.cat === 'estiramiento' && mainGroups.has(e.g) && e.bw && (!mob || e.id !== mob.id)))[0];
  if (stretch) list.push({ ex: stretch.id, series: 1, reps: '30 s por lado', rest: '-', stretch: true });
  return { name, exercises: [...warm, ...list], done: false };
}
function generateRoutine(opts) {
  const o = { ...opts };
  // La rutina de fuerza necesita barra: fuera del gimnasio se usa la recomendada
  if (PROGRAMS[o.programa] && PROGRAMS[o.programa].gym && o.equipo !== 'gym') o.programa = 'auto';
  const prog = PROGRAMS[o.programa] || {};
  const extra = prog.fixed ? 0 : o.minutos >= 60 ? 2 : o.minutos >= 45 ? 1 : 0;
  const counters = { piernas: 0, brazos: 0 };
  const days = programDays(o.programa, o.dias).map(([name, groups]) => buildDay(name, groups, { ...o, counters, keepOrder: prog.fixed }, prog.cycle && groups.length >= 5 ? Math.max(0, extra - 1) : extra));
  return { ...o, days, created: todayKey(), v: 3 };
}
// Entrenamientos sueltos: una sesión de un día, sin cambiar la rutina
const QUICK = [
  { id: 'pecho', name: 'Pecho y tríceps', ico: '💪', slots: ['pecho', 'pecho', 'pecho', 'brazos:tríceps', 'brazos:tríceps'] },
  { id: 'espalda', name: 'Espalda y bíceps', ico: '🦾', slots: ['espalda', 'espalda', 'espalda', 'brazos:bíceps', 'brazos:bíceps'] },
  { id: 'piernas', name: 'Piernas', ico: '🦵', slots: ['piernas:cuádriceps', 'piernas:isquiotibiales', 'piernas:glúteo mayor', 'piernas:cuádriceps', 'piernas:gemelos'] },
  { id: 'gluteos', name: 'Glúteos', ico: '🍑', slots: ['piernas:glúteo mayor', 'piernas:glúteo mayor', 'piernas:glúteo medio', 'piernas:isquiotibiales', 'piernas:glúteo mayor'] },
  { id: 'hombros', name: 'Hombros y abdomen', ico: '🏋️', slots: ['hombros', 'hombros', 'hombros', 'core', 'core'] },
  { id: 'brazos', name: 'Brazos', ico: '💪', slots: ['brazos:bíceps', 'brazos:tríceps', 'brazos:bíceps', 'brazos:tríceps', 'brazos:antebrazo'] },
  { id: 'full', name: 'Cuerpo completo 30 min', ico: '⚡', slots: ['piernas', 'pecho', 'espalda', 'hombros'], noFinisher: true },
  { id: 'fuerza', name: 'Fuerza: básicos con barra', ico: '🏆', gym: true, slots: ['id:squat', 'id:bench-press', 'id:barbell-row'], scheme: { series: 5, reps: '5', rest: '150 s' } },
  { id: 'core', name: 'Core 15 min', ico: '🎯', slots: ['core', 'core', 'core', 'core'], scheme: { series: 3, reps: '30-40 s', rest: '20 s' }, noWarm: true },
  { id: 'hiit', name: 'HIIT 20 min', ico: '🔥', slots: ['cardio', 'cardio', 'cardio', 'cardio'], scheme: { series: 4, reps: '40 s', rest: '20 s' } },
];
function quickOpts() {
  const r = state.routine, p = state.profile;
  return { objetivo: r ? r.objetivo : p.objetivo, nivel: r ? r.nivel : 'principiante', equipo: r ? r.equipo : 'gym' };
}
function quickDay(q) {
  const o = quickOpts();
  return buildDay(q.name, q.slots, { ...o, scheme: q.scheme, noFinisher: q.noFinisher || !!q.scheme, noWarm: q.noWarm, keepOrder: !!q.scheme });
}
function quickCard() {
  const eq = quickOpts().equipo;
  return `<div class="card">
    <h2 style="margin-bottom:4px">⚡ Entrenamiento suelto</h2>
    <p class="muted small" style="margin:0 0 10px">Una sesión para hoy, sin cambiar tu rutina.</p>
    <div class="quick-grid">${QUICK.filter(q => !q.gym || eq === 'gym').map(q => `<button class="quick" data-quick-w="${q.id}"><span>${q.ico}</span>${q.name}</button>`).join('')}</div>
  </div>`;
}
function openQuick(id) {
  const q = QUICK.find(x => x.id === id);
  let dd = quickDay(q);
  const paint = m => {
    m.querySelector('#qkList').innerHTML = dd.exercises.map(x => { const e = exById(x.ex); return `<div class="ex">${exThumb(e)}<span class="ex-name">${esc(e.n)}${slotTags(x, dd.exercises)}<span class="muted small">${x.series} × ${esc(x.reps)}${x.rest !== '-' ? ' · ' + esc(x.rest) : ''}</span></span></div>`; }).join('');
  };
  openModal(`<h2 style="padding-right:30px">${q.ico} ${esc(q.name)}</h2>
    <p class="muted small" style="margin-top:-6px">${EQUIP_OPTS[quickOpts().equipo]} · ${dd.exercises.length} ejercicios</p>
    <div class="day-list" id="qkList"></div>
    <div class="btn-row" style="margin-top:12px"><button class="btn" id="qkGo" style="flex:1">▶ Empezar</button><button class="btn ghost" id="qkNew">🔄 Otra variante</button></div>`, m => {
    paint(m);
    m.querySelector('#qkNew').addEventListener('click', () => { dd = quickDay(q); paint(m); tap(); });
    m.querySelector('#qkGo').addEventListener('click', () => { closeModal(); startWorkout(-1, dd); });
  });
}
function exThumb(e) {
  if (!e.img || !e.img.length) return '<span class="ex-thumb ex-ph" aria-hidden="true">🏋️</span>';
  return `<img class="ex-thumb" loading="lazy" src="${EX_IMG_BASE + e.img[e.img.length - 1]}" alt="" onerror="this.style.visibility='hidden'">`;
}
// Etiquetas de un ejercicio dentro de la rutina
function slotTags(x, list) {
  const ssPos = x.ss ? list.filter(y => y.ss === x.ss).indexOf(x) + 1 : 0;
  return (x.warm ? ' <span class="tag neutral">calentamiento</span>' : '')
    + (x.ss ? ` <span class="tag ss">superserie ${x.ss}${ssPos}</span>` : '')
    + (x.finisher ? ' <span class="tag type">final</span>' : '')
    + (x.stretch ? ' <span class="tag neutral">estiramiento</span>' : '');
}
// ---------- Sin señal: guardar imágenes de ejercicios en la caché del service worker ----------
const STATIC_CACHE = 'fitplan-static-v1';
const offlineOk = () => 'caches' in window && 'serviceWorker' in navigator && location.protocol.startsWith('http');
function imgUrls(ids) {
  return [...new Set(ids)].map(exById).filter(e => e && e.img).flatMap(e => e.img.map(im => EX_IMG_BASE + im));
}
const routineImgs = () => state.routine ? imgUrls(state.routine.days.flatMap(d => d.exercises.map(x => x.ex))) : [];
async function countCached(urls) {
  if (!offlineOk()) return 0;
  const c = await caches.open(STATIC_CACHE);
  const hits = await Promise.all(urls.map(u => c.match(u)));
  return hits.filter(Boolean).length;
}
// Descarga con 4 a la vez; el service worker las guarda al pasar
async function saveOffline(urls, onProgress) {
  let i = 0, done = 0, failed = 0;
  const c = await caches.open(STATIC_CACHE);
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      if (!(await c.match(u))) {
        try { const res = await fetch(u); if (res.ok) await c.put(u, res); else failed++; } catch (e) { failed++; }
      }
      done++;
      if (onProgress) onProgress(done, urls.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return failed;
}
async function paintOffline() {
  const box = $('#offlineBox');
  if (!box || !offlineOk()) return;
  const urls = routineImgs();
  const n = await countCached(urls);
  if (!$('#offlineBox')) return;
  box.innerHTML = n >= urls.length
    ? '<span class="muted small">📶 Lista para entrenar sin señal</span>'
    : `<button class="see" id="offlineBtn">📥 Guardar mi rutina para usarla sin señal (${urls.length - n} imágenes)</button>`;
  const b = $('#offlineBtn');
  if (b) b.addEventListener('click', async () => {
    b.disabled = true;
    const failed = await saveOffline(urls, (d, t) => { b.textContent = `Guardando… ${d}/${t}`; });
    toast(failed ? 'Algunas imágenes no se pudieron guardar; inténtalo con mejor señal' : '📶 Rutina guardada para entrenar sin señal');
    paintOffline();
  });
}
function viewRutinas() {
  const head = pageHead('Entrenar') + tabs('rut', ui.rutTab, [['rutina', '🏋️ Mi rutina'], ['actividad', '🔥 Actividad'], ['biblioteca', '📚 Ejercicios']]);
  return head + (ui.rutTab === 'biblioteca' ? viewBiblioteca() : ui.rutTab === 'actividad' ? viewEjercicio() : viewMiRutina());
}
function viewMiRutina() {
  let r = state.routine;
  if (r && !(r.v >= 2)) r = state.routine = null; // rutinas antiguas usaban otra lista de ejercicios
  const p = state.profile;
  const o = r || { objetivo: p.objetivo, nivel: 'principiante', dias: 3, equipo: 'gym', minutos: 45, programa: 'auto' };
  const kcalSesion = burnedKcal(o.objetivo === 'perder' ? 6 : 5, o.minutos);
  const cfg = `
    <div class="grid g2 keep" style="gap:10px">
      <div class="field"><label for="rObj">Objetivo</label><select id="rObj">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${k === o.objetivo ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
      <div class="field"><label for="rNivel">Nivel</label><select id="rNivel">${['principiante', 'intermedio', 'avanzado'].map(n => `<option value="${n}" ${n === o.nivel ? 'selected' : ''}>${n[0].toUpperCase() + n.slice(1)}</option>`).join('')}</select></div>
      <div class="field"><label for="rDias">Días por semana</label><select id="rDias">${[2, 3, 4, 5, 6].map(n => `<option ${n === Number(o.dias) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="rMin">Minutos por sesión</label><select id="rMin">${[30, 45, 60, 75].map(n => `<option ${n === Number(o.minutos) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="rProg">Tipo de rutina</label><select id="rProg">${Object.entries(PROGRAMS).map(([k, x]) => `<option value="${k}" ${k === (o.programa || 'auto') ? 'selected' : ''}>${x.label}${x.gym ? ' · solo gimnasio' : ''}</option>`).join('')}</select></div>
    <div class="field"><label for="rEq">Dónde entrenas</label><select id="rEq">${Object.entries(EQUIP_OPTS).map(([k, l]) => `<option value="${k}" ${o.equipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <button class="btn" id="genRoutine" style="width:100%">${r ? '🔄 Generar nueva rutina' : '✨ Generar mi rutina'}</button>`;
  if (!r) return `<div class="card"><h2>Arma tu rutina semanal</h2><p class="muted small" style="margin-top:-6px">Elige cómo entrenas y te armo los días con ejercicios, series y descansos.</p>${cfg}</div>${quickCard()}`;
  const done = r.days.filter(x => x.done).length;
  const next = r.days.findIndex(x => !x.done);
  const open = ui.openDay === undefined ? next : ui.openDay;
  const ses = activeSession();
  return `
    <div class="card week-card">
      <div class="week-top"><div><div class="muted small">${(PROGRAMS[r.programa] || PROGRAMS.auto).label} · ${EQUIP_OPTS[r.equipo]} · ≈ ${r0(kcalSesion)} kcal por sesión</div>
        <b class="wk-title">Semana ${r.week || 1}: ${done} de ${r.days.length} entrenamientos</b></div>
        <button class="round-btn" id="cfgToggle" aria-label="Ajustar rutina" aria-expanded="${!!ui.rutCfg}">⚙️</button></div>
      <div class="week-dots">${r.days.map((x, i) => `<span class="${x.done ? 'on' : i === next ? 'next' : ''}"></span>`).join('')}</div>
      ${offlineOk() ? '<div id="offlineBox" class="offline-box"></div>' : ''}
      ${r.deload ? '<div class="warn-box info">🧘 <b>Semana de descarga.</b> Tras 4 semanas de carga, esta semana haces menos series y un poco menos de peso: así el cuerpo se recupera y después vuelves más fuerte. <button class="see" id="skipDeload">Saltarla</button></div>'
        : `<p class="muted small" style="margin:8px 0 0">Próxima semana de descarga: semana ${Math.ceil(((r.week || 1) + 1) / DELOAD_EVERY) * DELOAD_EVERY}</p>`}
      ${ui.rutCfg ? `<div class="cfg-box">${cfg}</div>` : ''}
    </div>
    ${r.days.map((dd, i) => { const isOpen = i === open; return `
      <div class="card day ${dd.done ? 'done' : ''} ${isOpen ? 'open' : ''}">
        <button class="day-head" data-toggle-day="${i}" aria-expanded="${isOpen}">
          <span class="day-n">${dd.done ? '✓' : i + 1}</span>
          <span class="day-t"><b>${esc(dd.name)}</b><span class="muted small">${dd.exercises.length} ejercicios · ${r.minutos} min${i === next ? ' · <b style="color:var(--accent)">te toca</b>' : ''}</span></span>
          <span class="chev">›</span>
        </button>
        ${isOpen ? `
          ${dd.done ? '' : `<button class="btn start-btn" data-start="${i}">▶ ${ses && ses.dayIdx === i ? 'Continuar' : 'Empezar'} entrenamiento</button>`}
          <div class="day-list">${dd.exercises.map((x, j) => { const e = exById(x.ex); return e ? `
            <div class="ex" data-ex="${e.id}" data-slot="${i}:${j}" tabindex="0" role="button">
              ${exThumb(e)}
              <span class="ex-name">${esc(e.n)}${slotTags(x, dd.exercises)}<span class="muted small">${x.series} × ${esc(x.reps)}${x.rest !== '-' ? ' · ' + esc(x.rest) : ''}${suggestion(x) && suggestion(x).up ? ' · <b style="color:var(--accent)">↑ subir peso</b>' : ''}</span></span>
            </div>` : ''; }).join('')}</div>
          <button class="see" data-done="${i}">${dd.done ? 'Desmarcar como hecho' : 'Ya lo hice: marcar como hecho'}</button>
          <p class="muted small day-hint">Toca un ejercicio para ver la técnica o cambiarlo por otro.</p>` : ''}
      </div>`; }).join('')}
    ${quickCard()}`;
}
function viewBiblioteca() {
  const groups = ['todos', 'pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'core', 'cuerpo completo'];
  const equips = { todos: 'Cualquier equipo', casa: 'Sin equipo', casa_equipo: 'En casa', gym: 'Solo gimnasio' };
  const q = norm(ui.exQuery.trim());
  const list = exDB().filter(e =>
    (ui.exGroup === 'todos' || e.g === ui.exGroup)
    && (ui.exEquip === 'todos' || (ui.exEquip === 'casa' ? e.bw : ui.exEquip === 'casa_equipo' ? e.home : !e.home))
    && (!q || norm(e.n + ' ' + e.m.join(' ') + ' ' + e.eq).includes(q)));
  const shown = list.slice(0, 60);
  return `
    <div class="card">
      <input id="exSearch" type="search" placeholder="Buscar: sentadilla, bíceps, mancuernas…" value="${esc(ui.exQuery)}" autocomplete="off" style="margin-bottom:10px">
      <div class="chips scroll-x">${groups.map(g => `<button class="chip ${g === ui.exGroup ? 'active' : ''}" data-exg="${g}">${g === 'todos' ? 'Todos' : g[0].toUpperCase() + g.slice(1)}</button>`).join('')}</div>
      <div class="chips">${Object.entries(equips).map(([k, l]) => `<button class="chip ${k === ui.exEquip ? 'active' : ''}" data-exe="${k}">${l}</button>`).join('')}</div>
      <div class="row"><span class="muted small">${list.length} ejercicios${list.length > shown.length ? ` (mostrando ${shown.length}; filtra para ver otros)` : ''}</span><button class="btn sm ghost" id="newEx">＋ Crear ejercicio</button></div>
      ${offlineOk() ? '<button class="see" id="libOffline">📥 Descargar todas las imágenes para usar sin señal (≈22 MB)</button>' : ''}
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
      ${e.custom && !slot ? '<button class="btn ghost" id="delEx" style="color:var(--danger)">Eliminar</button>' : ''}
    </div>
    <p class="muted small">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener">RepDB (repdb.co)</a></p>`, m => {
    const de = m.querySelector('#delEx');
    if (de) de.addEventListener('click', () => {
      if (!confirm('¿Eliminar este ejercicio?')) return;
      state.customExercises = state.customExercises.filter(x => x.id !== e.id);
      save(); closeModal(); render();
    });
    const sw = m.querySelector('#swapEx');
    if (sw) sw.addEventListener('click', () => {
      const [di, xi] = slot.split(':').map(Number);
      const r = state.routine;
      const dd = r.days[di];
      const cur = dd.exercises[xi];
      const usedIds = new Set(dd.exercises.map(x => x.ex));
      let pool = cur.stretch ? exDB().filter(x => x.cat === 'estiramiento' && x.g === e.g && x.bw)
        : cur.finisher ? exDB().filter(x => x.cat === 'cardio')
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
  $$('[data-tab-rut]').forEach(b => b.addEventListener('click', () => { ui.rutTab = b.dataset.tabRut; render(); animateEnter(); }));
  if (ui.rutTab === 'actividad') return bind.ejercicio();
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
  paintOffline();
  const lo = $('#libOffline');
  if (lo) lo.addEventListener('click', async () => {
    if (!confirm('Se descargarán unas 1.300 imágenes (≈22 MB). Conviene hacerlo con wifi. ¿Continuar?')) return;
    lo.disabled = true;
    const failed = await saveOffline(imgUrls(exDB().map(e => e.id)), (d, t) => { lo.textContent = `Descargando… ${d}/${t}`; });
    lo.textContent = failed ? `Listo, faltaron ${failed} imágenes (vuelve a intentarlo)` : '📶 Biblioteca completa guardada';
  });
  const ne = $('#newEx');
  if (ne) ne.addEventListener('click', () => openModal(`
    <h2>Crear ejercicio</h2>
    <div class="field"><label for="ceName">Nombre</label><input id="ceName" placeholder="Ej: Remo en máquina del gimnasio"></div>
    <div class="grid g2 keep" style="gap:10px">
      <div class="field"><label for="ceG">Grupo</label><select id="ceG">${['pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'core', 'cuerpo completo'].map(g => `<option>${g}</option>`).join('')}</select></div>
      <div class="field"><label for="ceEq">Equipo</label><select id="ceEq"><option value="bw">Sin equipo</option><option value="home">Mancuernas o bandas</option><option value="gym" selected>Gimnasio</option></select></div>
    </div>
    <div class="field"><label for="ceM">Músculos (separados por coma)</label><input id="ceM" placeholder="Ej: dorsales, bíceps"></div>
    <div class="field"><label for="ceIns">Cómo se hace (un paso por línea, opcional)</label><textarea id="ceIns" rows="3"></textarea></div>
    <button class="btn" id="ceSave" style="width:100%">Guardar ejercicio</button>`, m => {
    m.querySelector('#ceSave').addEventListener('click', () => {
      const v = x => m.querySelector(x).value.trim();
      if (!v('#ceName')) return toast('Ponle un nombre');
      const eq = v('#ceEq');
      state.customExercises.push({
        id: 'u_' + uid(), n: v('#ceName'), d: '', cat: 'fuerza', g: v('#ceG'), custom: true,
        eq: { bw: 'sin equipo', home: 'mancuernas o bandas', gym: 'gimnasio' }[eq], bw: eq === 'bw', home: eq !== 'gym', lv: 'principiante',
        m: v('#ceM') ? v('#ceM').split(',').map(x => x.trim()).filter(Boolean) : [v('#ceG')], m2: [], img: [],
        ins: v('#ceIns').split('\n').map(x => x.trim()).filter(Boolean), tips: [],
      });
      ui.exQuery = ''; ui.exGroup = 'todos'; ui.exEquip = 'todos';
      save(); closeModal(); render(); toast('Ejercicio creado: aparece en la biblioteca y en tus rutinas');
    });
  }));
  $$('[data-exg]').forEach(b => b.addEventListener('click', () => { ui.exGroup = b.dataset.exg; render(); }));
  $$('[data-exe]').forEach(b => b.addEventListener('click', () => { ui.exEquip = b.dataset.exe; render(); }));
  const gr = $('#genRoutine');
  if (gr) gr.addEventListener('click', () => {
    const programa = $('#rProg').value;
    state.routine = generateRoutine({
      objetivo: $('#rObj').value, nivel: $('#rNivel').value, dias: Number($('#rDias').value),
      equipo: $('#rEq').value, minutos: Number($('#rMin').value), programa,
    });
    ui.rutCfg = false; ui.openDay = undefined;
    save(); render();
    toast(state.routine.programa !== programa ? 'La rutina de fuerza necesita gimnasio: armé la recomendada' : 'Rutina generada');
    // Las imágenes de la rutina nueva se guardan solas para entrenar sin señal
    if (offlineOk()) saveOffline(routineImgs()).then(paintOffline);
  });
  $$('[data-done]').forEach(b => b.addEventListener('click', () => { setDayDone(Number(b.dataset.done)); ui.openDay = undefined; save(); render(); }));
  $$('[data-toggle-day]').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.toggleDay);
    const cur = ui.openDay === undefined ? state.routine.days.findIndex(x => !x.done) : ui.openDay;
    ui.openDay = cur === i ? -1 : i; render();
  }));
  const sd = $('#skipDeload');
  if (sd) sd.addEventListener('click', () => { state.routine.deload = false; save(); render(); toast('Descarga saltada: semana normal'); });
  const ct = $('#cfgToggle');
  if (ct) ct.addEventListener('click', () => { ui.rutCfg = !ui.rutCfg; render(); });
  $$('[data-start]').forEach(b => b.addEventListener('click', () => startWorkout(Number(b.dataset.start))));
  $$('[data-quick-w]').forEach(b => b.addEventListener('click', () => openQuick(b.dataset.quickW)));
};
// Marca (o desmarca) un día de la rutina y suma el ejercicio a hoy
function setDayDone(i, minutes) {
  const r = state.routine;
  const dd = r.days[i];
  dd.done = !dd.done;
  const d = day(todayKey());
  const tag = 'rutina-' + i;
  if (dd.done) {
    const met = r.objetivo === 'perder' ? 6 : 5;
    const min = minutes || r.minutos;
    d.exercises.push({ id: uid(), tag, name: 'Rutina: ' + dd.name, minutes: min, kcal: burnedKcal(met, min) });
    toast('¡Bien! Ejercicio sumado a hoy 💪');
  } else {
    d.exercises = d.exercises.filter(e => e.tag !== tag);
  }
  if (r.days.every(x => x.done)) {
    r.days.forEach(x => { x.done = false; });
    // Cada 4 semanas de carga viene 1 de descarga para recuperarse
    const wasDeload = r.deload;
    r.week = (r.week || 1) + 1;
    r.deload = !wasDeload && r.week % DELOAD_EVERY === 0;
    toast(r.deload ? '¡Semana completa! La próxima es de descarga 🧘' : '¡Semana completa! Empieza la semana ' + r.week + ' 🎉');
  }
}
const DELOAD_EVERY = 5; // 4 semanas de carga + 1 de descarga
const deloadOn = () => !!(state.routine && state.routine.deload);
// En descarga: ~60 % de las series y ~90 % del peso
const deloadSeries = x => (x.warm || x.stretch) ? x.series : Math.max(2, Math.round(x.series * 0.6));
const round25 = kg => Math.round(kg / 2.5) * 2.5 || r1(kg);
// Últimas sesiones de un ejercicio (sin contar semanas de descarga)
function exHistory(exId, n = 5) {
  const out = [];
  for (let i = state.workouts.length - 1; i >= 0 && out.length < n; i--) {
    const w = state.workouts[i], x = w.ex.find(e => e.id === exId);
    if (x) out.push({ d: w.d, sets: x.sets, deload: w.deload });
  }
  return out;
}

// ---------- Modo entrenamiento ----------
// La sesión en curso se guarda solo en este dispositivo para no sincronizar cada serie
const SESSION_KEY = pkey('fitplan-session');
function activeSession() {
  // Una sesión suelta guarda su propio día; una de la rutina apunta a su índice
  try { const x = JSON.parse(localStorage.getItem(SESSION_KEY)); return x && (x.day || (state.routine && state.routine.days[x.dayIdx])) ? x : null; } catch (e) { return null; }
}
function storeSession(x) {
  try { x ? localStorage.setItem(SESSION_KEY, JSON.stringify(x)) : localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignorar */ }
}
const restSecs = r => { const n = parseInt(r, 10); return isNaN(n) ? 0 : n; };
// Series de la última vez que hiciste este ejercicio
function lastSets(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    if (state.workouts[i].deload) continue; // la descarga no cuenta para progresar
    const x = state.workouts[i].ex.find(e => e.id === exId);
    if (x) return x.sets;
  }
  return null;
}
const e1rm = s => s.kg * (1 + s.reps / 30); // fórmula de Epley
// Progresión doble: si la última vez completaste todas las series en el tope del rango, sube el peso;
// si no, mismo peso y una repetición más
function repRange(r) {
  if (/s\b|min/.test(r)) return null;
  const n = String(r).match(/\d+/g);
  return n ? [Number(n[0]), Number(n[n.length - 1])] : null;
}
function suggestion(x) {
  const last = lastSets(x.ex), rg = repRange(x.reps);
  if (!last || !last.length || !rg || x.warm || x.stretch) return null;
  const [lo, hi] = rg;
  const top = last.every(z => z.reps >= hi) && last.length >= x.series;
  const kg = Math.max(0, ...last.map(z => Number(z.kg) || 0));
  if (kg > 0) {
    if (top) { const nk = r1(kg + (kg >= 20 ? 2.5 : 1)); return { kg: nk, reps: lo, up: true, msg: `Sube a ${nk} kg: la última vez completaste todas las series con ${kg} kg × ${hi}.` }; }
    const best = Math.max(...last.map(z => z.reps || 0));
    return { kg, reps: Math.min(hi, best + 1), msg: `Mantén ${kg} kg e intenta ${Math.min(hi, best + 1)} repeticiones.` };
  }
  if (top) return { kg: '', reps: hi + 2, up: true, msg: 'Ya dominas el rango: suma 2 repeticiones o agrega peso.' };
  return null;
}
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.25, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2);
    });
  } catch (e) { /* sin audio */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startWorkout(dayIdx, quick) {
  if (!exReady()) { loadExercises().then(() => startWorkout(dayIdx, quick)); return; }
  let ses = activeSession();
  const same = ses && !quick && ses.dayIdx === dayIdx && !ses.day;
  if (ses && !same && !confirm('Tienes otro entrenamiento sin terminar. ¿Descartarlo y empezar este?')) return;
  if (!same) {
    const dd = quick || state.routine.days[dayIdx];
    ses = {
      dayIdx, start: Date.now(), i: 0, day: quick || undefined,
      sets: dd.exercises.map(x => {
        const last = lastSets(x.ex), sg = suggestion(x);
        const reps = parseInt(x.reps, 10) || '';
        const dl = deloadOn() && !quick;
        const n = dl ? deloadSeries(x) : x.series;
        if (dl && sg && sg.kg) sg.kg = round25(Math.max(...lastSets(x.ex).map(z => Number(z.kg) || 0)) * 0.9);
        return Array.from({ length: n }, (_, k) => sg ? { kg: sg.kg, reps: sg.reps, done: false }
          : { kg: last && last[k] ? last[k].kg : '', reps: last && last[k] ? last[k].reps : reps, done: false });
      }),
    };
    storeSession(ses);
  }
  let timer = null, restEnd = 0;
  const dd = ses.day || state.routine.days[dayIdx];
  openModal('<div id="wk"></div>', m => {
    m.querySelector('.modal').classList.add('workout');
    const box = m.querySelector('#wk');
    const tick = () => {
      const t = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
      const el = box.querySelector('#restT');
      if (el) el.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      if (t <= 0 && timer) { clearInterval(timer); timer = null; beep(); paint(); }
    };
    const startRest = secs => {
      if (!secs) return;
      restEnd = Date.now() + secs * 1000;
      clearInterval(timer); timer = setInterval(tick, 250);
    };
    m._cleanup = () => clearInterval(timer);
    const paint = () => {
      const x = dd.exercises[ses.i];
      const e = exById(x.ex);
      const sets = ses.sets[ses.i];
      const total = ses.sets.flat().length, done = ses.sets.flat().filter(z => z.done).length;
      const last = lastSets(x.ex);
      const sg = suggestion(x);
      const pair = x.ss ? dd.exercises.map((y, k) => [y, k]).filter(([y]) => y.ss === x.ss) : [];
      const resting = timer && restEnd > Date.now();
      box.innerHTML = `
        <div class="wk-top"><span class="muted small">${esc(dd.name)} · ejercicio ${ses.i + 1} de ${dd.exercises.length}</span></div>
        <div class="bar" style="margin:6px 0 14px"><span style="width:${done / total * 100}%;background:var(--accent)"></span></div>
        ${x.warm ? '<div class="wk-badge">🔥 Calentamiento</div>' : ''}
        ${pair.length === 2 ? `<div class="wk-badge ss">Superserie ${x.ss} · ${pair[0][1] === ses.i ? `luego <b>${esc(exById(pair[1][0].ex).n)}</b>` : `alterna con <b>${esc(exById(pair[0][0].ex).n)}</b>`}</div>` : ''}
        <h2 style="margin:0 0 4px">${esc(e.n)}</h2>
        <div class="muted small">${x.series} × ${esc(x.reps)}${x.rest !== '-' ? ' · descanso ' + esc(x.rest) : ''}${last ? ` · la última vez: ${last.map(z => (z.kg ? z.kg + 'kg×' : '') + z.reps).join(', ')}` : ''}</div>
        ${deloadOn() && !ses.day && !x.warm && !x.stretch ? '<div class="hint-box">🧘 Semana de descarga: menos series y ~90 % del peso. Termina cada serie con 3 o 4 repeticiones en reserva.</div>' : sg ? `<div class="hint-box">💡 ${esc(sg.msg)}</div>` : ''}
        <div class="wk-img">${e.img.map(im => `<img src="${EX_IMG_BASE + im}" alt="" onerror="this.style.display='none'">`).join('')}</div>
        ${resting ? `<div class="rest-box"><div class="muted small">Descanso</div><div class="rest-t" id="restT"></div>
          <div class="btn-row" style="justify-content:center"><button class="btn ghost sm" id="rPlus">+15 s</button><button class="btn sm" id="rSkip">Saltar</button></div></div>` : ''}
        <div class="sets">
          <div class="set head"><span>Serie</span><span>kg</span><span>Reps</span><span></span></div>
          ${sets.map((z, k) => `<div class="set ${z.done ? 'done' : ''}">
            <span class="n">${k + 1}</span>
            <input type="number" inputmode="decimal" min="0" step="0.5" data-kg="${k}" value="${z.kg}" placeholder="—">
            <input type="number" inputmode="numeric" min="0" data-reps="${k}" value="${z.reps}">
            <button class="check-btn ${z.done ? 'on' : ''}" data-set="${k}" aria-label="Serie ${k + 1} hecha">✓</button>
          </div>`).join('')}
        </div>
        <button class="see" id="addSet">+ Agregar serie</button>
        <div class="btn-row wk-nav-btns">
          <button class="btn ghost" id="wPrev" ${ses.i === 0 ? 'disabled' : ''}>‹ Anterior</button>
          ${ses.i < dd.exercises.length - 1 ? '<button class="btn" id="wNext">Siguiente ›</button>' : '<button class="btn burn" id="wFinish">🏁 Terminar</button>'}
        </div>
        ${(() => { const h = exHistory(x.ex); return h.length ? `<details class="wk-info"><summary>📈 Historial (${h.length})</summary><div class="hist">${h.map(z => { const best = z.sets.filter(q => q.kg).reduce((a, q) => Math.max(a, e1rm(q)), 0); return `<div class="hist-row"><span class="muted small">${shortDate(z.d)}${z.deload ? ' · descarga' : ''}</span><span>${z.sets.map(q => (q.kg ? q.kg + '×' : '') + q.reps).join(' · ')}</span>${best ? `<b>${r0(best)} kg</b>` : '<b></b>'}</div>`; }).join('')}</div><p class="muted small" style="margin:4px 0 0">kg × repeticiones por serie · a la derecha, 1RM estimado</p></details>` : ''; })()}
        <details class="wk-info"><summary>Ver técnica</summary><ol>${e.ins.map(z => `<li>${esc(z)}</li>`).join('')}</ol>
          <a href="${ytUrl('cómo hacer ' + e.n + ' técnica')}" target="_blank" rel="noopener">▶ Video en YouTube</a></details>
        <button class="see" id="wQuit" style="color:var(--danger)">Descartar entrenamiento</button>`;
      if (resting) tick();
      const keep = () => storeSession(ses);
      box.querySelectorAll('[data-kg]').forEach(inp => inp.addEventListener('input', () => { sets[inp.dataset.kg].kg = inp.value === '' ? '' : Number(inp.value); keep(); }));
      box.querySelectorAll('[data-reps]').forEach(inp => inp.addEventListener('input', () => { sets[inp.dataset.reps].reps = inp.value === '' ? '' : Number(inp.value); keep(); }));
      box.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
        const z = sets[b.dataset.set];
        z.done = !z.done; keep();
        if (z.done) {
          // Al terminar una serie, la siguiente hereda el peso si estaba vacía
          const nx = sets[Number(b.dataset.set) + 1];
          if (nx && nx.kg === '' && z.kg !== '') nx.kg = z.kg;
          if (navigator.vibrate) navigator.vibrate(40);
          // Superserie: tras el primero se pasa al segundo sin descanso; tras el segundo, descanso y vuelta al primero
          if (pair.length === 2) {
            const [a, bIdx] = [pair[0][1], pair[1][1]];
            if (ses.i === a) { keep(); toast('Superserie: ahora ' + exById(pair[1][0].ex).n); return go2(bIdx); }
            startRest(restSecs(x.rest));
            if (ses.sets[a].some(q => !q.done)) return go2(a);
          } else startRest(restSecs(x.rest));
        }
        paint();
      }));
      box.querySelector('#addSet').addEventListener('click', () => { const l = sets[sets.length - 1]; sets.push({ kg: l ? l.kg : '', reps: l ? l.reps : '', done: false }); keep(); paint(); });
      const rp = box.querySelector('#rPlus'); if (rp) rp.addEventListener('click', () => { restEnd += 15000; tick(); });
      const rs = box.querySelector('#rSkip'); if (rs) rs.addEventListener('click', () => { clearInterval(timer); timer = null; paint(); });
      const go2 = n => { ses.i = n; keep(); paint(); box.parentNode.scrollTop = 0; };
      box.querySelector('#wPrev').addEventListener('click', () => go2(ses.i - 1));
      const nx = box.querySelector('#wNext'); if (nx) nx.addEventListener('click', () => go2(ses.i + 1));
      box.querySelector('#wQuit').addEventListener('click', () => {
        if (!confirm('¿Descartar este entrenamiento?')) return;
        storeSession(null); closeModal(); render();
      });
      const fin = box.querySelector('#wFinish');
      if (fin) fin.addEventListener('click', () => finishWorkout(ses));
    };
    paint();
  });
}
function finishWorkout(ses) {
  const dd = ses.day || state.routine.days[ses.dayIdx];
  const ex = dd.exercises.map((x, k) => ({ id: x.ex, sets: ses.sets[k].filter(z => z.done).map(z => ({ kg: Number(z.kg) || 0, reps: Number(z.reps) || 0 })) }))
    .filter(x => x.sets.length);
  if (!ex.length && !confirm('No marcaste ninguna serie. ¿Terminar igual?')) return;
  const minutes = Math.max(1, Math.round((Date.now() - ses.start) / 60000));
  // Récords: comparamos con todo el historial anterior
  const prs = ex.filter(x => {
    const best = Math.max(0, ...x.sets.filter(z => z.kg).map(e1rm));
    const prev = Math.max(0, ...state.workouts.flatMap(w => w.ex.filter(y => y.id === x.id).flatMap(y => y.sets.filter(z => z.kg).map(e1rm))));
    return best > 0 && prev > 0 && best > prev;
  }).map(x => exById(x.id).n);
  if (ex.length) state.workouts.push({ id: uid(), d: todayKey(), name: dd.name, minutes, ex, ...(deloadOn() && !ses.day ? { deload: true } : {}) });
  if (ses.day) {
    const met = (state.routine || state.profile).objetivo === 'perder' ? 6 : 5;
    day(todayKey()).exercises.push({ id: uid(), name: 'Entrenamiento: ' + dd.name, minutes, kcal: burnedKcal(met, minutes) });
  } else if (!dd.done) setDayDone(ses.dayIdx, minutes);
  storeSession(null);
  save(); closeModal(); render();
  const vol = ex.reduce((a, x) => a + x.sets.reduce((b, z) => b + z.kg * z.reps, 0), 0);
  openModal(`<div style="text-align:center">
    <div style="font-size:48px" class="trophy">🏆</div>
    <h2>¡Entrenamiento terminado!</h2>
    <div class="grid g3" style="gap:10px;margin:14px 0">
      ${tile('Tiempo', minutes, 'min', '⏱️')}${tile('Series', ex.reduce((a, x) => a + x.sets.length, 0), '', '✅')}${tile('Volumen', r0(vol), 'kg', '🏋️')}
    </div>
    ${prs.length ? `<p><b>🎉 Nuevo récord en:</b> ${esc(prs.join(', '))}</p>` : ''}
    <button class="btn" id="okW">Listo</button></div>`, m => m.querySelector('#okW').addEventListener('click', closeModal));
  confetti(90);
}
