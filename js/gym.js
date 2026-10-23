// FitPlan · Registrar los ejercicios que hiciste en el gimnasio: músculo → ejercicio → series (kg × reps) → calorías
'use strict';

// ---------- Grupos musculares finos (para buscar más rápido que con los 7 grupos de la biblioteca) ----------
const MUSCLE_GROUPS = [
  ['pecho', 'Pecho', '🫀'], ['espalda', 'Espalda', '🔙'], ['hombros', 'Hombros', '🤷'], ['biceps', 'Bíceps', '💪'],
  ['triceps', 'Tríceps', '🦾'], ['antebrazo', 'Antebrazo', '✊'], ['cuadriceps', 'Cuádriceps', '🦵'], ['femoral', 'Femoral', '🦿'],
  ['gluteos', 'Glúteos y cadera', '🍑'], ['pantorrillas', 'Pantorrillas', '🦶'], ['core', 'Abdomen', '🧱'], ['completo', 'Cuerpo completo', '🔥'],
];
const MUSCLE_MAP = {
  'bíceps': 'biceps', braquial: 'biceps', 'tríceps': 'triceps', antebrazo: 'antebrazo', braquiorradial: 'antebrazo',
  'cuádriceps': 'cuadriceps', isquiotibiales: 'femoral', 'glúteo mayor': 'gluteos', 'glúteo medio': 'gluteos', abductores: 'gluteos', aductores: 'gluteos',
  gemelos: 'pantorrillas', 'sóleo': 'pantorrillas', 'tibial anterior': 'pantorrillas',
};
function exMuscle(e) {
  if (e.cat === 'olímpico' || e.g === 'cuerpo completo') return 'completo';
  // Sentadillas, prensa y zancadas trabajan glúteo y cuádriceps: se buscan en Cuádriceps
  if (e.g === 'piernas' && e.m.includes('cuádriceps')) return 'cuadriceps';
  if (e.g === 'brazos' || e.g === 'piernas') {
    for (const m of e.m) if (MUSCLE_MAP[m]) return MUSCLE_MAP[m];
    return e.g === 'brazos' ? 'triceps' : 'gluteos';
  }
  return e.g;
}
// Tipo de equipo, para filtrar
const EQ_KINDS = [['maquina', 'Máquina'], ['barra', 'Barra'], ['mancuernas', 'Mancuernas'], ['polea', 'Polea'], ['corporal', 'Peso corporal'], ['otro', 'Kettlebell y otros']];
function eqKind(e) {
  const q = norm(e.eq);
  if (e.bw || /sin equipo|paralelas|barra de dominadas|anillas/.test(q)) return 'corporal';
  if (/polea|cable/.test(q)) return 'polea';
  if (/maquina|prensa|hack|pec deck|smith|ghd|banco de lumbares/.test(q)) return 'maquina';
  if (/mancuerna/.test(q)) return 'mancuernas';
  if (/barra/.test(q)) return 'barra';
  return 'otro';
}
// Nombres que se usan en el gimnasio y que no siempre están en el nombre del ejercicio
const EX_ALIASES = [
  [/extension de triceps tumbado|skull crusher/, 'press frances rompecraneos'],
  [/aperturas con cable|cruce de poleas/, 'cruce de poleas crossover'],
  [/curl de piernas|curl femoral|curl de pierna/, 'curl femoral isquios isquiotibiales'],
  [/extension de piernas|extension de cuadriceps/, 'cuadriceps maquina sillon de cuadriceps'],
  [/prensa de piernas/, 'prensa 45 leg press'],
  [/pantorrill|talon|gemel/, 'gemelos pantorrillas'],
  [/remo sentado en polea|remo en polea sentado|remo bajo/, 'remo bajo gironda polea baja'],
  [/jalon al pecho/, 'jalon polea alta lat pulldown dorsalera'],
  [/press militar|press de hombro/, 'press militar hombro'],
  [/pajaro|apertura inversa|deltoides posterior/, 'pajaro posterior vuelos posteriores'],
  [/pec deck|aperturas en maquina/, 'peck deck mariposa contractor'],
  [/hip thrust|empuje de cadera|empuje de gluteo/, 'hip thrust puente gluteo'],
  [/peso muerto rumano/, 'rdl rumano'],
  [/elevacion lateral/, 'vuelos laterales'],
  [/elevacion frontal/, 'vuelos frontales'],
  [/fondos/, 'dips'],
  [/dominada/, 'pull up barra'],
  [/zancada/, 'estocada lunge'],
  [/sentadilla/, 'squat'],
  [/martillo/, 'hammer'],
  [/patada de triceps/, 'kickback'],
  [/jalon de triceps|triceps en polea|triceps en cable|triceps con cuerda|triceps con barra recta/, 'polea alta triceps pushdown'],
  [/abduccion/, 'abductores'],
  [/aduccion/, 'aductores'],
  [/encogimiento/, 'trapecio shrug'],
  [/crunch|abdominal/, 'abdominales abs'],
  [/press de banca/, 'press banca pecho plano'],
  [/curl predicador|banco scott/, 'scott predicador'],
];
const exText = e => {
  if (!e._q) { const n = norm(e.n); e._q = norm([e.n, e.m.join(' '), e.m2.join(' '), e.eq, ...EX_ALIASES.filter(([r]) => r.test(n)).map(a => a[1])].join(' ')); }
  return e._q;
};
// Todas las palabras de la búsqueda deben aparecer (en cualquier orden)
function exSearch(e, q) { const t = exText(e); return norm(q).split(/\s+/).filter(Boolean).every(w => t.includes(w)); }
// Orden: los que ya hiciste, los que calzan con el nombre buscado y los más comunes del gimnasio (máquinas, barra, mancuernas, polea)
const EX_STAPLES = new Set(['press de banca con barra', 'sentadilla trasera con barra', 'peso muerto con barra', 'press militar con barra', 'remo con barra inclinado', 'jalon al pecho',
  'remo sentado en polea', 'prensa de piernas', 'extension de piernas', 'curl de piernas tumbado', 'curl de piernas sentado', 'curl con barra', 'curl de biceps con mancuernas',
  'curl de martillo con mancuernas', 'elevacion lateral con mancuernas', 'press de hombros con mancuernas', 'press con mancuernas en banco inclinado', 'press de banca con mancuernas',
  'aperturas con mancuernas', 'pec deck', 'hip thrust con barra', 'peso muerto rumano', 'dominada', 'fondos para pecho', 'jalon de triceps en cable',
  'extension de triceps con cuerda en polea alta', 'face pull en polea', 'elevacion de pantorrillas en maquina', 'abduccion de cadera en maquina', 'aduccion de cadera',
  'zancada con mancuernas', 'sentadilla bulgara', 'sentadilla goblet', 'crunches', 'plancha', 'elevacion de piernas colgado', 'remo con mancuerna a un brazo',
  'press en banco inclinado con barra', 'encogimiento de hombros con mancuernas', 'skull crusher', 'aperturas con cable', 'press de pecho en maquina', 'hack squat',
  'press de hombros en maquina', 'apertura inversa en maquina', 'curl predicador con barra', 'patada de triceps con mancuerna', 'abdominales en maquina sentado']);
function exRank(e, q, use) {
  let r = (use[e.id] ? 10 + Math.min(use[e.id], 10) : 0) + (EX_STAPLES.has(norm(e.n)) ? 4 : 0);
  if (q) {
    const n = norm(e.n), ws = norm(q).split(/\s+/).filter(Boolean);
    if (ws.every(w => n.includes(w))) r += 6;
    if (n.startsWith(ws[0] || '')) r += 2;
    r -= n.split(/\s+/).length * 0.15; // nombres más cortos = variante más común
  }
  r += { principiante: 2, intermedio: 1.5, avanzado: 0 }[e.lv] || 0;
  r += { maquina: 1.5, polea: 1.2, barra: 1.2, mancuernas: 1.2, corporal: 0.5, otro: 0 }[eqKind(e)];
  if (e.cat !== 'fuerza') r -= 2;
  return r;
}
// Ejercicios que más has hecho, primero
function exUsage() {
  const n = {};
  state.workouts.forEach((w, i) => w.ex.forEach(x => { n[x.id] = (n[x.id] || 0) + 1 + i / 1e4; }));
  return n;
}
const fmtSets = sets => sets.map(z => (z.kg ? z.kg + '×' : '') + z.reps).join(' · ');

// ---------- Calorías ----------
const GYM_INTENSITY = { suave: ['😌 Suave', 0.8], normal: ['🙂 Normal', 1], intensa: ['🥵 Intensa', 1.2] };
// Calorías del gym: el tiempo en serie (≈4 s por repetición, mínimo 20 s) va al gasto del ejercicio (MET)
// y el resto de la sesión es descanso activo (MET 2-3). Se suma un 10 % del trabajo por el gasto posterior (EPOC).
// Así una sesión larga con mucho descanso no cuenta como si fueran 60 minutos levantando sin parar.
function gymKcal(items, minutes, inten = 'normal') {
  const kg = currentWeight(), f = GYM_INTENSITY[inten][1];
  let workMin = 0, workKcal = 0;
  for (const x of items) {
    const e = x.id && exById(x.id), met = Math.min(9, Math.max(3, (e && e.met) || 5)) * f;
    for (const z of x.sets) {
      const sec = Math.max(20, (Number(z.reps) || 10) * 4);
      workMin += sec / 60;
      workKcal += met * kg * sec / 3600;
    }
  }
  const rest = Math.max(0, minutes - workMin);
  return workKcal * 1.1 + 2.5 * f * kg * rest / 60;
}
// Qué peso usar hoy (progresión doble, rango 8-12): si la última vez llegaste a 12 en todas las series, sube el peso;
// si no, mismo peso y una repetición más
function nextTarget(id) {
  const last = lastSets(id), e = exById(id);
  if (!last || !last.length) return null;
  const withKg = last.filter(z => Number(z.kg) > 0);
  const kind = e ? eqKind(e) : 'otro';
  if (!withKg.length) {
    const minR = Math.min(...last.map(z => Number(z.reps) || 0));
    return minR ? { kg: 0, reps: minR + 1, sets: last.length, why: `la última vez hiciste ${fmtSets(last)}: suma una repetición` } : null;
  }
  const top = Math.max(...withKg.map(z => Number(z.kg))), atTop = withKg.filter(z => Number(z.kg) === top);
  const minR = Math.min(...atTop.map(z => Number(z.reps) || 0));
  const step = kind === 'mancuernas' ? 2 : kind === 'corporal' ? 0 : top < 20 ? 1.25 : 2.5;
  if (minR >= 12 && step) return { kg: r1(top + step), reps: 8, sets: last.length, why: `la última vez hiciste ${top} kg × ${minR}+ en todas: ¡sube el peso!` };
  if (minR < 8) return { kg: top, reps: 8, sets: last.length, why: `la última vez ${top} kg × ${minR}: apunta a 8 con el mismo peso` };
  return { kg: top, reps: Math.min(12, minR + 1), sets: last.length, why: `la última vez ${top} kg × ${minR}: una repetición más con el mismo peso` };
}
const gymAutoMinutes = items => Math.max(10, Math.round(items.reduce((a, x) => a + x.sets.length, 0) * 2.5));
// Guarda la sesión: entrenamiento con series (cuenta para récords) + actividad del día con sus calorías
function logStrength(ex, minutes, kcal, { dateKey = currentDate, name = 'Gimnasio', replace } = {}) {
  const wid = replace ? replace.wid : uid();
  if (replace) {
    state.workouts = state.workouts.filter(w => w.id !== wid);
    for (const k of Object.keys(state.days)) state.days[k].exercises = state.days[k].exercises.filter(e => e.wid !== wid);
  }
  const prs = newPRs(ex);
  state.workouts.push({ id: wid, d: dateKey, name, minutes, ex });
  const names = ex.map(x => (exById(x.id) || { n: 'Ejercicio' }).n);
  day(dateKey).exercises.push({ id: uid(), wid, name: `${name}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` y ${names.length - 3} más` : ''}`, minutes, kcal });
  save();
  return prs;
}

// ---------- Hoja para registrar ----------
const GYM_KEY = pkey('fitplan-gymlog');
function gymDraft() { try { return JSON.parse(localStorage.getItem(GYM_KEY)); } catch (e) { return null; } }
function storeGymDraft(x) { try { x ? localStorage.setItem(GYM_KEY, JSON.stringify(x)) : localStorage.removeItem(GYM_KEY); } catch (e) { /* ignorar */ } }
// wid: editar una sesión ya guardada
function openGymLog(wid) {
  if (!exReady()) { loadExercises().then(() => openGymLog(wid)).catch(() => toast('No pude cargar los ejercicios. Revisa tu conexión.')); return; }
  let d;
  const w = wid && state.workouts.find(x => x.id === wid);
  if (w) {
    const entry = (state.days[w.d] || { exercises: [] }).exercises.find(e => e.wid === wid);
    d = { date: w.d, wid, minutes: w.minutes, inten: 'normal', items: w.ex.map(x => ({ id: x.id, sets: x.sets.map(z => ({ ...z })) })), kcal0: entry && entry.kcal };
  } else {
    d = gymDraft();
    if (!d || d.wid || (d.date !== currentDate && !d.items.length)) d = { date: currentDate, items: [], minutes: null, inten: 'normal' };
  }
  let screen = d.items.length ? 'session' : 'picker';
  let fGroup = ui.gymGroup || 'todos', fEq = 'todos', q = '', limit = 50;
  const keep = () => { if (!d.wid) storeGymDraft(d.items.length ? d : null); };
  openModal('<div id="gym"></div>', m => {
    m.querySelector('.modal').classList.add('gym-modal');
    // Al cerrar se redibuja la pantalla para mostrar si quedó un borrador
    m._cleanup = () => setTimeout(render);
    const box = m.querySelector('#gym');
    // Si anotas mientras entrenas, la duración sale del reloj (desde la primera serie que anotaste)
    const liveMin = () => (d.t0 && d.date === todayKey() ? Math.round((Date.now() - d.t0) / 60000) + 3 : 0);
    const minutes = () => d.minutes || (liveMin() >= 15 && liveMin() <= 240 ? liveMin() : gymAutoMinutes(d.items));
    const kcal = () => gymKcal(d.items, minutes(), d.inten);
    const summary = () => {
      const sets = d.items.reduce((a, x) => a + x.sets.length, 0), vol = d.items.reduce((a, x) => a + x.sets.reduce((b, z) => b + (Number(z.kg) || 0) * (Number(z.reps) || 0), 0), 0);
      return `<div class="minis gym-sum"><div class="mini"><b>${sets}</b><span>series</span></div><div class="mini"><b>${r0(vol)}</b><span>kg de volumen</span></div><div class="mini"><b style="color:var(--burn)">${r0(kcal())}</b><span>kcal quemadas</span></div></div>`;
    };
    // Récord si alguna serie supera tu mejor marca guardada (sin contar esta misma sesión si se está editando)
    const prTag = x => {
      const prev = Math.max(0, ...state.workouts.filter(w2 => w2.id !== d.wid).flatMap(w2 => w2.ex.filter(y => y.id === x.id).flatMap(y => y.sets.filter(z => z.kg).map(e1rm))));
      const top = x.sets.filter(z => Number(z.kg) && Number(z.reps)).reduce((a, z) => Math.max(a, e1rm({ kg: Number(z.kg), reps: Number(z.reps) })), 0);
      return top && prev && top > prev ? '<span class="pr-tag">🏆 Récord</span>' : '';
    };
    const paintSession = () => {
      const last = id => { for (let i = state.workouts.length - 1; i >= 0; i--) { const w2 = state.workouts[i]; if (w2.id === d.wid) continue; const x = w2.ex.find(y => y.id === id); if (x) return { d: w2.d, sets: x.sets }; } return null; };
      box.innerHTML = `<h2 style="padding-right:30px">🏋️ ${d.wid ? 'Editar entrenamiento' : 'Ejercicios del gym'}</h2>
        <p class="muted small" style="margin-top:-6px">${d.date === todayKey() ? 'Hoy' : prettyDate(d.date)} · anota el peso y las repeticiones de cada serie.</p>
        ${d.items.map((x, i) => {
          const e = exById(x.id) || { n: 'Ejercicio', m: [], img: [] }, l = last(x.id);
          return `<div class="gym-ex">
            <div class="gym-ex-h">${exThumb(e)}<div class="info"><b>${esc(e.n)}</b><span class="muted small">${esc(e.m.slice(0, 2).join(', '))}${l ? ` · última vez ${shortDate(l.d)}: ${fmtSets(l.sets)}` : ''}</span><span data-gx-pr="${i}">${prTag(x)}</span></div><button class="icon-btn" data-gx-del="${i}" aria-label="Quitar ejercicio">✕</button></div>
            ${(() => { const nt = !d.wid && nextTarget(x.id); return nt ? `<div class="gym-tip"><span>💡 Hoy: <b>${nt.kg ? nt.kg + ' kg × ' : ''}${nt.reps}</b> <span class="muted small">· ${esc(nt.why)}</span></span><button class="btn sm ghost" data-gx-tip="${i}">Usar</button></div>` : ''; })()}
            ${x.sets.map((z, k) => `<div class="gym-set"><span class="muted small">${k + 1}</span>
              <div class="field"><input type="number" min="0" step="0.5" inputmode="decimal" value="${z.kg}" placeholder="0" data-gs-kg="${i}:${k}" aria-label="Kilos serie ${k + 1}"><span class="unit-in">kg</span></div>
              <span class="muted">×</span>
              <div class="field"><input type="number" min="0" inputmode="numeric" value="${z.reps}" placeholder="0" data-gs-reps="${i}:${k}" aria-label="Repeticiones serie ${k + 1}"><span class="unit-in">reps</span></div>
              <button class="icon-btn" data-gs-del="${i}:${k}" aria-label="Quitar serie">−</button></div>`).join('')}
            <button class="see" data-gs-add="${i}">＋ Serie</button>
          </div>`;
        }).join('')}
        <button class="btn ghost" id="gAdd" style="width:100%;margin:6px 0 14px">＋ Agregar ejercicio</button>
        ${d.items.length ? `<div class="gym-foot">
          ${!d.minutes && liveMin() >= 15 && liveMin() <= 240 ? `<p class="muted small" style="margin:0 0 4px">⏱️ Llevas ${liveMin()} min desde tu primera serie</p>` : ''}
          <div class="row"><label for="gMin" class="small"><b>Duración</b> (min)</label><div class="field" style="margin:0;width:110px"><input id="gMin" type="number" min="1" inputmode="numeric" value="${minutes()}"></div></div>
          <div class="chips" style="margin:8px 0">${Object.entries(GYM_INTENSITY).map(([k, [l]]) => `<button class="chip ${k === d.inten ? 'active' : ''}" data-gi="${k}">${l}</button>`).join('')}</div>
          <div id="gSum">${summary()}</div>
          <p class="muted small" style="margin:6px 0">Calculado con tu peso (${r1(currentWeight())} kg), el tipo de ejercicios y la duración. Si tu reloj te dio las calorías, puedes anotarlas abajo en "¿Tu reloj ya te dio las calorías?".</p>
          <button class="btn burn" id="gSave" style="width:100%">${d.wid ? 'Guardar cambios' : 'Guardar entrenamiento'}</button>
          ${d.wid ? '' : '<button class="see" id="gClear" style="color:var(--danger);margin-top:8px">Descartar</button>'}
        </div>` : ''}`;
      const upd = () => {
        if (!d.t0 && !d.wid) d.t0 = Date.now();
        keep();
        const s = box.querySelector('#gSum'); if (s) s.innerHTML = summary();
        box.querySelectorAll('[data-gx-pr]').forEach(el => { el.innerHTML = prTag(d.items[el.dataset.gxPr]); });
      };
      const at = s => s.split(':').map(Number);
      box.querySelectorAll('[data-gs-kg]').forEach(inp => inp.addEventListener('input', () => { const [i, k] = at(inp.dataset.gsKg); d.items[i].sets[k].kg = inp.value === '' ? '' : Number(inp.value); upd(); }));
      box.querySelectorAll('[data-gs-reps]').forEach(inp => inp.addEventListener('input', () => { const [i, k] = at(inp.dataset.gsReps); d.items[i].sets[k].reps = inp.value === '' ? '' : Number(inp.value); upd(); }));
      box.querySelectorAll('[data-gs-add]').forEach(b => b.addEventListener('click', () => { const s = d.items[b.dataset.gsAdd].sets, l = s[s.length - 1]; s.push(l ? { ...l } : { kg: '', reps: '' }); keep(); paint(); }));
      box.querySelectorAll('[data-gs-del]').forEach(b => b.addEventListener('click', () => { const [i, k] = at(b.dataset.gsDel); d.items[i].sets.splice(k, 1); if (!d.items[i].sets.length) d.items.splice(i, 1); keep(); paint(); }));
      box.querySelectorAll('[data-gx-tip]').forEach(b => b.addEventListener('click', () => {
        const x = d.items[b.dataset.gxTip], nt = nextTarget(x.id);
        x.sets = Array.from({ length: Math.max(nt.sets, 1) }, () => ({ kg: nt.kg || '', reps: nt.reps }));
        keep(); paint(); tap();
      }));
      box.querySelectorAll('[data-gx-del]').forEach(b => b.addEventListener('click', () => { d.items.splice(Number(b.dataset.gxDel), 1); keep(); paint(); }));
      box.querySelector('#gAdd').addEventListener('click', () => { screen = 'picker'; q = ''; paint(); });
      box.querySelectorAll('[data-gi]').forEach(b => b.addEventListener('click', () => { d.inten = b.dataset.gi; keep(); paint(); }));
      const gm = box.querySelector('#gMin');
      if (gm) gm.addEventListener('input', () => { d.minutes = Math.max(0, Math.round(Number(gm.value))) || null; upd(); });
      const gc = box.querySelector('#gClear');
      if (gc) gc.addEventListener('click', () => { if (!confirm('¿Descartar estos ejercicios?')) return; storeGymDraft(null); closeModal(); });
      const gs = box.querySelector('#gSave');
      if (gs) gs.addEventListener('click', () => {
        const ex = d.items.map(x => ({ id: x.id, sets: x.sets.map(z => ({ kg: Number(z.kg) || 0, reps: Math.round(Number(z.reps) || 0) })).filter(z => z.reps > 0) })).filter(x => x.sets.length);
        if (!ex.length) return toast('Anota las repeticiones de al menos una serie');
        const k = kcal(), min = minutes();
        const prs = logStrength(ex, min, k, { dateKey: d.date, replace: d.wid ? { wid: d.wid } : null });
        storeGymDraft(null); closeModal(); render(); tap();
        if (prs.length) { confetti(70); toast(`🏆 ¡Nuevo récord en ${prs.join(', ')}! · ${r0(k)} kcal`); }
        else { if (!d.wid) confetti(30); toast(`💪 ${d.wid ? 'Entrenamiento actualizado' : 'Entrenamiento guardado'}: ${ex.length} ${ex.length === 1 ? 'ejercicio' : 'ejercicios'} · ${r0(k)} kcal`); }
      });
    };
    const pickerList = () => {
      const use = exUsage(), inSes = new Set(d.items.map(x => x.id));
      let list = exDB().filter(e => e.cat !== 'estiramiento' && e.cat !== 'cardio'
        && (fGroup === 'todos' || (fGroup === 'mios' ? use[e.id] : exMuscle(e) === fGroup))
        && (fEq === 'todos' || eqKind(e) === fEq)
        && (!q || exSearch(e, q)));
      list = list.map((e, i) => [e, exRank(e, q, use), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
      const shown = list.slice(0, limit);
      return `<p class="muted small">${list.length} ejercicios${fGroup === 'mios' ? ' que ya has hecho' : ''}</p>
        <div class="list gym-pick">${shown.map(e => `<button class="item tappable gym-row ${inSes.has(e.id) ? 'on' : ''}" data-gp="${e.id}">
          ${exThumb(e)}<div class="info"><div class="name">${esc(e.n)}</div><div class="muted small">${esc(e.m.slice(0, 2).join(', '))} · ${esc(e.eq)}${use[e.id] ? ' · ⭐ ya lo hiciste' : ''}</div></div>
          <span class="gym-check">${inSes.has(e.id) ? '✓' : '＋'}</span></button>`).join('') || '<div class="empty">No encontré ese ejercicio. Prueba con otra palabra o créalo en Entrenar → Ejercicios.</div>'}</div>
        ${list.length > shown.length ? `<button class="btn ghost" id="gMore" style="width:100%;margin-top:8px">Ver más (${list.length - shown.length})</button>` : ''}`;
    };
    const bindPickerList = () => {
      box.querySelectorAll('[data-gp]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.gp, i = d.items.findIndex(x => x.id === id);
        if (i >= 0) d.items.splice(i, 1);
        else {
          // Parte con las series de la última vez (o 3 series vacías)
          const l = lastSets(id);
          d.items.push({ id, sets: l ? l.map(z => ({ kg: z.kg, reps: z.reps })) : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }] });
          tap();
        }
        keep();
        b.classList.toggle('on', i < 0);
        b.querySelector('.gym-check').textContent = i < 0 ? '✓' : '＋';
        box.querySelector('#gDone').textContent = d.items.length ? `Listo · ${d.items.length} ${d.items.length === 1 ? 'ejercicio' : 'ejercicios'} →` : 'Volver';
      }));
      const mo = box.querySelector('#gMore');
      if (mo) mo.addEventListener('click', () => { limit += 80; refreshList(); });
    };
    const refreshList = () => { box.querySelector('#gList').innerHTML = pickerList(); bindPickerList(); };
    const paintPicker = () => {
      box.innerHTML = `<h2 style="padding-right:30px">¿Qué ejercicio hiciste?</h2>
        <input id="gQ" type="search" placeholder="Buscar: press banca, jalón, prensa, curl…" value="${esc(q)}" autocomplete="off">
        <div class="gym-groups">${[['todos', 'Todos', '📋'], ...(Object.keys(exUsage()).length ? [['mios', 'Los míos', '⭐']] : []), ...MUSCLE_GROUPS].map(([k, l, ico]) => `<button class="gym-grp ${k === fGroup ? 'on' : ''}" data-gg="${k}"><span>${ico}</span>${l}</button>`).join('')}</div>
        <div class="chips scroll-x">${[['todos', 'Cualquier equipo'], ...EQ_KINDS].map(([k, l]) => `<button class="chip ${k === fEq ? 'active' : ''}" data-ge="${k}">${l}</button>`).join('')}</div>
        <div id="gList">${pickerList()}</div>
        <div class="gym-done"><button class="btn" id="gDone" style="width:100%">${d.items.length ? `Listo · ${d.items.length} ${d.items.length === 1 ? 'ejercicio' : 'ejercicios'} →` : 'Volver'}</button></div>`;
      bindPickerList();
      // Al escribir solo se redibuja la lista, así el teclado no se cierra
      box.querySelector('#gQ').addEventListener('input', e => { q = e.target.value; limit = 50; refreshList(); });
      box.querySelectorAll('[data-gg]').forEach(b => b.addEventListener('click', () => { fGroup = b.dataset.gg; ui.gymGroup = fGroup; limit = 50; box.querySelectorAll('[data-gg]').forEach(x => x.classList.toggle('on', x === b)); refreshList(); }));
      box.querySelectorAll('[data-ge]').forEach(b => b.addEventListener('click', () => { fEq = b.dataset.ge; limit = 50; box.querySelectorAll('[data-ge]').forEach(x => x.classList.toggle('active', x === b)); refreshList(); }));
      box.querySelector('#gDone').addEventListener('click', () => { if (!d.items.length && !d.wid) return closeModal(); screen = 'session'; paint(); });
    };
    const paint = () => { (screen === 'picker' ? paintPicker : paintSession)(); box.parentNode.scrollTop = 0; };
    paint();
  });
}
