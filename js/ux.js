// FitPlan · Atajos de uso: botón ＋, buscador global, entrenamiento en curso, gestos y consejos de primer uso
'use strict';

// ---------- Botón ＋: registrar cualquier cosa en 2 toques ----------
const QUICK_ADD = [
  ['foto', '📸', 'Foto del plato', () => openAIFood('foto')],
  ['texto', '💬', 'Escribir o dictar', () => openAIFood('texto')],
  ['buscar', '🔍', 'Buscar alimento', () => { closeModal(); currentDate = todayKey(); ui.foodQuery = ''; ui.comTab = 'registrar'; go('comidas'); setTimeout(() => { const i = $('#foodSearch'); if (i) i.focus(); }, 50); }],
  ['escanear', '📷', 'Escanear código', () => openScanner()],
  ['agua', '💧', 'Vaso de agua', () => { closeModal(); day(todayKey()).water++; save(); render(); tap(); toast(`💧 +1 vaso · llevas ${peekDay(todayKey()).water} de ${calcTargets().water}`); }],
  ['peso', '⚖️', 'Anotar peso', () => openWeightQuick()],
  ['gym', '🏋️', 'Ejercicios del gym', () => { currentDate = todayKey(); openGymLog(); }],
  ['actividad', '🏃', 'Cardio o actividad', () => { closeModal(); currentDate = todayKey(); go('ejercicio'); }],
];
function openQuickAdd() {
  openModal(`<h2>¿Qué quieres registrar?</h2>
    <div class="qa-grid">${QUICK_ADD.map(([id, ico, label]) => `<button class="qa-tile" data-qa="${id}"><span>${ico}</span>${label}</button>`).join('')}</div>
    <button class="btn ghost" id="qaSearch" style="width:100%;margin-top:12px">🔎 Buscar en toda la app</button>`, m => {
    m.querySelectorAll('[data-qa]').forEach(b => b.addEventListener('click', () => QUICK_ADD.find(x => x[0] === b.dataset.qa)[3]()));
    m.querySelector('#qaSearch').addEventListener('click', openGlobalSearch);
  });
}
function openWeightQuick() {
  openModal(`<h2>⚖️ Anotar peso</h2>
    <div class="qty"><button class="round-btn" data-wq="-0.1" aria-label="Menos 100 g">−</button>
      <div class="field" style="margin:0;flex:1"><input id="wqKg" type="number" step="0.1" min="30" max="300" inputmode="decimal" value="${r1(currentWeight())}" aria-label="Peso en kg"><span class="unit-in">kg</span></div>
      <button class="round-btn" data-wq="0.1" aria-label="Más 100 g">＋</button></div>
    <p class="muted small">Pésate en ayunas, después de ir al baño.</p>
    <button class="btn" id="wqSave" style="width:100%">Guardar peso de hoy</button>`, m => {
    const i = m.querySelector('#wqKg');
    m.querySelectorAll('[data-wq]').forEach(b => b.addEventListener('click', () => { i.value = r1((Number(i.value) || 0) + Number(b.dataset.wq)); tap(); }));
    m.querySelector('#wqSave').addEventListener('click', () => { if (saveWeight(todayKey(), Number(i.value))) closeModal(); });
  });
}
const fab = document.createElement('button');
fab.className = 'fab'; fab.id = 'fab'; fab.setAttribute('aria-label', 'Registrar'); fab.title = 'Registrar';
fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
fab.addEventListener('click', openQuickAdd);
document.body.appendChild(fab);

// ---------- Buscador global: alimentos, recetas, ejercicios y secciones de la app ----------
// Cada sección con palabras con que alguien la buscaría, para que cualquiera encuentre todo
const PLACES = [
  ['Registrar comida', 'comer anotar diario alimento', () => { ui.comTab = 'registrar'; go('comidas'); }],
  ['Recetas', 'cocinar recetas ideas', () => { ui.comTab = 'recetas'; go('comidas'); }],
  ['Plan semanal de comidas', 'plan menu semana dieta', () => { ui.comTab = 'plan'; go('comidas'); }],
  ['Lista de compras', 'compras supermercado lista', () => { ui.comTab = 'compras'; go('comidas'); }],
  ['Ejercicios del gym', 'gym pesas series registrar entrenamiento', () => { currentDate = todayKey(); openGymLog(); }],
  ['Mi rutina', 'rutina plan entrenamiento semana', () => { ui.rutTab = 'rutina'; go('rutinas'); }],
  ['Cardio y actividad', 'cardio correr caminar bici actividad cronometro', () => go('ejercicio')],
  ['Biblioteca de ejercicios', 'ejercicios biblioteca musculo', () => { ui.rutTab = 'biblioteca'; go('rutinas'); }],
  ['Peso y gráfico', 'peso balanza kilos grafico', () => { ui.progTab = 'peso'; go('progreso'); }],
  ['Medidas corporales', 'medidas cintura grasa', () => { ui.progTab = 'peso'; go('progreso'); }],
  ['Gasto real', 'gasto real tdee metabolismo calorias', () => { ui.progTab = 'peso'; go('progreso'); }],
  ['Déficit calórico', 'deficit balance perder grasa meta', () => { ui.progTab = 'deficit'; go('progreso'); }],
  ['Resumen semanal', 'resumen semana estadisticas', () => { ui.progTab = 'resumen'; go('progreso'); }],
  ['Fuerza y récords', 'fuerza record 1rm progreso', () => { ui.progTab = 'fuerza'; go('progreso'); }],
  ['Logros, desafíos y fotos', 'logros medallas desafios fotos', () => { ui.progTab = 'logros'; go('progreso'); }],
  ['Coach con IA', 'coach ia chat preguntar', () => go('coach')],
  ['Ayuno intermitente', 'ayuno', () => go('perfil')],
  ['Sincronización y respaldos', 'sincronizar respaldo copia nube google cuenta', () => go('perfil')],
  ['Perfil, metas y apariencia', 'perfil datos meta tema color oscuro', () => go('perfil')],
];
function openGlobalSearch() {
  openModal(`<h2>🔎 Buscar</h2>
    <input id="gsQ" type="search" placeholder="Comida, receta, ejercicio o sección…" autocomplete="off">
    <div id="gsOut" class="gs-out"><p class="muted small">Ej: "pollo", "avena", "sentadilla", "peso", "ayuno", "compras".</p></div>`, m => {
    const out = m.querySelector('#gsOut'), inp = m.querySelector('#gsQ');
    loadExercises().catch(() => {});
    const sec = (t, rows) => rows.length ? `<h3 class="gs-h">${t}</h3><div class="list">${rows.join('')}</div>` : '';
    const row = (attr, ico, name, sub) => `<button class="item tappable gs-row" ${attr}><span class="fi sm">${ico}</span><div class="info"><div class="name">${esc(name)}</div>${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}</div><span class="muted">›</span></button>`;
    const run = () => {
      const q = norm(inp.value.trim());
      if (q.length < 2) return;
      const words = q.split(/\s+/), has = t => words.every(w => norm(t).includes(w));
      const places = PLACES.filter(p => has(p[0] + ' ' + p[1])).slice(0, 5);
      const foods = allFoods().filter(f => has(f.name)).slice(0, 6);
      const recs = allRecipes().filter(r => has(r.name)).slice(0, 5);
      const exs = exReady() ? exDB().filter(e => exSearch(e, q)).slice(0, 6) : [];
      out.innerHTML = sec('Secciones', places.map((p, i) => row(`data-gs-place="${PLACES.indexOf(p)}"`, '📍', p[0], ''))) + sec('Alimentos', foods.map(f => row(`data-gs-food="${f.id}"`, foodIcon(f), f.name, `${r0(f.kcal)} kcal por 100 g`)))
        + sec('Recetas', recs.map(r => row(`data-gs-rec="${r.id}"`, recipeIcon(r), r.name, `${r0(recipeNutrition(r).kcal)} kcal`))) + sec('Ejercicios', exs.map(e => row(`data-gs-ex="${e.id}"`, '🏋️', e.n, e.m.slice(0, 2).join(', '))))
        || '<p class="muted">No encontré nada con eso. Prueba con otra palabra.</p>';
      out.querySelectorAll('[data-gs-place]').forEach(b => b.addEventListener('click', () => { closeModal(); PLACES[b.dataset.gsPlace][2](); }));
      out.querySelectorAll('[data-gs-food]').forEach(b => b.addEventListener('click', () => { closeModal(); ui.selFood = b.dataset.gsFood; ui.comTab = 'registrar'; currentDate = todayKey(); go('comidas'); }));
      out.querySelectorAll('[data-gs-rec]').forEach(b => b.addEventListener('click', () => { closeModal(); openRecipe(b.dataset.gsRec); }));
      out.querySelectorAll('[data-gs-ex]').forEach(b => b.addEventListener('click', () => { closeModal(); openExercise(b.dataset.gsEx); }));
    };
    inp.addEventListener('input', run);
    setTimeout(() => inp.focus(), 50);
  });
}

// ---------- Entrenamiento en curso: barra sobre la navegación para volver con un toque ----------
const wbar = document.createElement('button');
wbar.className = 'wbar'; wbar.id = 'wbar'; wbar.hidden = true;
document.body.appendChild(wbar);
function liveWorkout() {
  const s = typeof activeSession === 'function' && state.profile ? activeSession() : null;
  if (s) { const dd = s.day || (state.routine && state.routine.days[s.dayIdx]); if (dd) return { name: dd.name, start: s.start, open: () => startWorkout(s.dayIdx, s.day) }; }
  const g = typeof gymDraft === 'function' ? gymDraft() : null;
  if (g && !g.wid && g.items && g.items.length && g.t0 && g.date === todayKey() && Date.now() - g.t0 < 4 * 3600000) return { name: `Gym · ${g.items.length} ${g.items.length === 1 ? 'ejercicio' : 'ejercicios'}`, start: g.t0, open: () => openGymLog() };
  return null;
}
function paintWorkoutBar() {
  const w = liveWorkout();
  const show = !!w && !$('.modal-back');
  wbar.hidden = !show;
  document.body.classList.toggle('has-wbar', show);
  if (!show) return;
  const t = Math.max(0, Math.floor((Date.now() - w.start) / 1000));
  wbar.innerHTML = `<span class="wb-dot"></span><span class="wb-txt"><b>Entrenamiento en curso</b> · ${esc(w.name)}</span><span class="wb-t">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</span><span class="wb-go">Volver ›</span>`;
  wbar.onclick = w.open;
}
setInterval(paintWorkoutBar, 1000);

// ---------- Gestos ----------
// Deslizar a la izquierda un registro (comida, actividad, peso) lo borra, con "Deshacer" como siempre
(function swipeDelete() {
  let el = null, x0 = 0, y0 = 0, dx = 0, horiz = null;
  const DEL = '[data-del-food], [data-del-ex], [data-del-w]';
  document.addEventListener('touchstart', e => {
    const it = e.target.closest('.item');
    if (!it || !it.querySelector(DEL) || e.target.closest('input, button:not(.item)')) { el = null; return; }
    el = it; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; horiz = null;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!el) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) horiz = Math.abs(mx) > Math.abs(my) * 1.5;
    if (!horiz) return;
    dx = Math.min(0, mx);
    el.style.transform = `translateX(${dx}px)`;
    el.classList.toggle('swipe-del', dx < -90);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!el) return;
    const it = el; el = null;
    it.style.transform = ''; it.classList.remove('swipe-del');
    if (horiz && dx < -90) { tap(); it.querySelector(DEL).click(); }
  });
})();
// Deslizar hacia abajo una ventana (desde arriba) la cierra
(function swipeClose() {
  let md = null, y0 = 0, dy = 0;
  document.addEventListener('touchstart', e => {
    const m = e.target.closest('.modal');
    if (!m || m.scrollTop > 0 || e.target.closest('input, textarea, select, .scroll-x, .chips, video, .scan-box')) { md = null; return; }
    md = m; y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!md) return;
    dy = e.touches[0].clientY - y0;
    if (md.scrollTop > 0 || dy < 0) { md.style.transform = ''; return; }
    md.style.transform = `translateY(${dy * 0.85}px)`;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!md) return;
    const m = md; md = null;
    if (dy > 120) closeModal(); else { m.style.transition = 'transform .2s'; m.style.transform = ''; setTimeout(() => { m.style.transition = ''; }, 220); }
  });
})();

// ---------- Primer uso: un consejo corto la primera vez que entras a cada sección ----------
const TIPS_KEY = 'fitplan-tips';
const FIRST_TIPS = {
  hoy: 'Aquí ves tu día: lo que te queda, tus comidas y tus macros. Toca ＋ (abajo a la derecha) para registrar comida, agua, peso o gym.',
  comidas: 'Registra con foto, escribiendo o buscando. Arriba están Recetas, Plan semanal y Lista de compras.',
  rutinas: 'Empieza un entrenamiento, repite el último o sigue tu rutina. En Actividad anotas cardio; en Ejercicios ves cómo se hace cada uno.',
  coach: 'Pregúntale lo que quieras: qué hiciste bien, qué cenar o por qué no bajas. Conoce tus registros.',
  progreso: 'Tu peso, déficit, fuerza y logros. Cambia de sección con las pestañas de arriba.',
  perfil: 'Tus datos y metas, la apariencia, la sincronización entre teléfono y PC, y los respaldos.',
};
function firstTip(v) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(TIPS_KEY)) || []; } catch (e) { /* ignorar */ }
  if (!FIRST_TIPS[v] || seen.includes(v) || !state.profile) return;
  const main = $('#main'), head = main.querySelector('.page-head, .hello');
  const tip = document.createElement('div');
  tip.className = 'first-tip';
  tip.innerHTML = `<span>👋</span><p>${esc(FIRST_TIPS[v])}</p><button class="btn sm" data-first-ok>Entendido</button>`;
  head ? head.after(tip) : main.prepend(tip);
  tip.querySelector('[data-first-ok]').addEventListener('click', () => {
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...seen, v])); } catch (e) { /* ignorar */ }
    tip.remove();
  });
}
