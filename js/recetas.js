// FitPlan · Recetas, plan semanal y lista de compras
'use strict';

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
  return allRecipes().filter(r => (r.tipo === mealId || (mealId === 'cena' && r.tipo === 'almuerzo') || (mealId === 'almuerzo' && r.tipo === 'cena'))
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
const TAG_LABEL = { 'alta-proteina': 'Alta en proteína', vegetariana: 'Vegetariana', rapida: 'Rápida', economica: 'Económica' };
const TIPO_ICO = { desayuno: '🍳', almuerzo: '🍲', cena: '🥗', snack: '🍎' };
// Tarjeta compacta: tocarla abre el detalle
function recipeCard(rec, factor = 1, note = '') {
  const n = recipeNutrition(rec, factor);
  return `<div class="rcard" data-open-recipe="${rec.id}" data-factor="${factor}" role="button" tabindex="0">
    <div class="rc-ico">${TIPO_ICO[rec.tipo] || '🍽️'}</div>
    <div class="rc-body">
      <b>${esc(rec.name)}</b>
      <span class="muted small">${r0(n.kcal)} kcal · P ${r0(n.p)} · C ${r0(n.c)} · G ${r0(n.g)}${factor !== 1 ? ` · porción ×${factor}` : ''}</span>
      ${note ? `<span class="muted small">${note}</span>` : `<span class="rc-tags">${rec.custom ? '<span class="tag">Mía</span>' : ''}${rec.tags.slice(0, 2).map(t => `<span class="tag neutral">${TAG_LABEL[t] || t}</span>`).join('')}</span>`}
    </div>
    <button class="quick-add" data-log-recipe="${rec.id}" data-factor="${factor}" aria-label="Agregar ${esc(rec.name)} a hoy" title="Agregar a hoy">＋</button>
  </div>`;
}
function logRecipe(rec, factor, mealId, dateKey = todayKey()) {
  const n = recipeNutrition(rec, factor);
  const grams = rec.ing.reduce((a, [, g]) => a + g * factor, 0);
  day(dateKey).foods.push({ id: uid(), name: rec.name, grams, meal: mealId || rec.tipo, ...n });
  save(); tap();
  toast(`✓ ${rec.name} · ${r0(n.kcal)} kcal`);
}
function openRecipe(id, factor = 1) {
  const rec = allRecipes().find(r => r.id === id);
  if (!rec) return;
  const n = recipeNutrition(rec, factor);
  openModal(`
    <div class="rc-hero">${TIPO_ICO[rec.tipo] || '🍽️'}</div>
    <h2 style="padding-right:30px;margin-bottom:6px">${esc(rec.name)}</h2>
    <div class="tags"><span class="tag type">${rec.tipo}</span>${rec.tags.map(t => `<span class="tag">${TAG_LABEL[t] || t}</span>`).join('')}${factor !== 1 ? `<span class="tag neutral">porción ×${factor}</span>` : ''}</div>
    <div class="minis">
      <div class="mini"><b>${r0(n.kcal)}</b><span>kcal</span></div>
      <div class="mini"><b style="color:var(--prot)">${r0(n.p)} g</b><span>proteína</span></div>
      <div class="mini"><b style="color:var(--carb)">${r0(n.c)} g</b><span>carbos</span></div>
      <div class="mini"><b style="color:var(--fat)">${r0(n.g)} g</b><span>grasas</span></div>
    </div>
    <h3>Ingredientes</h3>
    <ul class="ing">${rec.ing.map(([fid, g]) => { const f = foodById(fid); return f ? `<li><span>${esc(f.name)}</span><span class="muted">${r0(g * factor)} g</span></li>` : ''; }).join('')}</ul>
    ${rec.pasos.length ? `<h3>Preparación</h3><ol class="steps">${rec.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <div class="meal-pick small-pick">${MEALS.map(x => `<button class="${x.id === (MEALS.some(mm => mm.id === rec.tipo) ? rec.tipo : ui.meal) ? 'on' : ''}" data-sheet-meal="${x.id}">${MEAL_ICO[x.id]} ${x.name}</button>`).join('')}</div>
    <div class="btn-row">
      <button class="btn" id="rcAdd" style="flex:1">Agregar a hoy</button>
      ${rec.custom ? `<button class="btn ghost" data-edit-recipe="${rec.id}">✏️ Editar</button>` : `<a class="btn ghost" href="${ytUrl('receta ' + rec.name)}" target="_blank" rel="noopener">▶ Video</a>`}
    </div>`, m => {
    let meal = MEALS.some(mm => mm.id === rec.tipo) ? rec.tipo : ui.meal;
    m.querySelectorAll('[data-sheet-meal]').forEach(b => b.addEventListener('click', () => { meal = b.dataset.sheetMeal; m.querySelectorAll('[data-sheet-meal]').forEach(x => x.classList.toggle('on', x === b)); }));
    m.querySelector('#rcAdd').addEventListener('click', () => { logRecipe(rec, factor, meal); closeModal(); if (view === 'hoy') render(); });
    const ed = m.querySelector('[data-edit-recipe]');
    if (ed) ed.addEventListener('click', () => recipeEditor(rec.id));
  });
}
function bindLogRecipe(dateKey = todayKey()) {
  $$('[data-log-recipe]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const rec = allRecipes().find(r => r.id === b.dataset.logRecipe);
    logRecipe(rec, Number(b.dataset.factor), b.dataset.meal, dateKey);
    b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 400);
    if (view === 'hoy') render();
  }));
  $$('[data-open-recipe]').forEach(el => {
    const open = () => openRecipe(el.dataset.openRecipe, Number(el.dataset.factor) || 1);
    el.addEventListener('click', open);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') open(); });
  });
}
// Crear o editar una receta propia: busca ingredientes y calcula las calorías al instante
function recipeEditor(id) {
  const old = id && state.customRecipes.find(r => r.id === id);
  const draft = old ? JSON.parse(JSON.stringify(old)) : { name: '', tipo: 'almuerzo', tags: [], ing: [], pasos: [] };
  const TAGS = ['alta-proteina', 'vegetariana', 'rapida', 'economica'];
  openModal(`
    <h2>${old ? 'Editar receta' : 'Nueva receta'}</h2>
    <div class="field"><label for="rcName">Nombre</label><input id="rcName" value="${esc(draft.name)}" placeholder="Ej: Pollo al jugo de la abuela"></div>
    <div class="field"><label for="rcTipo">Tipo de comida</label><select id="rcTipo">${MEALS.map(m => `<option value="${m.id}" ${m.id === draft.tipo ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
    <div class="chips">${TAGS.map(t => `<button class="chip ${draft.tags.includes(t) ? 'active' : ''}" data-rctag="${t}">${t.replace('-', ' ')}</button>`).join('')}</div>
    <h3>Ingredientes <span class="muted small" id="rcTot"></span></h3>
    <div class="list" id="rcIng"></div>
    <div class="field" style="position:relative"><input id="rcSearch" type="search" placeholder="Buscar ingrediente para agregar…" autocomplete="off"><div class="list" id="rcRes"></div></div>
    <div class="field"><label for="rcPasos">Preparación (un paso por línea)</label><textarea id="rcPasos" rows="4">${esc(draft.pasos.join('\n'))}</textarea></div>
    <div class="btn-row"><button class="btn" id="rcSave">Guardar receta</button>${old ? '<button class="btn ghost" id="rcDel" style="color:var(--danger)">Eliminar</button>' : ''}</div>`, m => {
    const q = sel => m.querySelector(sel);
    const paintIng = () => {
      const n = recipeNutrition(draft);
      q('#rcTot').textContent = draft.ing.length ? `· ${r0(n.kcal)} kcal · P ${r0(n.p)} · C ${r0(n.c)} · G ${r0(n.g)}` : '';
      q('#rcIng').innerHTML = draft.ing.map(([fid, g], k) => {
        const f = foodById(fid);
        return f ? `<div class="item"><div class="info"><div class="name">${esc(f.name)}</div><div class="muted small">${r0(f.kcal * g / 100)} kcal</div></div>
          <input type="number" min="1" inputmode="decimal" value="${g}" data-ig="${k}" style="width:84px;text-align:center"> <span class="muted small">g</span>
          <button class="icon-btn" data-idel="${k}" aria-label="Quitar">✕</button></div>` : '';
      }).join('') || '<div class="empty">Agrega ingredientes con el buscador.</div>';
      m.querySelectorAll('[data-ig]').forEach(inp => inp.addEventListener('change', () => { draft.ing[inp.dataset.ig][1] = Math.max(1, Number(inp.value) || 1); paintIng(); }));
      m.querySelectorAll('[data-idel]').forEach(b => b.addEventListener('click', () => { draft.ing.splice(Number(b.dataset.idel), 1); paintIng(); }));
    };
    paintIng();
    q('#rcSearch').addEventListener('input', () => {
      const t = norm(q('#rcSearch').value.trim());
      const res = t.length < 2 ? [] : allFoods().filter(f => norm(f.name).includes(t)).slice(0, 8);
      q('#rcRes').innerHTML = res.map(f => `<div class="item tappable" data-pick="${f.id}"><div class="info"><div class="name">${esc(f.name)}</div><div class="muted small">${r0(f.kcal)} kcal / 100 g</div></div><span class="quick-add">＋</span></div>`).join('');
      m.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', () => {
        const f = foodById(el.dataset.pick);
        draft.ing.push([f.id, f.por || 100]);
        q('#rcSearch').value = ''; q('#rcRes').innerHTML = '';
        paintIng();
      }));
    });
    m.querySelectorAll('[data-rctag]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.rctag;
      draft.tags = draft.tags.includes(t) ? draft.tags.filter(x => x !== t) : [...draft.tags, t];
      b.classList.toggle('active');
    }));
    q('#rcSave').addEventListener('click', () => {
      draft.name = q('#rcName').value.trim();
      draft.tipo = q('#rcTipo').value;
      draft.pasos = q('#rcPasos').value.split('\n').map(x => x.trim()).filter(Boolean);
      if (!draft.name) return toast('Ponle un nombre a la receta');
      if (!draft.ing.length) return toast('Agrega al menos un ingrediente');
      if (old) Object.assign(old, draft);
      else state.customRecipes.push({ ...draft, id: 'u_' + uid(), custom: true });
      save(); closeModal(); ui.recipeTag = 'mias'; ui.recipeType = 'todas'; render(); toast('Receta guardada 👩‍🍳');
    });
    const del = q('#rcDel');
    if (del) del.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta receta?')) return;
      state.customRecipes = state.customRecipes.filter(r => r.id !== id);
      save(); closeModal(); render();
    });
  });
}
function viewRecetas() {
  const head = pageHead('Recetas') + tabs('rec', ui.recipeTab, [['recetas', '🍽️ Qué comer'], ['plan', '🗓️ Plan'], ['compras', '🛒 Compras']]);
  if (ui.recipeTab === 'plan') return head + viewPlan();
  if (ui.recipeTab === 'compras') return head + viewCompras();

  const { meal, target, left } = nextMealTarget();
  const tipos = ['todas', 'desayuno', 'almuerzo', 'cena', 'snack'];
  const tags = ['todas', 'mias', 'alta-proteina', 'vegetariana', 'rapida', 'economica'];
  const list = allRecipes().filter(r => (ui.recipeType === 'todas' || r.tipo === ui.recipeType) && (ui.recipeTag === 'todas' || (ui.recipeTag === 'mias' ? r.custom : r.tags.includes(ui.recipeTag))));
  const sugg = (ui.suggest || []).map(id => allRecipes().find(r => r.id === id)).filter(Boolean);
  return head + `
    <div class="card next-meal">
      <div>
        <div class="muted small">Tu próxima comida · ${MEAL_ICO[meal.id]} ${meal.name.toLowerCase()}</div>
        <b>${left > 0 ? `Apunta a unas ${r0(target)} kcal` : 'Ya cubriste tu meta: algo liviano'}</b>
      </div>
      <button class="btn" id="suggestBtn">✨ Sugerir</button>
    </div>
    ${sugg.length ? `<h2>Sugerencias para ti</h2><div class="rgrid">${sugg.map(r => recipeCard(r, scaleFactor(r, left > 0 ? target : 200), 'Porción ajustada a lo que te queda hoy')).join('')}</div>` : ''}
    <div class="row" style="margin-top:8px"><h2 style="margin:0">Todas las recetas</h2><button class="btn sm" id="newRecipe">＋ Crear receta</button></div>
    <div class="chips scroll-x">${tipos.map(t => `<button class="chip ${t === ui.recipeType ? 'active' : ''}" data-rtype="${t}">${t === 'todas' ? 'Todas' : (TIPO_ICO[t] || '') + ' ' + t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    <div class="chips scroll-x">${tags.map(t => `<button class="chip ${t === ui.recipeTag ? 'active' : ''}" data-rtag="${t}">${t === 'todas' ? 'Cualquiera' : t === 'mias' ? '👩‍🍳 Mis recetas' : TAG_LABEL[t]}</button>`).join('')}</div>
    <p class="muted small" style="margin:4px 0 8px">${list.length} recetas</p>
    <div class="rgrid">${list.map(r => recipeCard(r)).join('') || '<p class="muted">No hay recetas con esos filtros.</p>'}</div>`;
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
      const pool = recipesFor(m.id).length ? recipesFor(m.id) : allRecipes().filter(r => r.tipo === m.id);
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
        const r = pm && allRecipes().find(x => x.id === pm.id);
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
    const r = allRecipes().find(x => x.id === pm.id);
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
      <div class="btn-row" style="margin:0"><button class="btn ghost sm" id="copyList">📋 Copiar</button><button class="btn ghost sm" id="shareList">📤 Compartir</button></div></div>
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
    if (left <= 0) pool = allRecipes().filter(r => r.tipo === 'snack');
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
  const listText = () => '🛒 Lista de compras FitPlan\n\n' + Object.entries(shoppingList()).map(([cat, items]) => {
    const pend = items.filter(i => !(state.plan.checked || {})[i.id]);
    return pend.length ? cat + ':\n' + pend.map(i => `• ${i.name}: ${fmtQty(i.g)}`).join('\n') : '';
  }).filter(Boolean).join('\n\n');
  const cl = $('#copyList');
  if (cl) cl.addEventListener('click', () => {
    (navigator.clipboard ? navigator.clipboard.writeText(listText()) : Promise.reject()).then(() => toast('Lista copiada')).catch(() => toast('No pude copiar la lista'));
  });
  const sl = $('#shareList');
  if (sl) sl.addEventListener('click', () => {
    const txt = listText();
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  });
  const nr = $('#newRecipe');
  if (nr) nr.addEventListener('click', () => recipeEditor());
  $$('[data-edit-recipe]').forEach(b => b.addEventListener('click', () => recipeEditor(b.dataset.editRecipe)));
  bindLogRecipe();
};
