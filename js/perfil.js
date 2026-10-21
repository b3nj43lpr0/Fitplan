// FitPlan · Perfil, apariencia, sincronización y respaldo
'use strict';

// ---------- Vista: Perfil ----------
function viewPerfil() {
  const p = state.profile || { nombre: '', sexo: 'h', edad: 25, peso: 70, altura: 170, actividad: 1.375, objetivo: 'mantener', dieta: 'equilibrada' };
  const tg = state.profile ? calcTargets() : null;
  return `
    <h1>${state.profile ? 'Perfil y ajustes' : 'Bienvenido 👋'}</h1>
    <p class="sub">${state.profile ? 'Tus datos, tu meta, la apariencia y la sincronización.' : 'Completa tus datos para calcular cuántas calorías necesitas al día.'}</p>
    <div class="grid g2">
      <div class="card">
        <div class="field"><label for="pNombre">Nombre</label><input id="pNombre" value="${esc(p.nombre || '')}" placeholder="Opcional"></div>
        <div class="grid g2 keep" style="gap:10px">
          <div class="field"><label for="pSexo">Sexo</label><select id="pSexo"><option value="h" ${p.sexo === 'h' ? 'selected' : ''}>Hombre</option><option value="m" ${p.sexo === 'm' ? 'selected' : ''}>Mujer</option></select></div>
          <div class="field"><label for="pEdad">Edad</label><input id="pEdad" type="number" min="12" max="100" value="${p.edad}"></div>
          <div class="field"><label for="pPeso">Peso (kg)</label><input id="pPeso" type="number" min="30" max="300" step="0.1" value="${state.profile ? r1(currentWeight()) : p.peso}"></div>
          <div class="field"><label for="pAltura">Altura (cm)</label><input id="pAltura" type="number" min="120" max="230" value="${p.altura}"></div>
        </div>
        <div class="field"><label for="pAct">Nivel de actividad</label><select id="pAct">${ACTIVITY_LEVELS.map(a => `<option value="${a.v}" ${a.v === Number(p.actividad) ? 'selected' : ''}>${a.label}</option>`).join('')}</select></div>
        <div class="grid g2 keep" style="gap:10px">
          <div class="field"><label for="pObj">Objetivo</label><select id="pObj">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${k === p.objetivo ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
          <div class="field"><label for="pRitmo">Ritmo para perder</label><select id="pRitmo">${Object.entries(RITMOS).map(([k, x]) => `<option value="${k}" ${k === (p.ritmo || 'moderado') ? 'selected' : ''}>${x.label} (${x.adj} kcal)</option>`).join('')}</select></div>
          <div class="field"><label for="pMeta">Peso meta (kg)</label><input id="pMeta" type="number" min="30" max="300" step="0.5" inputmode="decimal" value="${p.meta || ''}" placeholder="Opcional"></div>
          <div class="field"><label for="pDieta">Tipo de dieta</label><select id="pDieta">${Object.entries(DIETS).map(([k, d]) => `<option value="${k}" ${k === (p.dieta || 'equilibrada') ? 'selected' : ''}>${d.label}</option>`).join('')}</select></div>
        </div>
        <button class="btn" id="saveProfile" style="width:100%">${state.profile ? 'Guardar cambios' : 'Calcular y empezar'}</button>
      </div>
      <div>
        ${tg ? `
        <div class="card">
          <h2>Tus números</h2>
          <div class="grid g2 keep" style="gap:10px">
            <div class="stat"><div class="label">Metabolismo basal</div><span class="tile-ico" aria-hidden="true">🫀</span><div class="value">${r0(tg.bmr)} <span class="unit">kcal</span></div></div>
            <div class="stat"><div class="label">Gasto diario (TDEE)</div><span class="tile-ico" aria-hidden="true">⚡</span><div class="value">${r0(tg.tdee)} <span class="unit">kcal</span></div></div>
            <div class="stat accent"><div class="label">Objetivo diario</div><span class="tile-ico" aria-hidden="true">🎯</span><div class="value">${r0(tg.kcal)} <span class="unit">kcal</span></div></div>
            <div class="stat"><div class="label">IMC</div><span class="tile-ico" aria-hidden="true">🧮</span><div class="value">${r1(tg.imc)} <span class="unit">${imcLabel(tg.imc)}</span></div></div>
          </div>
          <div class="macro-pills" style="margin-top:14px"><span style="color:var(--prot)">Proteína <b>${r0(tg.prot)} g</b></span><span style="color:var(--carb)">Carbos <b>${r0(tg.carb)} g</b></span><span style="color:var(--fat)">Grasas <b>${r0(tg.fat)} g</b></span><span style="color:var(--prot)">Agua <b>${r1(tg.water * 0.25)} L</b></span></div>
          <p class="muted small">Cálculo con la fórmula Mifflin-St Jeor. Es una estimación: activa el ajuste automático en Progreso para que se corrija con tu peso real.</p>
        </div>` : ''}
        <div class="card">
          <h2>Respaldo</h2>
          <p class="muted small" style="margin-top:-6px">Descarga una copia de respaldo de todos tus datos o restaura una copia anterior.</p>
          <div class="btn-row">
            <button class="btn ghost sm" id="exportBtn">⬇ Exportar</button>
            <label class="btn ghost sm" style="margin:0;color:var(--text)">⬆ Importar<input type="file" id="importFile" accept="application/json" hidden></label>
            ${state.profile ? '<button class="btn ghost sm" id="resetBtn" style="color:var(--danger)">Borrar todo</button>' : ''}
          </div>
        </div>
        <div class="card">
          <h2>Apariencia</h2>
          <div class="field"><label>Tema</label><div class="chips">${[['auto', '🌗 Automático'], ['light', '☀️ Claro'], ['dark', '🌙 Oscuro']].map(([k, l]) => `<button class="chip ${themePrefs().mode === k ? 'active' : ''}" data-theme-mode="${k}">${l}</button>`).join('')}</div></div>
          <div class="field"><label>Color principal</label><div class="swatches">${Object.entries(ACCENTS).map(([k, c]) => `<button class="swatch ${themePrefs().accent === k ? 'on' : ''}" data-accent="${k}" style="background:${c[0]}" aria-label="${k}" title="${k}"></button>`).join('')}</div></div>
        </div>
        <div class="card">
          <h2>⏱️ Ayuno intermitente</h2>
          <label class="check" style="border:0;padding:0"><input type="checkbox" id="fastOn" ${state.fasting && state.fasting.on ? 'checked' : ''}><span>Mostrar el contador de ayuno en Hoy</span></label>
          <div class="field" style="margin-top:8px"><label for="fastPlan">Horas de ayuno</label><select id="fastPlan">${FAST_PLANS.map(h => `<option value="${h}" ${h === (state.fasting ? state.fasting.plan : 16) ? 'selected' : ''}>${h}:${24 - h} (${h} h de ayuno, ${24 - h} h para comer)</option>`).join('')}</select></div>
          <p class="muted small">El ayuno no reemplaza el déficit: lo que cuenta es el total del día. A algunas personas les ayuda a ordenar los horarios.</p>
        </div>
        <div class="card" id="syncCard"></div>
        <div class="card">
          <h2>Créditos</h2>
          <ul class="small credits">
            <li>Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener">RepDB (repdb.co)</a></li>
            <li>Alimentos: <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> (SR Legacy, dominio público)</li>
            <li>Productos escaneados: <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts</a> (ODbL)</li>
            <li>Lector de códigos: ZXing (MIT)</li>
          </ul>
        </div>
      </div>
    </div>`;
}
function syncCardHtml() {
  const S = window.FitSync && window.FitSync.state;
  if (!S || !S.enabled) return `<h2>Sincronización</h2><p class="muted small" style="margin-top:-6px">Aún no está configurada. Mientras tanto, usa Exportar e Importar para pasar tus datos entre dispositivos.</p>`;
  return `<h2>Sincronización</h2>
    <p class="muted small" style="margin-top:-6px">${S.user ? `Sesión: <b>${esc(S.user.email || S.user.name || '')}</b>. Tus datos se comparten entre todos tus dispositivos.` : 'Inicia sesión con Google para tener tus datos igual en el PC y en el teléfono.'}</p>
    <p class="small" id="syncStatus">${esc(S.status)}</p>
    <div class="btn-row">${S.user ? '<button class="btn ghost sm" id="syncOut">Cerrar sesión</button>' : '<button class="btn sm" id="syncIn">Iniciar sesión con Google</button>'}</div>`;
}
let offSync = null;
bind.perfil = () => {
  const fo = $('#fastOn'), fp = $('#fastPlan');
  const setFast = () => { state.fasting = { log: [], start: null, ...(state.fasting || {}), on: fo.checked, plan: Number(fp.value) }; save(); toast(fo.checked ? '⏱️ Ayuno activado: lo verás en Hoy' : 'Ayuno desactivado'); };
  if (fo) { fo.addEventListener('change', setFast); fp.addEventListener('change', setFast); }
  const setTheme = patch => { try { localStorage.setItem(THEME_KEY, JSON.stringify({ ...themePrefs(), ...patch })); } catch (e) { /* ignorar */ } applyTheme(); render(); };
  $$('[data-theme-mode]').forEach(b => b.addEventListener('click', () => setTheme({ mode: b.dataset.themeMode })));
  $$('[data-accent]').forEach(b => b.addEventListener('click', () => setTheme({ accent: b.dataset.accent })));
  const card = $('#syncCard');
  const paint = () => {
    if (!card.isConnected) { if (offSync) offSync(); return; }
    card.innerHTML = syncCardHtml();
    const i = $('#syncIn'), o = $('#syncOut');
    if (i) i.addEventListener('click', () => window.FitSync.signIn());
    if (o) o.addEventListener('click', () => window.FitSync.signOut());
  };
  paint();
  if (offSync) offSync();
  if (window.FitSync) offSync = window.FitSync.onChange(paint);
  $('#saveProfile').addEventListener('click', () => {
    const p = {
      ...(state.profile || {}),
      nombre: $('#pNombre').value.trim(), sexo: $('#pSexo').value, edad: Number($('#pEdad').value),
      peso: Number($('#pPeso').value), altura: Number($('#pAltura').value), actividad: Number($('#pAct').value),
      objetivo: $('#pObj').value, dieta: $('#pDieta').value, ritmo: $('#pRitmo').value,
      meta: Number($('#pMeta').value) || null,
    };
    if (!(p.edad >= 12 && p.peso >= 30 && p.altura >= 120)) return toast('Revisa edad, peso y altura');
    const first = !state.profile;
    // Si cambió el peso, queda registrado como pesaje de hoy
    if (first || Math.abs(p.peso - currentWeight()) >= 0.05) {
      state.weights = state.weights.filter(w => w.d !== todayKey());
      state.weights.push({ d: todayKey(), kg: r1(p.peso) });
    }
    state.profile = p; save();
    toast(first ? `¡Listo! Tu objetivo es ${r0(calcTargets().kcal)} kcal/día` : 'Perfil actualizado');
    first ? go('hoy') : render();
  });
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitplan-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(txt => {
      const s = JSON.parse(txt);
      if (!s || typeof s !== 'object' || !('days' in s)) throw new Error('formato');
      state = { ...EMPTY(), ...s };
      save(); toast('Datos importados'); go(state.profile ? 'hoy' : 'perfil');
    }).catch(() => toast('Ese archivo no es válido'));
  });
  const reset = $('#resetBtn');
  if (reset) reset.addEventListener('click', () => {
    if (!confirm('¿Borrar todos tus datos? Si tienes la sincronización activa, también se borrarán en tus otros dispositivos.')) return;
    state = EMPTY();
    save(); render();
  });
};
