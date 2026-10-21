// FitPlan · Vista Hoy
'use strict';

// ---------- Vista: Hoy ----------
function ring(value, max, color, size = 170, stroke = 14, track = 'var(--soft)') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" style="--c:${c}"/>
  </svg>`;
}
function macroRing(label, val, goal, color) {
  return `<div class="mring">
    <div class="ring">${ring(val, goal, color, 96, 10)}<div class="center"><span class="big" data-count="${r0(val)}">${r0(val)}</span></div></div>
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
// Avisos según la hora: qué falta registrar hoy, con acción directa
function nudges(d, tg) {
  if (currentDate !== todayKey()) return [];
  const h = new Date().getHours();
  const has = m => d.foods.some(f => f.meal === m);
  const out = [];
  const dismissed = ui.dismissed || [];
  if (h >= 10 && h < 16 && !has('desayuno')) out.push({ id: 'desayuno', ico: '🍳', txt: '¿Ya desayunaste? Regístralo para llevar bien la cuenta.', act: 'meal:desayuno', btn: 'Registrar' });
  if (h >= 15 && !has('almuerzo')) out.push({ id: 'almuerzo', ico: '🍲', txt: 'Aún no registras el almuerzo.', act: 'meal:almuerzo', btn: 'Registrar' });
  if (h >= 21 && !has('cena')) out.push({ id: 'cena', ico: '🥗', txt: 'Falta la cena de hoy.', act: 'meal:cena', btn: 'Registrar' });
  const expected = Math.floor(tg.water * Math.min(1, Math.max(0, (h - 8) / 13)));
  if (d.water < expected - 1) out.push({ id: 'agua', ico: '💧', txt: `Vas ${d.water} de ${tg.water} vasos de agua. ¡Toma uno ahora!`, act: 'water', btn: '+1 vaso' });
  const t = totals(d), dg = dayGoals(tg, t.burned);
  if (h >= 17 && d.foods.length && t.p < dg.prot * 0.6) out.push({ id: 'prot', ico: '🥩', txt: `Te faltan ${r0(dg.prot - t.p)} g de proteína para tu meta de hoy.`, act: 'prot', btn: 'Ideas' });
  const r = state.routine;
  if (r && h >= 16 && !d.exercises.length && r.days.some(x => !x.done)) {
    const i = r.days.findIndex(x => !x.done);
    out.push({ id: 'entreno', ico: '🏋️', txt: `Te toca: ${r.days[i].name}.`, act: 'train:' + i, btn: 'Entrenar' });
  }
  return out.filter(n => !dismissed.includes(n.id)).slice(0, 2);
}
// ---------- Ayuno intermitente ----------
const FAST_PLANS = [12, 14, 16, 18, 20];
const fmtDur = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
const hhmm = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
function fastingCard() {
  const f = state.fasting;
  if (!f || !f.on) return '';
  const done = f.log.slice(-7);
  const stats = done.length ? `Últimos ${done.length}: ${done.filter(x => x.ok).length} cumplidos · promedio ${r1(done.reduce((a, x) => a + (x.end - x.start), 0) / done.length / 3600000).toLocaleString('es')} h` : '';
  if (!f.start) {
    const last = f.log[f.log.length - 1];
    return `<div class="card fast-card">
      <div class="row"><h2>⏱️ Ayuno ${f.plan}:${24 - f.plan}</h2><span class="muted small">ventana para comer abierta</span></div>
      ${last ? `<p class="muted small" style="margin:0 0 10px">Último ayuno: ${fmtDur(last.end - last.start)} ${last.ok ? '✓' : ''}</p>` : ''}
      <div class="btn-row"><button class="btn" id="fastStart" style="flex:1">Empezar ayuno ahora</button><button class="btn ghost" id="fastEarlier">Empecé antes…</button></div>
      ${stats ? `<p class="muted small" style="margin:8px 0 0">${stats}</p>` : ''}
    </div>`;
  }
  const el = Date.now() - f.start, goal = f.plan * 3600000;
  return `<div class="card fast-card on">
    <div class="row"><h2>⏱️ En ayuno</h2><span class="muted small">meta ${f.plan} h</span></div>
    <div class="fast-t" id="fastT">${fmtDur(el)}</div>
    <div class="bar" style="height:10px"><span id="fastBar" style="width:${Math.min(100, el / goal * 100)}%;background:var(--accent)"></span></div>
    <p class="small" id="fastMsg" style="margin:8px 0 10px">${el >= goal ? '✓ ¡Meta cumplida! Puedes comer cuando quieras.' : `Empezaste a las ${hhmm(f.start)} · terminas a las <b>${hhmm(f.start + goal)}</b>`}</p>
    <button class="btn ${el >= goal ? '' : 'ghost'}" id="fastEnd" style="width:100%">${el >= goal ? '🍽️ Terminar ayuno' : 'Terminar antes'}</button>
    ${stats ? `<p class="muted small" style="margin:8px 0 0">${stats}</p>` : ''}
  </div>`;
}
// Actualiza el contador del ayuno cada 30 s sin redibujar la pantalla
setInterval(() => {
  const f = state.fasting, t = document.getElementById('fastT');
  if (!f || !f.start || !t) return;
  const el = Date.now() - f.start, goal = f.plan * 3600000;
  t.textContent = fmtDur(el);
  const b = document.getElementById('fastBar'); if (b) b.style.width = Math.min(100, el / goal * 100) + '%';
  if (el >= goal && !t.dataset.done) { t.dataset.done = '1'; render(); }
}, 30000);
function bindFasting() {
  const f = state.fasting;
  const start = t => { f.start = t; save(); render(); toast(`⏱️ Ayuno iniciado: termina a las ${hhmm(t + f.plan * 3600000)}`); };
  const s = $('#fastStart'); if (s) s.addEventListener('click', () => start(Date.now()));
  const e = $('#fastEarlier');
  if (e) e.addEventListener('click', () => openModal(`<h2>¿A qué hora empezaste?</h2>
    <div class="field"><input id="fastAt" type="time" value="${hhmm(Date.now() - 3600000)}"></div>
    <button class="btn" id="fastAtOk" style="width:100%">Empezar desde esa hora</button>`, m => m.querySelector('#fastAtOk').addEventListener('click', () => {
    const [h, mi] = m.querySelector('#fastAt').value.split(':').map(Number);
    const d = new Date(); d.setHours(h, mi, 0, 0);
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1); // fue ayer en la noche
    closeModal(); start(d.getTime());
  })));
  const en = $('#fastEnd');
  if (en) en.addEventListener('click', () => {
    const end = Date.now(), ok = end - f.start >= f.plan * 3600000;
    f.log = [...f.log, { start: f.start, end, plan: f.plan, ok }].slice(-60);
    f.start = null; save(); render();
    toast(ok ? `🎉 Ayuno de ${fmtDur(end - f.log[f.log.length - 1].start)} cumplido` : `Ayuno de ${fmtDur(end - f.log[f.log.length - 1].start)} registrado`);
    if (ok) confetti(40);
  });
}
const fmtKcal = n => Math.round(Math.abs(n)).toLocaleString('es');
const fmtKg = n => (Math.round(Math.abs(n) * 100) / 100).toLocaleString('es');
const longDate = k => parseKey(k).toLocaleDateString('es', { day: 'numeric', month: 'long' });
// Tarjeta de balance: ayer, últimos 7 días y proyección a la meta
function deficitCard(tg) {
  const y = dayDeficit(shiftKey(todayKey(), -1), tg);
  const st = deficitStats(7, tg);
  const pr = goalProjection(tg);
  const warn = deficitWarnings(tg).find(w => w.lvl === 'alto');
  const word = v => v >= 0 ? 'déficit' : 'superávit';
  if (y === null && !st.logged) return '';
  return `<div class="card deficit-card">
    <div class="row"><h2>🔥 Tu balance</h2><button class="see" data-prog-tab="deficit">Ver más ›</button></div>
    ${tg.breakOn ? `<div class="pill-soft">🌴 Semana de mantención hasta el ${longDate(state.dietBreak.until)}</div>` : ''}
    <div class="def-grid">
      <div><span class="muted small">Ayer</span><b class="${y === null ? '' : y >= 0 ? 'good' : 'bad'}">${y === null ? '—' : fmtKcal(y) + ' kcal'}</b><span class="muted small">${y === null ? 'sin registro' : word(y)}</span></div>
      <div><span class="muted small">Últimos 7 días</span><b class="${st.sum >= 0 ? 'good' : 'bad'}">${fmtKcal(st.sum)} kcal</b><span class="muted small">${word(st.sum)} ≈ ${fmtKg(st.kg)} kg de grasa</span></div>
    </div>
    ${pr && pr.date ? `<p class="small" style="margin:10px 0 0">🏁 Meta de ${state.profile.meta} kg: a este ritmo llegas en <b>${Math.max(1, Math.round(pr.weeks))} semanas</b> (≈ ${longDate(pr.date)}).</p>`
      : pr && pr.stalled ? `<p class="small" style="margin:10px 0 0">🏁 Con tu balance actual no te estás acercando a tu meta de ${state.profile.meta} kg.</p>`
        : pr && pr.reached ? '<p class="small" style="margin:10px 0 0">🏁 ¡Estás en tu peso meta!</p>' : ''}
    ${warn ? `<div class="warn-box">${warn.ico} ${esc(warn.txt)}</div>` : ''}
  </div>`;
}
// Cierra los desafíos que ya cumplieron sus 30 días
function closeChallenges() {
  let changed = false;
  state.challenges.filter(c => !c.closed).forEach(c => {
    const pr = challengeProgress(c);
    if (pr.finished) {
      c.closed = true; c.won = pr.won; changed = true;
      setTimeout(() => { toast(pr.won ? `🥇 ¡Cumpliste el desafío "${pr.def.name}"!` : `Terminó el desafío "${pr.def.name}": ${pr.done}/${CHALLENGE_DAYS} días`); if (pr.won) confetti(); }, 600);
    }
  });
  if (changed) save();
}
function challengesCard() {
  const act = state.challenges.filter(c => !c.closed);
  if (!act.length) return '';
  return `<div class="card">
    <div class="row"><h2>🎯 Desafíos</h2><button class="see" data-prog-tab="logros">Ver todos ›</button></div>
    <div class="list">${act.map(c => {
      const pr = challengeProgress(c), today = pr.days[pr.elapsed - 1];
      return `<div class="item">
        <span class="fi sm">${pr.def.ico}</span>
        <div class="info"><div class="name">${esc(pr.def.name)}</div><div class="muted small">Día ${pr.elapsed} de ${CHALLENGE_DAYS} · ${pr.done} cumplidos (meta ${pr.def.need})</div>
          <div class="bar" style="margin-top:6px"><span style="width:${pr.done / pr.def.need * 100}%;background:var(--accent)"></span></div></div>
        ${today.st === 'ok' ? '<span class="ok-badge">✓ hoy</span>' : pr.def.manual ? `<button class="btn sm" data-check-ch="${c.id}">Hoy ✓</button>` : '<span class="muted small">pendiente</span>'}
      </div>`;
    }).join('')}</div>
  </div>`;
}
// ---------- Resumen semanal (aparece una vez, el primer día que abres la app en la semana) ----------
function mondayOf(k) { const d = parseKey(k); return shiftKey(k, -((d.getDay() + 6) % 7)); }
function weeklyReport(start) {
  const tg = calcTargets();
  const keys = Array.from({ length: 7 }, (_, i) => shiftKey(start, i));
  const logged = keys.filter(k => peekDay(k).foods.length);
  const tt = logged.map(k => totals(peekDay(k)));
  const avg = f => tt.length ? tt.reduce((a, t) => a + f(t), 0) / tt.length : 0;
  const def = logged.reduce((a, k) => a + dayDeficit(k, tg), 0);
  const trainDays = keys.filter(k => peekDay(k).exercises.length).length;
  const ws = state.weights.filter(w => w.d >= shiftKey(start, -3) && w.d <= keys[6]).sort((a, b) => a.d.localeCompare(b.d));
  const wch = ws.length >= 2 ? ws[ws.length - 1].kg - ws[0].kg : null;
  const inGoal = keys.filter(k => dayInGoal(k, tg)).length;
  const water = keys.filter(k => peekDay(k).water >= tg.water).length;
  // Una sugerencia concreta: la primera que aplique
  const tips = [
    [logged.length < 5, `Registraste ${logged.length} de 7 días. Esta semana apunta a 5 o más: lo que no se anota no se puede ajustar.`],
    [avg(t => t.p) < tg.prot * 0.85, `Tu proteína promedio fue ${r0(avg(t => t.p))} g de ${r0(tg.prot)} g. Suma una porción de proteína al desayuno (huevos, yogur griego o quesillo).`],
    [state.profile.objetivo === 'perder' && def / Math.max(1, logged.length) > 1000, 'Tu déficit fue muy alto. Come un poco más para no perder músculo ni energía.'],
    [state.profile.objetivo === 'perder' && def <= 0 && logged.length >= 4, 'No hubo déficit esta semana. Revisa los snacks y bebidas, suelen ser los que más suman.'],
    [state.routine && trainDays < state.routine.dias, `Entrenaste ${trainDays} de ${state.routine ? state.routine.dias : 0} días de tu rutina. Agenda los entrenamientos como una cita.`],
    [water < 4, `Cumpliste tu meta de agua ${water} de 7 días. Deja una botella a la vista.`],
    [true, '¡Gran semana! Mantén lo que estás haciendo.'],
  ];
  return { keys, logged: logged.length, avgKcal: avg(t => t.kcal), avgP: avg(t => t.p), def, trainDays, wch, inGoal, tip: tips.find(t => t[0])[1], tg };
}
function showWeekly(start) {
  const w = weeklyReport(start);
  const word = w.def >= 0 ? 'déficit' : 'superávit';
  openModal(`<div class="weekly">
    <div class="rc-hero">📊</div>
    <h2 style="margin-bottom:2px">Tu semana</h2>
    <p class="muted small" style="margin-top:0">${shortDate(w.keys[0])} al ${shortDate(w.keys[6])}</p>
    <div class="minis" style="grid-template-columns:repeat(2,1fr)">
      <div class="mini"><b>${w.logged}/7</b><span>días registrados</span></div>
      <div class="mini"><b>${w.inGoal}/7</b><span>días en la meta</span></div>
      <div class="mini"><b>${r0(w.avgKcal)}</b><span>kcal promedio (meta ${r0(w.tg.kcal)})</span></div>
      <div class="mini"><b>${r0(w.avgP)} g</b><span>proteína promedio</span></div>
      <div class="mini"><b class="${w.def >= 0 ? 'good' : 'bad'}">${fmtKcal(w.def)}</b><span>kcal de ${word} ≈ ${fmtKg(w.def / KCAL_KG)} kg</span></div>
      <div class="mini"><b>${w.trainDays}</b><span>días con ejercicio</span></div>
    </div>
    ${w.wch !== null ? `<p class="small">⚖️ Peso: <b>${w.wch > 0 ? '+' : ''}${r1(w.wch)} kg</b> en la semana.</p>` : ''}
    <div class="hint-box">💡 ${esc(w.tip)}</div>
    <button class="btn" id="wkOk" style="width:100%">¡Vamos por esta semana!</button></div>`, m => m.querySelector('#wkOk').addEventListener('click', closeModal));
}
function maybeWeekly() {
  const last = shiftKey(mondayOf(todayKey()), -7);
  if (state.weeklySeen === last || !state.profile) return;
  if (Array.from({ length: 7 }, (_, i) => shiftKey(last, i)).filter(k => peekDay(k).foods.length).length < 2) return;
  state.weeklySeen = last; save();
  setTimeout(() => { if (!$('.modal-back')) showWeekly(last); }, 700);
}
function viewHoy() {
  const tg = calcTargets();
  const d = peekDay(currentDate);
  const t = totals(d);
  const dg = dayGoals(tg, t.burned);
  const budget = tg.kcal + t.burned;
  const left = budget - t.kcal;
  const over = left < 0;

  const prev = peekDay(shiftKey(currentDate, -1));
  const meals = MEALS.map(m => {
    const items = d.foods.filter(f => f.meal === m.id);
    const sum = items.reduce((a, f) => a + f.kcal, 0);
    const canRepeat = !items.length && prev.foods.some(f => f.meal === m.id);
    return `<div class="meal"><div class="meal-head"><h3><span class="ico-c">${MEAL_ICO[m.id] || '🍽️'}</span>${m.name}${items.length ? ` <span class="muted small" style="font-weight:500">${r0(sum)} kcal</span>` : ''}</h3>
      <div class="meal-acts">${canRepeat ? `<button class="see" data-repeat="${m.id}">↺ Ayer</button>` : ''}${items.length >= 2 ? `<button class="add-meal" data-save-combo="${m.id}" aria-label="Guardar ${m.name} como combo" title="Guardar como combo">💾</button>` : ''}<button class="add-meal" data-add-meal="${m.id}" aria-label="Agregar a ${m.name}">＋</button></div></div>
      <div class="list">${items.length ? items.map(f => `
        <div class="item tappable" data-edit-food="${f.id}" tabindex="0" role="button">
          <span class="fi sm" aria-hidden="true">${entryIcon(f)}</span>
          <div class="info"><div class="name">${esc(f.name)}</div><div class="muted small">${f.grams ? r0(f.grams) + ' g · ' : ''}P ${r0(f.p)} · C ${r0(f.c)} · G ${r0(f.g)}</div></div>
          <span class="kcal">${r0(f.kcal)}</span>
          <button class="icon-btn" data-del-food="${f.id}" aria-label="Eliminar">✕</button>
        </div>`).join('') : ''}</div></div>`;
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


  // Lo que dice el plan semanal para hoy
  const planDay = state.plan ? state.plan.days.find(x => x.date === currentDate) : null;
  const planHtml = planDay ? MEALS.map(m => {
    const pm = planDay.meals[m.id];
    const r = pm && allRecipes().find(x => x.id === pm.id);
    return r ? `<div class="item"><span class="fi sm" aria-hidden="true">${recipeIcon(r)}</span><div class="info"><div class="muted small">${m.name}</div><div class="name">${esc(r.name)}</div></div>
      <span class="kcal">${r0(recipeNutrition(r, pm.f).kcal)}</span>
      <button class="btn ghost sm" data-log-recipe="${r.id}" data-factor="${pm.f}" data-meal="${m.id}">+ Agregar</button></div>` : '';
  }).join('') : '';

  return `
    <div class="hello">
      <button class="avatar" id="avatarBtn" aria-label="Cambiar de persona" title="Cambiar de persona">${initial(state.profile.nombre)}</button>
      <div class="who"><div class="greet">${greeting()} 👋</div><div class="name">${esc(state.profile.nombre || 'Hola')}</div></div>
      ${streak() ? `<button class="streak" data-go="progreso" title="Días seguidos registrando">🔥 ${streak()}</button>` : ''}
      <button class="round-btn" data-go="perfil" aria-label="Perfil">⚙️</button>
    </div>
    ${dateBar()}
    ${nudges(d, tg).map(n => `<div class="nudge"><span class="ni">${n.ico}</span><span class="nt">${esc(n.txt)}</span><button class="btn sm" data-nudge="${n.act}">${n.btn}</button><button class="icon-btn" data-dismiss="${n.id}" aria-label="Ocultar">✕</button></div>`).join('')}
    <div class="hero">
      <div class="ring">${ring(t.kcal, budget, over ? 'var(--danger)' : 'var(--accent-2)', 150, 14, 'rgba(255,255,255,.12)')}
        <div class="center"><span class="big" data-count="${budget > 0 ? Math.round(Math.min(999, t.kcal / budget * 100)) : 0}" data-suffix="%">${budget > 0 ? Math.round(Math.min(999, t.kcal / budget * 100)) : 0}%</span><span class="muted small">consumido</span></div>
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
    <div class="card">
      <div class="row"><h2>Macros del día</h2><button class="see" data-go="recetas">Ver recetas ›</button></div>
      ${dg.train ? `<p class="muted small" style="margin:-4px 0 6px">💪 Día de entrenamiento: tu meta sube ${r0(dg.carb - tg.carb)} g de carbohidratos para recuperarte.</p>` : ''}
      <div class="rings3">
        ${macroRing('Proteína', t.p, dg.prot, 'var(--prot)')}
        ${macroRing('Carbos', t.c, dg.carb, 'var(--carb)')}
        ${macroRing('Grasas', t.g, dg.fat, 'var(--fat)')}
      </div>
    </div>
    <div class="grid g2">
      <div>
        <div class="card">
          <div class="row"><h2>Comidas</h2><div class="btn-row" style="margin:0">${!d.foods.length && prev.foods.length ? '<button class="btn ghost sm" data-repeat="all">↺ Copiar ayer</button>' : ''}<button class="btn sm" data-go="comidas">+ Agregar</button></div></div>
          ${meals}
        </div>
        ${planHtml ? `<div class="card"><div class="row"><h2>Tu plan para hoy</h2><button class="btn ghost sm" data-go="recetas">Ver plan</button></div><div class="list">${planHtml}</div></div>` : ''}
      </div>
      <div>
        <div class="card">
          <div class="row"><h2>Ejercicio</h2><button class="btn sm burn" data-go="ejercicio">+ Agregar</button></div>
          <div class="list">${ex}</div>
        </div>
        <div class="card water-card">
          <div class="row"><h2>💧 Agua</h2><span class="muted small">${(d.water * 0.25).toLocaleString('es')} de ${(tg.water * 0.25).toLocaleString('es')} L</span></div>
          <div class="water-row">
            <button class="round-btn" data-water-step="-1" aria-label="Quitar un vaso" ${d.water ? '' : 'disabled'}>−</button>
            <div class="water-main"><div class="water-n"><b>${d.water}</b> / ${tg.water} vasos</div>
              <div class="bar"><span style="width:${Math.min(100, d.water / tg.water * 100)}%;background:var(--water)"></span></div></div>
            <button class="round-btn water-plus" data-water-step="1" aria-label="Agregar un vaso">＋</button>
          </div>
        </div>
        ${fastingCard()}
        ${deficitCard(tg)}
        ${challengesCard()}
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
  $$('[data-del-food]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    removeWithUndo(day().foods, f => f.id === b.dataset.delFood);
  }));
  $$('[data-edit-food]').forEach(el => {
    const open = () => editFoodEntry(el.dataset.editFood);
    el.addEventListener('click', open);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') open(); });
  });
  $$('[data-repeat]').forEach(b => b.addEventListener('click', () => {
    const which = b.dataset.repeat;
    const src = peekDay(shiftKey(currentDate, -1)).foods.filter(f => which === 'all' || f.meal === which);
    day().foods.push(...src.map(f => ({ ...f, id: uid() })));
    save(); render(); toast(`Copiado: ${src.length} ${src.length === 1 ? 'alimento' : 'alimentos'} de ayer`);
  }));
  $$('[data-del-ex]').forEach(b => b.addEventListener('click', () => {
    removeWithUndo(day().exercises, e => e.id === b.dataset.delEx, 'Actividad eliminada');
  }));
  $$('[data-water-step]').forEach(b => b.addEventListener('click', () => {
    const d = day();
    d.water = Math.max(0, d.water + Number(b.dataset.waterStep)); tap(); save(); render();
    if (d.water === calcTargets().water && b.dataset.waterStep === '1') { toast('💧 ¡Meta de agua cumplida!'); confetti(40); }
  }));
  $$('[data-add-meal]').forEach(b => b.addEventListener('click', () => { ui.meal = b.dataset.addMeal; go('comidas'); }));
  $$('[data-dismiss]').forEach(b => b.addEventListener('click', () => { ui.dismissed = [...(ui.dismissed || []), b.dataset.dismiss]; render(); }));
  $$('[data-nudge]').forEach(b => b.addEventListener('click', () => {
    const [kind, arg] = b.dataset.nudge.split(':');
    if (kind === 'meal') { ui.meal = arg; go('comidas'); }
    if (kind === 'water') { day().water++; tap(); save(); render(); toast('💧 ¡Bien!'); }
    if (kind === 'prot') { ui.recipeTab = 'recetas'; ui.recipeTag = 'alta-proteina'; ui.recipeType = 'todas'; go('recetas'); }
    if (kind === 'train') { ui.rutTab = 'rutina'; go('rutinas'); startWorkout(Number(arg)); }
  }));
  bindLogRecipe(currentDate);
  $('#avatarBtn').addEventListener('click', openProfiles);
  $$('[data-prog-tab]').forEach(b => b.addEventListener('click', () => { ui.progTab = b.dataset.progTab; go('progreso'); }));
  $$('[data-check-ch]').forEach(b => b.addEventListener('click', () => {
    const c = state.challenges.find(x => x.id === b.dataset.checkCh && !x.closed);
    c.checks = { ...(c.checks || {}), [todayKey()]: true };
    tap(); save(); render(); toast('✓ ¡Un día más!');
  }));
  if (state.fasting && state.fasting.on) bindFasting();
  $$('[data-save-combo]').forEach(b => b.addEventListener('click', () => {
    const meal = b.dataset.saveCombo, items = day().foods.filter(f => f.meal === meal);
    const name0 = `Mi ${MEALS.find(m => m.id === meal).name.toLowerCase()}`;
    openModal(`<h2>Guardar como combo</h2>
      <p class="muted small" style="margin-top:-6px">${items.map(x => esc(x.name)).join(', ')} · ${r0(items.reduce((a, x) => a + x.kcal, 0))} kcal</p>
      <div class="field"><label for="cbName">Nombre</label><input id="cbName" value="${esc(name0)}"></div>
      <button class="btn" id="cbSave" style="width:100%">Guardar combo</button>`, m => m.querySelector('#cbSave').addEventListener('click', () => {
      const name = m.querySelector('#cbName').value.trim() || name0;
      state.combos.push({ id: uid(), name, meal, items: items.map(({ id, ...x }) => x) });
      save(); closeModal(); toast(`🍱 Combo "${name}" guardado: lo encuentras en Comidas → Combos`);
    }));
  }));
  closeChallenges();
  maybeWeekly();
};

// Editar cantidad o comida de un registro del día
function editFoodEntry(id) {
  const d = day();
  const f = d.foods.find(x => x.id === id);
  if (!f) return;
  const food = f.foodId && foodById(f.foodId);
  openModal(`
    <div class="sheet-title"><span class="fi lg" aria-hidden="true">${entryIcon(f)}</span><h2>${esc(f.name)}</h2></div>
    <div class="grid g2" style="gap:10px">
      ${food ? `<div class="field"><label for="eGrams">Cantidad (g)</label><input id="eGrams" type="number" min="1" inputmode="decimal" value="${r0(f.grams)}"></div>`
    : `<div class="field"><label for="eKcal">kcal</label><input id="eKcal" type="number" min="0" inputmode="decimal" value="${r0(f.kcal)}"></div>`}
      <div class="field"><label for="eMeal">Comida</label><select id="eMeal">${MEALS.map(m => `<option value="${m.id}" ${m.id === f.meal ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
    </div>
    ${food ? `<div class="chips">${[0.5, 1, 1.5, 2].map(x => `<button class="chip" data-mult="${x}">${x === 1 ? 'Porción' : x + '×'}</button>`).join('')}</div>` : ''}
    <div class="result-box" id="ePrev"></div>
    <div class="btn-row">
      <button class="btn" id="eSave">Guardar</button>
      ${food ? `<button class="btn ghost" id="eFav">${isFav(food.id) ? '★ En favoritas' : '☆ Favorita'}</button>` : ''}
      <button class="btn ghost" id="eDel" style="color:var(--danger)">Eliminar</button>
    </div>`, m => {
    const prevBox = m.querySelector('#ePrev');
    const calc = () => food ? nutrition(food, Number(m.querySelector('#eGrams').value) || 0)
      : { kcal: Number(m.querySelector('#eKcal').value) || 0, p: f.p, c: f.c, g: f.g };
    const upd = () => { const n = calc(); prevBox.innerHTML = `<b style="font-size:20px">${r0(n.kcal)} kcal</b> <span class="muted small">P ${r1(n.p)} · C ${r1(n.c)} · G ${r1(n.g)}</span>`; };
    m.querySelectorAll('input').forEach(i => i.addEventListener('input', upd));
    m.querySelectorAll('[data-mult]').forEach(b => b.addEventListener('click', () => {
      m.querySelector('#eGrams').value = r0((food.por || 100) * Number(b.dataset.mult)); upd();
    }));
    upd();
    m.querySelector('#eSave').addEventListener('click', () => {
      Object.assign(f, calc(), { meal: m.querySelector('#eMeal').value });
      if (food) f.grams = Number(m.querySelector('#eGrams').value) || f.grams;
      save(); closeModal(); render(); toast('Actualizado');
    });
    const fv = m.querySelector('#eFav');
    if (fv) fv.addEventListener('click', () => {
      state.favFoods = isFav(food.id) ? state.favFoods.filter(x => x !== food.id) : [...state.favFoods, food.id];
      save(); fv.textContent = isFav(food.id) ? '★ En favoritas' : '☆ Favorita';
    });
    m.querySelector('#eDel').addEventListener('click', () => {
      closeModal(); removeWithUndo(d.foods, x => x.id === id);
    });
  });
}
