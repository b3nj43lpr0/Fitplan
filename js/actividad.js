// FitPlan · Registro de actividad (pestaña Actividad de Entrenar)
'use strict';

// ---------- Vista: Ejercicio ----------
function viewEjercicio() {
  const d = peekDay(currentDate);
  const t = totals(d);
  return `
    ${dateBar()}
    <div class="grid g2">
      <div class="card">
        <h2>Agregar actividad</h2>
        <input type="hidden" id="act" value="${ACTIVITIES[0].id}">
        <div class="act-grid" role="radiogroup" aria-label="Actividad">${ACTIVITIES.map((a, i) => `<button class="act ${i === 0 ? 'sel' : ''}" data-act="${a.id}" role="radio" aria-checked="${i === 0}"><span class="ae">${ACT_ICO[a.id] || '🏅'}</span>${esc(a.name)}</button>`).join('')}</div>
        <label for="mins">Duración (minutos)</label>
        <div class="chips">${[15, 30, 45, 60, 90].map(m => `<button class="chip ${m === 30 ? 'active' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>
        <div class="field"><input id="mins" type="number" min="1" value="30" inputmode="numeric" aria-label="Minutos"></div>
        <div class="result-box" id="burnPrev"></div>
        <button class="btn burn" id="addEx" style="width:100%">Registrar</button>
        <hr class="sep">
        <h3>¿Tu reloj ya te dio las calorías?</h3>
        <div class="grid g2" style="gap:8px">
          <div class="field"><label for="mxName">Actividad</label><input id="mxName" placeholder="Ej: Clase de spinning"></div>
          <div class="field"><label for="mxKcal">kcal quemadas</label><input id="mxKcal" type="number" min="0"></div>
        </div>
        <button class="btn ghost" id="mxAdd">Agregar</button>
      </div>
      <div class="card">
        <div class="row"><h2>Actividad del día</h2><b style="color:var(--burn)">${r0(t.burned)} kcal</b></div>
        <div class="list">${d.exercises.length ? d.exercises.map(e => `
          <div class="item">
            <div class="info"><div class="name">${esc(e.name)}</div><div class="muted small">${e.minutes ? e.minutes + ' min' : 'manual'}</div></div>
            <span class="kcal" style="color:var(--burn)">−${r0(e.kcal)}</span>
            <button class="icon-btn" data-del-ex="${e.id}" aria-label="Eliminar">✕</button>
          </div>`).join('') : '<div class="empty">Nada registrado todavía.</div>'}</div>
        <p class="muted small">Las calorías del ejercicio se suman a tu presupuesto del día: si quemas 300 kcal, puedes comer 300 kcal más y mantener tu objetivo. Calculado con tu peso (${r1(currentWeight())} kg).</p>
      </div>
    </div>`;
}
bind.ejercicio = () => {
  bindDateBar();
  const upd = () => {
    const a = ACTIVITIES.find(x => x.id === $('#act').value);
    const m = Number($('#mins').value) || 0;
    $('#burnPrev').innerHTML = `<b style="font-size:22px;color:var(--burn)">🔥 ${r0(burnedKcal(a.met, m))} kcal</b> <span class="muted small">${esc(a.name)} · ${m} min</span>`;
  };
  $$('[data-act]').forEach(b => b.addEventListener('click', () => {
    $('#act').value = b.dataset.act;
    $$('[data-act]').forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', x === b); });
    upd();
  }));
  $$('[data-min]').forEach(b => b.addEventListener('click', () => {
    $('#mins').value = b.dataset.min;
    $$('[data-min]').forEach(x => x.classList.toggle('active', x === b));
    upd();
  }));
  $('#mins').addEventListener('input', () => { $$('[data-min]').forEach(x => x.classList.toggle('active', x.dataset.min === $('#mins').value)); upd(); });
  upd();
  $('#addEx').addEventListener('click', () => {
    const a = ACTIVITIES.find(x => x.id === $('#act').value);
    const m = Number($('#mins').value);
    if (!(m > 0)) return toast('Ingresa los minutos');
    day().exercises.push({ id: uid(), name: a.name, minutes: m, kcal: burnedKcal(a.met, m) });
    save(); toast('Ejercicio registrado 💪'); render();
  });
  $('#mxAdd').addEventListener('click', () => {
    const k = Number($('#mxKcal').value);
    if (!(k > 0)) return toast('Ingresa las calorías');
    day().exercises.push({ id: uid(), name: $('#mxName').value.trim() || 'Actividad', minutes: 0, kcal: k });
    save(); toast('Ejercicio registrado 💪'); render();
  });
  $$('[data-del-ex]').forEach(b => b.addEventListener('click', () => {
    const d = day(); d.exercises = d.exercises.filter(e => e.id !== b.dataset.delEx); save(); render();
  }));
};
