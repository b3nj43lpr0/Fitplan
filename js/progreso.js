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
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(t => `<line x1="${P}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(255,255,255,.08)"/><text x="${P - 6}" y="${y(t) + 4}" text-anchor="end" class="axis">${r1(t)}</text>`).join('')}
    <polygon fill="url(#wg)" points="${area}"/>
    <polyline fill="none" stroke="var(--accent-2)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>
    ${ws.map(w => `<circle cx="${x(w.d)}" cy="${y(w.kg)}" r="3" fill="rgba(255,255,255,.55)"><title>${shortDate(w.d)}: ${w.kg} kg</title></circle>`).join('')}
    <line x1="${x(last.d)}" x2="${x(last.d)}" y1="10" y2="${H - 30}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4"/>
    <circle cx="${x(last.d)}" cy="${y(last.kg)}" r="7" fill="#fff" stroke="var(--accent)" stroke-width="4"/>
    <text x="${P}" y="${H - 6}" class="axis">${shortDate(first)}</text><text x="${W - 10}" y="${H - 6}" text-anchor="end" class="axis">${shortDate(last.d)}</text>
  </svg><div class="muted small">Puntos = cada pesaje · Línea violeta = promedio de 7 días (más confiable que un día suelto).</div>`;
}
function strengthStats() {
  const map = new Map();
  for (const w of state.workouts) for (const x of w.ex) {
    const withKg = x.sets.filter(z => z.kg);
    if (!map.has(x.id)) map.set(x.id, { id: x.id, sessions: 0, best: null, pts: [] });
    const st = map.get(x.id);
    st.sessions++;
    if (withKg.length) {
      const top = withKg.reduce((a, z) => (e1rm(z) > e1rm(a) ? z : a));
      if (!st.best || e1rm(top) > e1rm(st.best)) st.best = top;
      st.pts.push({ d: w.d, v: e1rm(top) });
    }
  }
  return [...map.values()].filter(x => exById(x.id)).sort((a, b) => b.sessions - a.sessions);
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
  return `<div class="card">
    <div class="row"><h2>Fuerza</h2><span class="muted small">${state.workouts.length} entrenamientos registrados</span></div>
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
    const rq = indexedDB.open('fitplan-photos', 1);
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
  const head = pageHead('Progreso') + tabs('prog', ui.progTab, [['peso', '⚖️ Peso'], ['resumen', '📊 Resumen'], ['fuerza', '💪 Fuerza'], ['logros', '🏅 Logros']]);
  if (ui.progTab === 'resumen') return head + summaryCard();
  if (ui.progTab === 'fuerza') return head + strengthCard();
  if (ui.progTab === 'logros') return head + badgesCard() + photosCard();
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
      openModal(`<h2 style="padding-right:30px">${esc(e.n)}</h2>
        <p class="muted small">1RM estimado por sesión (kg)</p>${lineChart(x.pts, 'kg')}
        ${x.best ? `<div class="result-box">Mejor serie: <b>${x.best.kg} kg × ${x.best.reps}</b> · 1RM ≈ <b>${r0(e1rm(x.best))} kg</b></div>` : ''}`);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') open(); });
  });
  if (ui.progTab !== 'peso') return;
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
    removeWithUndo(state.weights, w => w.d === b.dataset.delW, 'Peso eliminado');
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
