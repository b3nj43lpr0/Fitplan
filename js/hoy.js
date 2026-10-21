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
      <div class="meal-acts">${canRepeat ? `<button class="see" data-repeat="${m.id}">↺ Ayer</button>` : ''}<button class="add-meal" data-add-meal="${m.id}" aria-label="Agregar a ${m.name}">＋</button></div></div>
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
      <div class="avatar" aria-hidden="true">${esc((state.profile.nombre || 'T').trim().charAt(0).toUpperCase())}</div>
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
