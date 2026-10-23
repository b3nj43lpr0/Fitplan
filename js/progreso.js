// FitPlan · Progreso: peso, resumen, fuerza, logros y fotos
'use strict';

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
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".3"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${r1(t)}</text>`).join('')}
    <polygon fill="url(#wg)" points="${area}"/>
    <polyline fill="none" stroke="var(--accent-2)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>
    ${ws.map(w => `<circle cx="${x(w.d)}" cy="${y(w.kg)}" r="3" fill="var(--muted)" opacity=".6"><title>${shortDate(w.d)}: ${w.kg} kg</title></circle>`).join('')}
    <line x1="${x(last.d)}" x2="${x(last.d)}" y1="10" y2="${H - 30}" stroke="var(--line)" stroke-dasharray="4 4"/>
    <circle cx="${x(last.d)}" cy="${y(last.kg)}" r="7" fill="var(--card)" stroke="var(--accent)" stroke-width="4"/>
    <text x="${P}" y="${H - 6}" class="axis">${shortDate(first)}</text><text x="${W - 10}" y="${H - 6}" text-anchor="end" class="axis">${shortDate(last.d)}</text>
  </svg><div class="muted small">Puntos = cada pesaje · Línea de color = promedio de 7 días (más confiable que un día suelto).</div>`;
}
// Por ejercicio: sesiones, mejor 1RM, peso máximo, más repeticiones, mejor volumen y cada vez que rompiste tu récord
// Guarda un pesaje (desde Progreso o desde el botón ＋)
function saveWeight(d, kg) {
  if (!d || !(kg >= 30 && kg <= 300)) { toast('Revisa la fecha y el peso'); return false; }
  state.weights = state.weights.filter(w => w.d !== d);
  state.weights.push({ d, kg: r1(kg) });
  state.profile.peso = currentWeight();
  const step = autoAdjust();
  save(); render();
  toast(step ? `Peso guardado. Ajusté tu meta ${step > 0 ? '+' : ''}${r0(step)} kcal` : 'Peso guardado');
  return true;
}
// ---------- Gasto real (TDEE adaptativo) ----------
function realTdeeCard() {
  const p = state.profile, r = realTdee();
  if (!r) return '';
  const need = !r.ready ? [r.days < 10 ? `${10 - r.days} días más con tus comidas completas` : '', r.weights < 3 || r.span < 10 ? 'pesarte al menos 3 veces en 10 días o más' : ''].filter(Boolean) : [];
  return `<div class="card real-tdee">
    <div class="row"><h2>🔥 Tu gasto real</h2>${p.gastoReal && r.ready ? '<span class="tag">En uso</span>' : ''}</div>
    ${r.ready ? `<div class="minis" style="grid-template-columns:1fr 1fr">
        <div class="mini"><b>${r0(r.v)}</b><span>kcal/día medido</span></div>
        <div class="mini"><b>${r0(r.formula)}</b><span>kcal/día según fórmula</span></div>
      </div>
      <div class="bar" style="margin:10px 0 4px"><span style="width:${r0(r.conf * 100)}%;background:var(--accent)"></span></div>
      <p class="muted small">Confianza ${r0(r.conf * 100)}% · ${r.days} días registrados y ${r.span} días de pesajes. Comiste ≈${r0(r.intake)} kcal/día y tu peso cambió ${r.slope > 0 ? '+' : ''}${r1(r.slope)} kg/semana.</p>
      <button class="btn ${p.gastoReal ? 'ghost' : ''} sm" id="rtToggle">${p.gastoReal ? 'Volver a la fórmula' : 'Usar mi gasto real para mi meta'}</button>`
    : `<p class="muted small">Comparo lo que comes con cómo cambia tu peso para medir cuánto gastas tú de verdad (no una fórmula). Para calcularlo me falta: ${need.join(' y ')}.</p>
      <div class="bar"><span style="width:${r0(Math.min(1, r.days / 10) * 50 + Math.min(1, r.span / 10) * 50)}%;background:var(--accent)"></span></div>`}
  </div>`;
}
function openRealTdee() {
  const r = realTdee(), p = state.profile;
  if (!r || !r.ready) return;
  const goal = Math.max(p.sexo === 'h' ? 1500 : 1200, r.v + (dietBreakActive() ? 0 : goalAdj(p)));
  openModal(`<h2>🔥 Tu gasto real</h2>
    <p>Con tus últimas ${r.days} días registrados y tu peso, tu cuerpo gasta <b>≈${r0(r.v)} kcal al día</b> (sin contar el ejercicio que anotas). La fórmula general decía <b>${r0(r.formula)}</b>.</p>
    <div class="result-box">Tu meta quedaría en <b>${r0(goal)} kcal</b> (hoy es ${r0(calcTargets().kcal)}).</div>
    <p class="muted small">${r.v < r.formula ? 'Que salga más bajo puede ser porque tu metabolismo es más lento o porque algunas comidas no se anotaron; en ambos casos, usar el gasto real hace que tu meta funcione en la práctica.' : 'Gastas más de lo que dice la fórmula: puedes comer un poco más y seguir avanzando.'} Se recalcula solo cada día con tus nuevos datos.</p>
    <div class="btn-row"><button class="btn" id="rtYes" style="flex:1">Usar mi gasto real</button><button class="btn ghost" id="rtNo">Ahora no</button></div>`, m => {
    m.querySelector('#rtYes').addEventListener('click', () => { p.gastoReal = true; save(); closeModal(); render(); toast(`Listo: tu meta ahora es ${r0(calcTargets().kcal)} kcal`); });
    m.querySelector('#rtNo').addEventListener('click', () => { p.gastoRealNo = todayKey(); save(); closeModal(); render(); });
  });
}
function strengthStats() {
  const map = new Map();
  const ws = [...state.workouts].sort((a, b) => a.d.localeCompare(b.d));
  for (const w of ws) for (const x of w.ex) {
    const withKg = x.sets.filter(z => z.kg);
    if (!map.has(x.id)) map.set(x.id, { id: x.id, sessions: 0, best: null, bestD: null, maxKg: null, maxReps: null, bestVol: null, pts: [], kgPts: [], volPts: [], prs: [] });
    const st = map.get(x.id);
    st.sessions++;
    const vol = x.sets.reduce((a, z) => a + z.kg * z.reps, 0);
    for (const z of x.sets) {
      if (z.kg && (!st.maxKg || z.kg > st.maxKg.kg || (z.kg === st.maxKg.kg && z.reps > st.maxKg.reps))) st.maxKg = { ...z, d: w.d };
      if (z.reps && (!st.maxReps || z.reps > st.maxReps.reps)) st.maxReps = { ...z, d: w.d };
    }
    if (vol && (!st.bestVol || vol > st.bestVol.v)) st.bestVol = { v: vol, d: w.d };
    if (withKg.length) {
      const top = withKg.reduce((a, z) => (e1rm(z) > e1rm(a) ? z : a));
      if (st.best && e1rm(top) > e1rm(st.best)) st.prs.push({ d: w.d, ...top, prev: e1rm(st.best) });
      if (!st.best || e1rm(top) > e1rm(st.best)) { st.best = top; st.bestD = w.d; }
      st.pts.push({ d: w.d, v: e1rm(top) });
      st.kgPts.push({ d: w.d, v: Math.max(...withKg.map(z => z.kg)) });
      st.volPts.push({ d: w.d, v: vol });
    }
  }
  return [...map.values()].filter(x => exById(x.id)).sort((a, b) => b.sessions - a.sessions);
}
// Récords rotos en los últimos días, del más nuevo al más antiguo
function recentPRs(days = 30) {
  const from = shiftKey(todayKey(), -days);
  return strengthStats().flatMap(x => x.prs.filter(p => p.d >= from).map(p => ({ ...p, id: x.id }))).sort((a, b) => b.d.localeCompare(a.d));
}
function lineChart(pts, unit) {
  if (pts.length < 2) return '<p class="muted small">Necesitas al menos 2 sesiones con peso para ver la evolución.</p>';
  const W = 600, H = 200, P = 46;
  const vs = pts.map(q => q.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const x = i => P + (i / (pts.length - 1)) * (W - P - 10);
  const y = v => 10 + (1 - (v - lo) / (hi - lo)) * (H - 40);
  const line = pts.map((q, i) => `${x(i)},${y(q.v)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="wchart" role="img" aria-label="Evolución">
    ${[lo, (lo + hi) / 2, hi].map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(127,127,127,.15)"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${r0(t)}</text>`).join('')}
    <polyline fill="none" stroke="var(--accent-2)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>
    ${pts.map((q, i) => `<circle cx="${x(i)}" cy="${y(q.v)}" r="5" fill="var(--accent)"><title>${shortDate(q.d)}: ${r1(q.v)} ${unit}</title></circle>`).join('')}
    <text x="${P}" y="${H - 6}" class="axis">${shortDate(pts[0].d)}</text><text x="${W - 10}" y="${H - 6}" text-anchor="end" class="axis">${shortDate(pts[pts.length - 1].d)}</text>
  </svg>`;
}
function strengthCard() {
  const st = strengthStats();
  const recent = state.workouts.slice(-5).reverse();
  const prs = st.length ? recentPRs(30) : [];
  return `<div class="card">
    <div class="row"><h2>Fuerza</h2><span class="muted small">${state.workouts.length} entrenamientos registrados</span></div>
    ${prs.length ? `<div class="pr-box"><b>🏆 Récords de los últimos 30 días: ${prs.length}</b>${prs.slice(0, 5).map(p => `<div class="pr-row"><span>${esc(exById(p.id).n)}</span><span class="muted small">${shortDate(p.d)} · ${p.kg} kg × ${p.reps}</span><b>+${r0(e1rm(p) - p.prev)} kg</b></div>`).join('')}</div>` : ''}
    ${st.length ? `<div class="list">${st.slice(0, 12).map(x => `
      <div class="item tappable" data-strength="${x.id}" role="button" tabindex="0">
        <div class="info"><div class="name">${esc(exById(x.id).n)}</div><div class="muted small">${x.sessions} ${x.sessions === 1 ? 'sesión' : 'sesiones'}${x.best ? ` · mejor serie ${x.best.kg} kg × ${x.best.reps}` : ''}</div></div>
        <span class="kcal">${x.best ? r0(e1rm(x.best)) + ' <span class="muted small">kg 1RM</span>' : '—'}</span>
      </div>`).join('')}</div>
      <p class="muted small">1RM = peso máximo estimado para 1 repetición. Toca un ejercicio para ver su evolución.</p>
      <h3>Últimos entrenamientos</h3>
      <div class="list">${recent.map(w => `<div class="item"><div class="info"><div class="name">${esc(w.name)}</div><div class="muted small">${shortDate(w.d)} · ${w.minutes} min · ${w.ex.length} ${w.ex.length === 1 ? 'ejercicio' : 'ejercicios'}</div></div><span class="kcal">${r0(w.ex.reduce((a, x) => a + x.sets.reduce((b, z) => b + z.kg * z.reps, 0), 0))} <span class="muted small">kg vol.</span></span></div>`).join('')}</div>`
    : '<p class="muted">Usa <b>▶ Empezar entrenamiento</b> en Entrenar y registra el peso de cada serie. Aquí verás tus récords y cómo vas subiendo.</p>'}
  </div>`;
}
function summaryCard() {
  const N = ui.sumRange;
  const tg = calcTargets();
  const keys = Array.from({ length: N }, (_, i) => shiftKey(todayKey(), i - N + 1));
  const ds = keys.map(k => ({ k, d: peekDay(k), t: totals(peekDay(k)) }));
  const lg = ds.filter(x => x.d.foods.length);
  const avg = f => lg.length ? lg.reduce((a, x) => a + f(x), 0) / lg.length : 0;
  const inGoal = keys.filter(k => dayInGoal(k, tg)).length;
  const exMin = ds.reduce((a, x) => a + x.d.exercises.reduce((b, e) => b + (e.minutes || 0), 0), 0);
  const burned = ds.reduce((a, x) => a + x.t.burned, 0);
  const wks = state.workouts.filter(w => w.d >= keys[0]).length;
  const ws = state.weights.filter(w => w.d >= keys[0]).sort((a, b) => a.d.localeCompare(b.d));
  const wch = ws.length >= 2 ? ws[ws.length - 1].kg - ws[0].kg : null;
  // Barras apiladas: calorías de proteína, carbohidratos y grasa por día
  const maxK = Math.max(tg.kcal * 1.2, ...ds.map(x => x.t.p * 4 + x.t.c * 4 + x.t.g * 9));
  const bars = ds.map(x => {
    const h = v => (v / maxK) * 100;
    return `<div class="col" title="${shortDate(x.k)}: ${r0(x.t.kcal)} kcal">
      <div class="stack">${x.d.foods.length ? `<i style="height:${h(x.t.g * 9)}%;background:var(--fat)"></i><i style="height:${h(x.t.c * 4)}%;background:var(--carb)"></i><i style="height:${h(x.t.p * 4)}%;background:var(--prot)"></i>` : ''}</div>
      ${N <= 7 ? `<span class="lbl">${parseKey(x.k).toLocaleDateString('es', { weekday: 'short' }).slice(0, 3)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="card">
    <div class="row"><h2 style="margin:0">Resumen</h2>${tabs('sum', String(N), [['7', '7 días'], ['30', '30 días']])}</div>
    <div class="grid g4 keep" style="gap:10px;margin:12px 0">
      ${tile('Promedio diario', r0(avg(x => x.t.kcal)), `/ ${r0(tg.kcal)} kcal`, '🍽️')}
      ${tile('Proteína promedio', r0(avg(x => x.t.p)), `/ ${r0(tg.prot)} g`, '🥩')}
      ${tile('Días en la meta', inGoal, `/ ${N}`, '🎯', 'accent')}
      ${tile('Días registrados', lg.length, `/ ${N}`, '📝')}
      ${tile('Ejercicio', exMin, 'min', '⏱️', 'burn')}
      ${tile('Quemadas', r0(burned), 'kcal', '🔥', 'burn')}
      ${tile('Entrenamientos', wks, '', '🏋️')}
      ${tile('Cambio de peso', wch === null ? '—' : (wch > 0 ? '+' : '') + r1(wch), 'kg', '⚖️')}
    </div>
    <div class="chart stacked ${N > 7 ? 'dense' : ''}" style="--g:${tg.kcal / maxK}">${bars}<span class="goal-line" title="Tu meta"></span></div>
    <div class="legend"><span><i style="background:var(--prot)"></i>Proteína</span><span><i style="background:var(--carb)"></i>Carbohidratos</span><span><i style="background:var(--fat)"></i>Grasas</span><span><i style="background:var(--accent)"></i>Meta</span></div>
  </div>`;
}
function badgesCard() {
  const got = BADGES.filter(b => state.badges.includes(b.id));
  return `<div class="card">
    <div class="row"><h2 style="margin:0">Logros</h2><span class="muted small">${got.length} de ${BADGES.length} · racha actual ${streak()} ${streak() === 1 ? 'día' : 'días'} · mejor ${bestStreak()}</span></div>
    <div class="badges">${BADGES.map(b => { const on = state.badges.includes(b.id); return `<div class="badge ${on ? 'on' : ''}" title="${esc(b.desc)}"><span class="bi">${on ? b.ico : '🔒'}</span><b>${esc(b.name)}</b><span class="muted small">${esc(b.desc)}</span></div>`; }).join('')}</div>
  </div>`;
}
// ---------- Fotos de progreso (IndexedDB, solo en este dispositivo) ----------
function photoDb() {
  return new Promise((ok, fail) => {
    const rq = indexedDB.open(pkey('fitplan-photos'), 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('photos', { keyPath: 'id' });
    rq.onsuccess = () => ok(rq.result);
    rq.onerror = () => fail(rq.error);
  });
}
async function photoOp(mode, fn) {
  const db = await photoDb();
  return new Promise((ok, fail) => {
    const tx = db.transaction('photos', mode);
    const r = fn(tx.objectStore('photos'));
    tx.oncomplete = () => ok(r && r.result);
    tx.onerror = () => fail(tx.error);
  });
}
const listPhotos = () => photoOp('readonly', st => st.getAll()).then(l => (l || []).sort((a, b) => a.d.localeCompare(b.d)));
function shrinkImage(file, max = 900) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = fail;
    img.src = URL.createObjectURL(file);
  });
}
function photosCard() {
  return `<div class="card">
    <div class="row"><h2 style="margin:0">Fotos de progreso</h2>
      <label class="btn sm" style="margin:0">📷 Agregar<input type="file" id="photoIn" accept="image/*" hidden></label></div>
    <p class="muted small">Se guardan solo en este dispositivo (no se suben a internet). Toca dos fotos para compararlas.</p>
    <div class="photos" id="photos"><div class="empty">Cargando…</div></div>
  </div>`;
}
async function paintPhotos() {
  const box = $('#photos');
  if (!box) return;
  let list = [];
  try { list = await listPhotos(); } catch (e) { box.innerHTML = '<div class="empty">Este navegador no permite guardar fotos.</div>'; return; }
  box.innerHTML = list.length ? list.map(ph => `<button class="ph ${ui.cmp.includes(ph.id) ? 'sel' : ''}" data-ph="${ph.id}"><img src="${ph.src}" alt="Foto del ${shortDate(ph.d)}"><span>${shortDate(ph.d)}</span></button>`).join('')
    : '<div class="empty">Aún no tienes fotos. Una foto cada 2-4 semanas, con la misma luz y pose, muestra cambios que la balanza no ve.</div>';
  box.querySelectorAll('[data-ph]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.ph;
    ui.cmp = ui.cmp.includes(id) ? ui.cmp.filter(x => x !== id) : [...ui.cmp, id].slice(-2);
    if (ui.cmp.length === 2) {
      const [a, c] = ui.cmp.map(x => list.find(ph => ph.id === x)).sort((p1, p2) => p1.d.localeCompare(p2.d));
      openModal(`<h2>Antes y después</h2><div class="cmp"><figure><img src="${a.src}" alt=""><figcaption>${shortDate(a.d)}</figcaption></figure><figure><img src="${c.src}" alt=""><figcaption>${shortDate(c.d)} · ${daysBetween(a.d, c.d)} días después</figcaption></figure></div>
        <div class="btn-row"><button class="btn ghost sm" data-phdel="${a.id}" style="color:var(--danger)">Borrar foto del ${shortDate(a.d)}</button><button class="btn ghost sm" data-phdel="${c.id}" style="color:var(--danger)">Borrar foto del ${shortDate(c.d)}</button></div>`, m => {
        m.querySelectorAll('[data-phdel]').forEach(x => x.addEventListener('click', async () => {
          if (!confirm('¿Borrar esta foto?')) return;
          await photoOp('readwrite', st => st.delete(x.dataset.phdel));
          ui.cmp = []; closeModal(); paintPhotos();
        }));
      });
      ui.cmp = [];
    }
    paintPhotos();
  }));
}
// ---------- Déficit ----------
function deficitChart(days) {
  const vals = days.map(x => x.v);
  const max = Math.max(500, ...vals.filter(v => v !== null).map(v => Math.abs(v)));
  return `<div class="def-chart">${days.map(x => {
    const v = x.v, h = v === null ? 0 : Math.abs(v) / max * 50;
    return `<div class="dc" title="${shortDate(x.k)}: ${v === null ? 'sin registro' : (v >= 0 ? 'déficit ' : 'superávit ') + fmtKcal(v) + ' kcal'}">
      <div class="dc-up">${v !== null && v >= 0 ? `<i class="pos" style="height:${h * 2}%"></i>` : ''}</div>
      <div class="dc-down">${v !== null && v < 0 ? `<i class="neg" style="height:${h * 2}%"></i>` : ''}</div>
      <span>${parseKey(x.k).getDate()}</span></div>`;
  }).join('')}</div>
  <div class="legend"><span><i style="background:var(--carb)"></i>Déficit</span><span><i style="background:var(--prot)"></i>Superávit</span><span><i style="background:var(--soft)"></i>Sin registro</span></div>`;
}
function deficitTab() {
  const p = state.profile, tg = calcTargets();
  const s14 = deficitStats(14, tg), s30 = deficitStats(30, tg);
  const pr = goalProjection(tg);
  const warns = deficitWarnings(tg);
  const ws = [...state.weights].sort((a, b) => a.d.localeCompare(b.d));
  const from = shiftKey(todayKey(), -30);
  const w30 = ws.filter(w => w.d >= from);
  const realKg = w30.length >= 2 ? w30[w30.length - 1].kg - w30[0].kg : null;
  const tr = weightTrend();
  return `
    <div class="grid g4 keep" style="margin-bottom:16px">
      ${tile('Déficit diario (14 días)', s14.avg === null ? '—' : (s14.avg < 0 ? '+' : '') + fmtKcal(s14.avg), 'kcal', '🔥', s14.avg !== null && s14.avg < 0 ? 'burn' : 'accent')}
      ${tile('Acumulado 30 días', fmtKcal(s30.sum), 'kcal', '📦')}
      ${tile('Grasa estimada', (s30.kg >= 0 ? '−' : '+') + fmtKg(s30.kg), 'kg en 30 días', '🧈')}
      ${tile('Ritmo real', tr === null ? '—' : (tr > 0 ? '+' : '') + r1(tr), `kg/sem (plan ${expectedRate(p) > 0 ? '+' : ''}${expectedRate(p)})`, '📈')}
    </div>
    ${warns.length ? `<div class="card"><h2>Para que tu déficit sea sano</h2>${warns.map(w => `<div class="warn-box ${w.lvl}">${w.ico} ${esc(w.txt)}${w.action === 'break' ? '<button class="btn sm" id="dietBreak" style="margin-top:8px">🌴 Hacer 1 semana en mantención</button>' : ''}</div>`).join('')}</div>` : ''}
    ${tg.breakOn ? `<div class="card"><h2>🌴 Semana de mantención</h2><p class="muted small">Hasta el ${longDate(state.dietBreak.until)} tu meta es tu gasto de mantención (${r0(tg.kcal)} kcal). Después vuelves solo a tu déficit.</p><button class="btn ghost sm" id="endBreak">Terminar antes</button></div>` : ''}
    <div class="grid g2">
      <div class="card">
        <h2>Balance de los últimos 14 días</h2>
        <p class="muted small" style="margin-top:-6px">Gasto (${r0(tg.tdee)} kcal + ejercicio) menos lo que comiste. Hoy no cuenta porque el día no ha terminado.</p>
        ${deficitChart(s14.days)}
      </div>
      <div class="card">
        <h2>Tu meta</h2>
        <div class="grid g2 keep" style="gap:10px">
          <div class="field"><label for="dMeta">Peso meta (kg)</label><input id="dMeta" type="number" step="0.5" min="30" max="300" inputmode="decimal" value="${p.meta || ''}" placeholder="Ej: ${r0(currentWeight() - 5)}"></div>
          <div class="field"><label for="dRitmo">Ritmo</label><select id="dRitmo" ${p.objetivo !== 'perder' ? 'disabled' : ''}>${Object.entries(RITMOS).map(([k, x]) => `<option value="${k}" ${k === (p.ritmo || 'moderado') ? 'selected' : ''}>${x.label} (${x.adj} kcal)</option>`).join('')}</select></div>
        </div>
        <button class="btn" id="dSave" style="width:100%">Guardar</button>
        ${pr && pr.date ? `<div class="result-box">🏁 Faltan <b>${fmtKg(pr.diff)} kg</b>. Con tu ${pr.real ? 'déficit real de las últimas 2 semanas' : 'déficit planeado'} (${fmtKg(pr.perWeek)} kg/semana) llegas en <b>${Math.max(1, Math.round(pr.weeks))} semanas</b>, cerca del <b>${longDate(pr.date)}</b>.</div>`
          : pr && pr.stalled ? `<div class="result-box">Con tu balance actual no te acercas a ${p.meta} kg. ${p.objetivo === 'perder' ? 'Necesitas comer un poco menos o moverte más.' : ''}</div>`
            : pr && pr.reached ? '<div class="result-box">🏁 ¡Estás en tu peso meta! Puedes pasar tu objetivo a "Mantener peso" en Perfil.</div>' : '<p class="muted small">Pon tu peso meta para ver cuándo llegarías.</p>'}
        <p class="muted small">${p.objetivo === 'perder' ? 'Suave cuida mejor el músculo y es más fácil de sostener; rápido conviene solo por pocas semanas.' : 'El ritmo aplica cuando tu objetivo es perder grasa.'}</p>
      </div>
    </div>
    <div class="card">
      <h2>Estimado vs. real (30 días)</h2>
      <p class="small">Por tu balance deberías haber ${s30.kg >= 0 ? 'perdido' : 'ganado'} unos <b>${fmtKg(s30.kg)} kg</b>${realKg !== null ? `; la balanza dice <b>${realKg > 0 ? '+' : ''}${r1(realKg)} kg</b>.` : '. Registra tu peso para compararlo.'}</p>
      <p class="muted small">Es normal que no calcen día a día: el agua, la sal y los carbohidratos mueven la balanza. Si después de 3 semanas siguen muy distintos, puede que estés anotando de menos o que tu gasto real sea otro; el ajuste automático de la pestaña Peso corrige eso.</p>
    </div>`;
}
// ---------- Desafíos ----------
function challengesSection() {
  const act = state.challenges.filter(c => !c.closed);
  const done = state.challenges.filter(c => c.closed).slice(-6).reverse();
  const free = CHALLENGES.filter(d => !act.some(c => c.id === d.id));
  return `<div class="card">
    <h2>🎯 Desafíos de 30 días</h2>
    ${act.map(c => {
      const pr = challengeProgress(c), today = pr.days[pr.elapsed - 1];
      return `<div class="ch">
        <div class="row"><b>${pr.def.ico} ${esc(pr.def.name)}</b><span class="muted small">${pr.done}/${pr.def.need} para ganar</span></div>
        <div class="muted small">${esc(pr.def.desc)} · día ${pr.elapsed} de ${CHALLENGE_DAYS}</div>
        <div class="ch-dots">${pr.days.map(x => `<i class="${x.st}" title="${shortDate(x.k)}"></i>`).join('')}</div>
        <div class="btn-row">${pr.def.manual && today.st !== 'ok' ? `<button class="btn sm" data-check-ch="${c.id}">✓ Hoy lo cumplí</button>` : ''}<button class="see" data-quit-ch="${c.id}">Abandonar</button></div>
      </div>`;
    }).join('') || '<p class="muted small">Elige uno para empezar hoy. Cada día que lo cumplas se marca en el calendario.</p>'}
    ${free.length ? `<h3>Empezar un desafío</h3><div class="quick-grid">${free.map(d => `<button class="quick" data-start-ch="${d.id}" title="${esc(d.desc)}"><span>${d.ico}</span>${esc(d.name)}</button>`).join('')}</div>` : ''}
    ${done.length ? `<h3>Terminados</h3><div class="list">${done.map(c => { const d = CHALLENGES.find(x => x.id === c.id); return `<div class="item"><span class="fi sm">${c.won ? '🥇' : d.ico}</span><div class="info"><div class="name">${esc(d.name)}</div><div class="muted small">desde el ${shortDate(c.start)}</div></div><span class="muted small">${c.won ? 'cumplido' : 'no alcanzado'}</span></div>`; }).join('')}</div>` : ''}
  </div>`;
}
function viewProgreso() {
  const p = state.profile;
  const tg = calcTargets();
  const ws = [...state.weights].sort((a, b) => a.d.localeCompare(b.d));
  const ms = [...state.measures].sort((a, b) => a.d.localeCompare(b.d));
  const lastM = ms[ms.length - 1];
  const bf = bodyFat(lastM, p);
  const trend = weightTrend();
  const expected = expectedRate(p);
  const change = ws.length ? ws[ws.length - 1].kg - ws[0].kg : 0;
  const head = pageHead('Progreso') + tabs('prog', ui.progTab, [['peso', '<span class="te">⚖️ </span>Peso'], ['deficit', '<span class="te">🔥 </span>Déficit'], ['resumen', '<span class="te">📊 </span>Resumen'], ['fuerza', '<span class="te">💪 </span>Fuerza'], ['logros', '<span class="te">🏅 </span>Logros']]);
  if (ui.progTab === 'deficit') return head + deficitTab();
  if (ui.progTab === 'resumen') return head + summaryCard() + `<div class="btn-row two"><button class="btn ghost" id="lastWeek">📅 Semana pasada</button><button class="btn" id="askCoach">💬 Pregúntale al coach</button></div>`;
  if (ui.progTab === 'fuerza') return head + strengthCard();
  if (ui.progTab === 'logros') return head + challengesSection() + badgesCard() + photosCard();
  return head + `
    <div class="grid g4 keep" style="margin-bottom:16px">
      <div class="stat"><div class="label">Peso actual</div><span class="tile-ico" aria-hidden="true">⚖️</span><div class="value">${r1(currentWeight())} <span class="unit">kg</span></div></div>
      <div class="stat"><div class="label">Cambio total</div><span class="tile-ico" aria-hidden="true">📉</span><div class="value">${ws.length ? (change > 0 ? '+' : '') + r1(change) : '—'} <span class="unit">kg</span></div></div>
      <div class="stat"><div class="label">Ritmo (últimas 4 semanas)</div><span class="tile-ico" aria-hidden="true">📈</span><div class="value">${trend === null ? '—' : (trend > 0 ? '+' : '') + r1(trend)} <span class="unit">kg/sem</span></div></div>
      <div class="stat"><div class="label">% grasa estimado</div><span class="tile-ico" aria-hidden="true">📏</span><div class="value">${bf ? r1(bf) : '—'} <span class="unit">%</span></div></div>
    </div>
    <div class="grid g2">
      <div>
        <div class="card">
          <h2>Registrar peso</h2>
          <div class="qty">
            <button class="round-btn" data-wstep="-0.1" aria-label="Menos 100 g">−</button>
            <div class="field" style="margin:0;flex:1"><input id="wKg" type="number" step="0.1" min="30" max="300" inputmode="decimal" value="${r1(currentWeight())}" aria-label="Peso en kg"><span class="unit-in">kg</span></div>
            <button class="round-btn" data-wstep="0.1" aria-label="Más 100 g">＋</button>
          </div>
          <details class="mini-details"><summary>Otra fecha</summary><div class="field"><input id="wDate" type="date" value="${todayKey()}" max="${todayKey()}" aria-label="Fecha"></div></details>
          <button class="btn" id="addWeight" style="width:100%">Guardar peso</button>
          <p class="muted small">Pésate en ayunas, después de ir al baño, 2-3 veces por semana.</p>
        </div>
        ${realTdeeCard()}
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
    <details class="card fold"${ms.length ? '' : ''}>
      <summary><h2 style="margin:0">Medidas corporales</h2><span class="muted small">${lastM ? `última: ${shortDate(lastM.d)}${bf ? ` · ${r1(bf)}% grasa` : ''}` : 'opcional'}</span></summary>
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
    </details>`;
}
bind.progreso = () => {
  $$('[data-tab-prog]').forEach(b => b.addEventListener('click', () => { ui.progTab = b.dataset.tabProg; render(); animateEnter(); }));
  const ac = $('#askCoach');
  if (ac) ac.addEventListener('click', openCoach);
  const lw = $('#lastWeek');
  if (lw) lw.addEventListener('click', () => showWeekly(shiftKey(mondayOf(todayKey()), -7)));
  // Déficit
  const ds = $('#dSave');
  if (ds) ds.addEventListener('click', () => {
    const m = Number($('#dMeta').value);
    if ($('#dMeta').value && !(m >= 30 && m <= 300)) return toast('Revisa el peso meta');
    state.profile.meta = m || null;
    if (!$('#dRitmo').disabled) state.profile.ritmo = $('#dRitmo').value;
    save(); render(); toast('Meta guardada');
  });
  const db = $('#dietBreak');
  if (db) db.addEventListener('click', () => { state.dietBreak = { from: todayKey(), until: shiftKey(todayKey(), 6) }; save(); render(); toast('🌴 Semana de mantención activada'); });
  const eb = $('#endBreak');
  if (eb) eb.addEventListener('click', () => { state.dietBreak = null; save(); render(); toast('De vuelta a tu déficit'); });
  // Desafíos
  $$('[data-start-ch]').forEach(b => b.addEventListener('click', () => {
    state.challenges.push({ id: b.dataset.startCh, start: todayKey(), checks: {} });
    save(); render(); tap(); toast('🎯 ¡Desafío iniciado! Día 1 de 30');
  }));
  $$('[data-quit-ch]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('¿Abandonar este desafío?')) return;
    state.challenges = state.challenges.filter(c => !(c.id === b.dataset.quitCh && !c.closed));
    save(); render();
  }));
  $$('[data-check-ch]').forEach(b => b.addEventListener('click', () => {
    const c = state.challenges.find(x => x.id === b.dataset.checkCh && !x.closed);
    c.checks = { ...(c.checks || {}), [todayKey()]: true };
    tap(); save(); render(); toast('✓ ¡Un día más!');
  }));
  $$('[data-wstep]').forEach(b => b.addEventListener('click', () => { $('#wKg').value = r1((Number($('#wKg').value) || 0) + Number(b.dataset.wstep)); tap(); }));
  $$('[data-tab-sum]').forEach(b => b.addEventListener('click', () => { ui.sumRange = Number(b.dataset.tabSum); render(); }));
  paintPhotos();
  if ($('#photoIn')) $('#photoIn').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const src = await shrinkImage(f);
      await photoOp('readwrite', st => st.put({ id: uid(), d: todayKey(), src }));
      toast('Foto guardada 📸'); paintPhotos();
    } catch (err) { toast('No pude guardar la foto'); }
  });
  $$('[data-strength]').forEach(el => {
    const open = () => {
      const x = strengthStats().find(z => z.id === el.dataset.strength);
      const e = exById(x.id);
      const metrics = { rm: [x.pts, '1RM estimado por sesión (kg)'], kg: [x.kgPts, 'Peso más alto por sesión (kg)'], vol: [x.volPts, 'Volumen por sesión (kg × reps)'] };
      const rec = (ico, label, val, d) => `<div class="mini"><b>${val}</b><span>${ico} ${label}${d ? ' · ' + shortDate(d) : ''}</span></div>`;
      openModal(`<h2 style="padding-right:30px">${esc(e.n)}</h2>
        <div class="minis" style="grid-template-columns:repeat(2,1fr)">
          ${x.best ? rec('🏆', '1RM estimado', r0(e1rm(x.best)) + ' kg', x.bestD) : ''}
          ${x.maxKg ? rec('🏋️', 'Peso máximo', `${x.maxKg.kg} kg × ${x.maxKg.reps}`, x.maxKg.d) : ''}
          ${x.maxReps ? rec('🔁', 'Más repeticiones', `${x.maxReps.reps}${x.maxReps.kg ? ' × ' + x.maxReps.kg + ' kg' : ''}`, x.maxReps.d) : ''}
          ${x.bestVol ? rec('📦', 'Mejor volumen', r0(x.bestVol.v) + ' kg', x.bestVol.d) : ''}
        </div>
        <div class="chips" style="margin-top:10px">${Object.entries({ rm: '1RM', kg: 'Peso', vol: 'Volumen' }).map(([k, l]) => `<button class="chip ${k === 'rm' ? 'active' : ''}" data-metric="${k}">${l}</button>`).join('')}</div>
        <p class="muted small" id="mLbl">${metrics.rm[1]}</p><div id="mChart">${lineChart(x.pts, 'kg')}</div>
        ${x.prs.length ? `<p class="small">🎉 Rompiste tu récord <b>${x.prs.length} ${x.prs.length === 1 ? 'vez' : 'veces'}</b>, la última el ${shortDate(x.prs[x.prs.length - 1].d)}.</p>` : ''}`, m => {
        m.querySelectorAll('[data-metric]').forEach(b => b.addEventListener('click', () => {
          const [pts, lbl] = metrics[b.dataset.metric];
          m.querySelectorAll('[data-metric]').forEach(z => z.classList.toggle('active', z === b));
          m.querySelector('#mLbl').textContent = lbl;
          m.querySelector('#mChart').innerHTML = lineChart(pts, b.dataset.metric === 'vol' ? 'kg vol.' : 'kg');
        }));
      });
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') open(); });
  });
  if (ui.progTab !== 'peso') return;
  $('#addWeight').addEventListener('click', () => saveWeight($('#wDate').value, Number($('#wKg').value)));
  $$('[data-del-w]').forEach(b => b.addEventListener('click', () => {
    removeWithUndo(state.weights, w => w.d === b.dataset.delW, 'Peso eliminado');
  }));
  const rtt = $('#rtToggle');
  if (rtt) rtt.addEventListener('click', () => {
    if (state.profile.gastoReal) { state.profile.gastoReal = false; save(); render(); toast('Meta calculada con la fórmula'); }
    else openRealTdee();
  });
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
