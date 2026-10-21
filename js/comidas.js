// FitPlan · Vista Comidas y escáner de códigos de barras
'use strict';

// ---------- Vista: Comidas ----------
const FAV = '⭐ Favoritas', RECENT = '🕒 Recientes';
function isFav(id) { return state.favFoods.includes(id); }
// Alimentos registrados últimamente, del más reciente al más antiguo
function recentFoodIds(max = 40) {
  const ids = [];
  for (const k of Object.keys(state.days).sort().reverse()) {
    const fs = state.days[k].foods;
    for (let i = fs.length - 1; i >= 0; i--) {
      const id = fs[i].foodId;
      if (id && !ids.includes(id) && foodById(id)) ids.push(id);
      if (ids.length >= max) return ids;
    }
  }
  return ids;
}
function addFoodToDay(food, grams, meal) {
  const n = nutrition(food, grams);
  day().foods.push({ id: uid(), foodId: food.id, name: food.name, grams, meal, ...n });
  save();
  return n;
}
function foodListHtml() {
  const q = norm(ui.foodQuery.trim());
  const base = ui.foodCat === FAV ? state.favFoods.map(foodById).filter(Boolean)
    : ui.foodCat === RECENT ? recentFoodIds().map(foodById)
      : allFoods().filter(f => ui.foodCat === 'Todas' || f.cat === ui.foodCat);
  const list = base.filter(f => !q || norm(f.name).includes(q));
  const lim = ui.foodLimit || 40;
  const shown = list.slice(0, lim);
  const mealName = MEALS.find(m => m.id === ui.meal).name.toLowerCase();
  return (shown.length ? shown.map(f => `
    <div class="item food-row" data-food="${f.id}" role="button" tabindex="0">
      <div class="info"><div class="name">${isFav(f.id) ? '<span class="star-on">★</span> ' : ''}${esc(f.name)}</div><div class="muted small">${f.por ? `porción ${f.por} g · ${r0(f.kcal * f.por / 100)} kcal` : `${r0(f.kcal)} kcal por 100 g`}</div></div>
      <button class="quick-add" data-quick="${f.id}" aria-label="Agregar ${f.por || 100} g a ${mealName}" title="Agregar ${f.por || 100} g a ${mealName}">＋</button>
    </div>`).join('') : `<div class="empty">${ui.foodCat === FAV ? 'Aún no tienes favoritas. Abre un alimento y toca ☆ para guardarlo aquí.' : ui.foodCat === RECENT ? 'Aquí aparecerá lo que registres.' : 'No encontré ese alimento. Escanéalo o créalo con los botones de arriba.'}</div>`)
    + (list.length > shown.length ? `<button class="btn ghost" id="moreFoods" style="width:100%;margin-top:10px">Ver más (${list.length - shown.length})</button>` : '');
}
function viewComidas() {
  const cats = ['Todas', FAV, RECENT, ...new Set(allFoods().map(f => f.cat))];
  const tg = calcTargets();
  const t = totals(peekDay(currentDate));
  const left = tg.kcal + t.burned - t.kcal;
  return `
    ${pageHead('Comidas')}
    ${dateBar()}
    <div class="left-bar"><span>${left >= 0 ? `Te quedan <b>${r0(left)} kcal</b>` : `Te pasaste <b>${r0(-left)} kcal</b>`}</span><span class="muted small">P ${r0(t.p)}/${r0(tg.prot)} g</span></div>
    <div class="meal-pick" role="radiogroup" aria-label="Agregar a">${MEALS.map(m => `<button class="${m.id === ui.meal ? 'on' : ''}" data-pick-meal="${m.id}" role="radio" aria-checked="${m.id === ui.meal}"><span>${MEAL_ICO[m.id]}</span>${m.name}</button>`).join('')}</div>
    <div class="card">
      <div class="search-row">
        <input id="foodSearch" type="search" placeholder="Buscar alimento…" value="${esc(ui.foodQuery)}" autocomplete="off">
        <button class="round-btn" id="scanBtn" title="Escanear código de barras" aria-label="Escanear código de barras">📷</button>
      </div>
      <div class="chips scroll-x">${cats.map(c => `<button class="chip ${c === ui.foodCat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="list" id="foodList">${foodListHtml()}</div>
    </div>
    <div class="btn-row two">
      <button class="btn ghost" id="quickLog">⚡ Solo sé las calorías</button>
      <button class="btn ghost" id="newFood">＋ Crear alimento</button>
    </div>`;
}
// Hoja para elegir cantidad y comida de un alimento
function openFoodSheet(id) {
  const sel = foodById(id);
  if (!sel) return;
  openModal(`
    <div class="sheet-title"><h2>${esc(sel.name)}</h2><button class="icon-btn star ${isFav(sel.id) ? 'on' : ''}" id="favBtn" aria-pressed="${isFav(sel.id)}" aria-label="Favorita">${isFav(sel.id) ? '★' : '☆'}</button></div>
    <p class="muted small" style="margin:4px 0 12px">${sel.brand ? esc(sel.brand) + ' · ' : ''}${r0(sel.kcal)} kcal por 100 g · ${esc(sel.cat)}</p>
    <div class="chips">
      ${sel.por ? `<button class="chip active" data-grams="${sel.por}">1 porción (${sel.por} g)</button><button class="chip" data-grams="${sel.por / 2}">½</button><button class="chip" data-grams="${sel.por * 2}">2 porciones</button>` : ''}
      <button class="chip ${sel.por ? '' : 'active'}" data-grams="100">100 g</button>
    </div>
    <div class="qty">
      <button class="round-btn" data-step="-1" aria-label="Menos">−</button>
      <div class="field" style="margin:0;flex:1"><input id="grams" type="number" min="1" value="${sel.por || 100}" inputmode="decimal" aria-label="Cantidad en gramos"><span class="unit-in">g</span></div>
      <button class="round-btn" data-step="1" aria-label="Más">＋</button>
    </div>
    <div class="result-box" id="preview"></div>
    <div class="meal-pick small-pick">${MEALS.map(m => `<button class="${m.id === ui.meal ? 'on' : ''}" data-sheet-meal="${m.id}">${MEAL_ICO[m.id]} ${m.name}</button>`).join('')}</div>
    <button class="btn" id="addFood" style="width:100%">Agregar</button>`, m => {
    const q = x => m.querySelector(x);
    let meal = ui.meal;
    const upd = () => {
      const g = Number(q('#grams').value) || 0;
      const n = nutrition(sel, g);
      q('#preview').innerHTML = `<div class="row"><b style="font-size:24px">${r0(n.kcal)} kcal</b><span class="muted small">${r0(g)} g</span></div>
        <div class="macro-pills" style="margin:6px 0 0"><span style="color:var(--prot)">P <b>${r1(n.p)} g</b></span><span style="color:var(--carb)">C <b>${r1(n.c)} g</b></span><span style="color:var(--fat)">G <b>${r1(n.g)} g</b></span></div>`;
      m.querySelectorAll('[data-grams]').forEach(b => b.classList.toggle('active', Number(b.dataset.grams) === g));
    };
    q('#grams').addEventListener('input', upd);
    m.querySelectorAll('[data-grams]').forEach(b => b.addEventListener('click', () => { q('#grams').value = b.dataset.grams; upd(); }));
    m.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
      const step = sel.por && sel.por < 60 ? sel.por : 10;
      q('#grams').value = Math.max(1, (Number(q('#grams').value) || 0) + step * Number(b.dataset.step)); upd(); tap();
    }));
    m.querySelectorAll('[data-sheet-meal]').forEach(b => b.addEventListener('click', () => {
      meal = b.dataset.sheetMeal;
      m.querySelectorAll('[data-sheet-meal]').forEach(x => x.classList.toggle('on', x === b));
    }));
    q('#favBtn').addEventListener('click', () => {
      state.favFoods = isFav(sel.id) ? state.favFoods.filter(x => x !== sel.id) : [...state.favFoods, sel.id];
      save();
      const b = q('#favBtn'); b.textContent = isFav(sel.id) ? '★' : '☆'; b.classList.toggle('on', isFav(sel.id));
      toast(isFav(sel.id) ? 'Agregado a favoritas ⭐' : 'Quitado de favoritas');
    });
    upd();
    q('#addFood').addEventListener('click', () => {
      const g = Number(q('#grams').value);
      if (!(g > 0)) return toast('Ingresa una cantidad válida');
      ui.meal = meal;
      const n = addFoodToDay(sel, g, meal);
      closeModal(); render(); tap();
      toast(`✓ ${sel.name} · ${r0(n.kcal)} kcal`);
    });
  });
}
bind.comidas = () => {
  bindDateBar();
  const bindList = () => {
    $$('[data-quick]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const f = foodById(b.dataset.quick);
      const n = addFoodToDay(f, f.por || 100, ui.meal);
      toast(`✓ ${f.name} · ${r0(n.kcal)} kcal en ${MEALS.find(m => m.id === ui.meal).name.toLowerCase()}`);
      b.classList.add('pop'); tap(); setTimeout(() => b.classList.remove('pop'), 400);
      const t = totals(peekDay(currentDate)), tg = calcTargets(), left = tg.kcal + t.burned - t.kcal;
      $('.left-bar').innerHTML = `<span>${left >= 0 ? `Te quedan <b>${r0(left)} kcal</b>` : `Te pasaste <b>${r0(-left)} kcal</b>`}</span><span class="muted small">P ${r0(t.p)}/${r0(tg.prot)} g</span>`;
    }));
    $$('[data-food]').forEach(r => {
      r.addEventListener('click', () => openFoodSheet(r.dataset.food));
      r.addEventListener('keydown', ev => { if (ev.key === 'Enter') openFoodSheet(r.dataset.food); });
    });
    const more = $('#moreFoods');
    if (more) more.addEventListener('click', () => { ui.foodLimit = (ui.foodLimit || 40) + 60; refresh(); });
  };
  // Al buscar solo se redibuja la lista, así el teclado no se cierra
  const refresh = () => { $('#foodList').innerHTML = foodListHtml(); bindList(); };
  bindList();
  $('#foodSearch').addEventListener('input', e => { ui.foodQuery = e.target.value; ui.foodLimit = 40; refresh(); });
  $('#scanBtn').addEventListener('click', openScanner);
  $$('[data-cat]').forEach(b => b.addEventListener('click', () => {
    ui.foodCat = b.dataset.cat; ui.foodLimit = 40;
    $$('[data-cat]').forEach(x => x.classList.toggle('active', x === b));
    refresh();
  }));
  $$('[data-pick-meal]').forEach(b => b.addEventListener('click', () => {
    ui.meal = b.dataset.pickMeal;
    $$('[data-pick-meal]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    refresh(); tap();
  }));
  $('#newFood').addEventListener('click', () => openModal(`
    <h2>Crear alimento</h2>
    <p class="muted small" style="margin-top:-6px">Copia los datos de la etiqueta nutricional (por 100 g).</p>
    <div class="field"><label for="cfName">Nombre</label><input id="cfName" placeholder="Ej: Barra de cereal X"></div>
    <div class="grid g4 keep" style="gap:8px">
      <div class="field"><label for="cfKcal">kcal</label><input id="cfKcal" type="number" min="0" inputmode="decimal"></div>
      <div class="field"><label for="cfP">Prot.</label><input id="cfP" type="number" min="0" inputmode="decimal"></div>
      <div class="field"><label for="cfC">Carb.</label><input id="cfC" type="number" min="0" inputmode="decimal"></div>
      <div class="field"><label for="cfG">Grasa</label><input id="cfG" type="number" min="0" inputmode="decimal"></div>
    </div>
    <div class="field"><label for="cfPor">Porción típica (g, opcional)</label><input id="cfPor" type="number" min="1" inputmode="decimal"></div>
    <button class="btn" id="cfSave" style="width:100%">Guardar alimento</button>`, m => {
    m.querySelector('#cfSave').addEventListener('click', () => {
      const v = x => m.querySelector(x).value;
      const name = v('#cfName').trim(), kcal = Number(v('#cfKcal'));
      if (!name || v('#cfKcal') === '' || !(kcal >= 0)) return toast('Completa al menos nombre y kcal');
      const f = { id: 'c_' + uid(), name, cat: 'Mis alimentos', kcal, p: Number(v('#cfP')) || 0, c: Number(v('#cfC')) || 0, g: Number(v('#cfG')) || 0 };
      if (Number(v('#cfPor')) > 0) f.por = Number(v('#cfPor'));
      state.customFoods.push(f); save(); closeModal(); render(); toast('Alimento guardado');
      openFoodSheet(f.id);
    });
  }));
  $('#quickLog').addEventListener('click', () => openModal(`
    <h2>Registro rápido</h2>
    <p class="muted small" style="margin-top:-6px">¿Comiste algo y solo sabes las calorías?</p>
    <div class="field"><label for="qName">Qué comiste</label><input id="qName" placeholder="Ej: Completo"></div>
    <div class="field"><label for="qKcal">kcal</label><input id="qKcal" type="number" min="0" inputmode="decimal"></div>
    <div class="meal-pick small-pick">${MEALS.map(x => `<button class="${x.id === ui.meal ? 'on' : ''}" data-sheet-meal="${x.id}">${MEAL_ICO[x.id]} ${x.name}</button>`).join('')}</div>
    <button class="btn" id="qAdd" style="width:100%">Agregar</button>`, m => {
    let meal = ui.meal;
    m.querySelectorAll('[data-sheet-meal]').forEach(b => b.addEventListener('click', () => { meal = b.dataset.sheetMeal; m.querySelectorAll('[data-sheet-meal]').forEach(x => x.classList.toggle('on', x === b)); }));
    m.querySelector('#qAdd').addEventListener('click', () => {
      const kcal = Number(m.querySelector('#qKcal').value);
      if (!(kcal > 0)) return toast('Ingresa las calorías');
      day().foods.push({ id: uid(), name: m.querySelector('#qName').value.trim() || 'Registro rápido', grams: 0, meal, kcal, p: 0, c: 0, g: 0 });
      save(); closeModal(); render(); toast('Agregado');
    });
  }));
  // Otro flujo (escáner, alimento nuevo) pidió abrir un alimento
  if (ui.selFood) { const id = ui.selFood; ui.selFood = null; openFoodSheet(id); }
};

// ---------- Escáner de código de barras (Open Food Facts) ----------
function openScanner() {
  openModal(`
    <h2>Escanear código de barras</h2>
    <p class="muted small" style="margin-top:-6px">Apunta la cámara al código del envase. Los datos vienen de Open Food Facts (necesita internet).</p>
    <div class="scan-box"><video id="scanVideo" playsinline muted></video><div class="scan-line"></div></div>
    <p class="muted small" id="scanStatus">Iniciando cámara…</p>
    <div class="search-row">
      <input id="scanCode" inputmode="numeric" placeholder="O escribe el número del código">
      <button class="btn" id="scanSearch">Buscar</button>
    </div>
    <div id="scanResult"></div>`, m => {
    let stopped = false, stream = null, reader = null, timer = null;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      if (reader) try { reader.reset(); } catch (e) { /* ignorar */ }
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
    m._cleanup = stop;
    const found = code => { if (stopped) return; stop(); m.querySelector('#scanCode').value = code; lookupBarcode(code, m); };
    m.querySelector('#scanSearch').addEventListener('click', () => {
      const code = m.querySelector('#scanCode').value.replace(/\D/g, '');
      if (code.length < 6) return toast('Escribe un código válido');
      stop(); lookupBarcode(code, m);
    });
    const status = t => { const s = m.querySelector('#scanStatus'); if (s) s.textContent = t; };
    const video = m.querySelector('#scanVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status('Este navegador no permite usar la cámara aquí. Escribe el código a mano.');
      return;
    }
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s; video.srcObject = s; video.play(); status('Buscando código…');
        timer = setInterval(() => {
          if (video.readyState < 2) return;
          det.detect(video).then(r => { if (r.length) found(r[0].rawValue); }).catch(() => {});
        }, 300);
      }).catch(() => status('No pude abrir la cámara. Revisa los permisos o escribe el código.'));
    } else {
      // Sin lector nativo: cargamos ZXing solo ahora (≈330 KB)
      status('Cargando lector…');
      const go = () => {
        if (stopped) return;
        reader = new window.ZXing.BrowserMultiFormatReader();
        status('Buscando código…');
        reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, res => { if (res) found(res.getText()); })
          .catch(() => status('No pude abrir la cámara. Revisa los permisos o escribe el código.'));
      };
      if (window.ZXing) go();
      else {
        const sc = document.createElement('script');
        sc.src = 'vendor/zxing.min.js';
        sc.onload = go;
        sc.onerror = () => status('No pude cargar el lector. Escribe el código a mano.');
        document.head.appendChild(sc);
      }
    }
  });
}
function lookupBarcode(code, m) {
  const box = m.querySelector('#scanResult');
  const existing = state.customFoods.find(f => f.id === 'off_' + code);
  if (existing) { closeModal(); ui.selFood = existing.id; ui.foodQuery = ''; ui.foodCat = 'Todas'; render(); return; }
  box.innerHTML = '<p class="muted">Buscando producto…</p>';
  fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity,image_front_small_url`)
    .then(r => r.json())
    .then(j => {
      const p = j && j.product;
      const n = p && p.nutriments;
      const kcal = n && (n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined));
      if (!p || kcal === undefined) {
        box.innerHTML = `<div class="result-box">No encontré el producto ${esc(code)} en Open Food Facts. Puedes crearlo con los datos de la etiqueta en "Crear alimento propio".</div>`;
        return;
      }
      const f = {
        id: 'off_' + code, name: p.product_name_es || p.product_name || 'Producto ' + code, brand: p.brands || '', cat: 'Escaneados',
        kcal: r0(kcal), p: r1(n.proteins_100g || 0), c: r1(n.carbohydrates_100g || 0), g: r1(n.fat_100g || 0),
      };
      if (p.serving_quantity > 0) f.por = r0(Number(p.serving_quantity));
      box.innerHTML = `<div class="result-box">
        <div class="row">${p.image_front_small_url ? `<img src="${esc(p.image_front_small_url)}" alt="" class="prod-img">` : ''}<div style="flex:1"><b>${esc(f.name)}</b><div class="muted small">${esc(f.brand)}</div></div></div>
        <div class="macro-pills" style="margin:8px 0">Por 100 g: <b>${f.kcal} kcal</b><span>P ${f.p} g</span><span>C ${f.c} g</span><span>G ${f.g} g</span></div>
        <button class="btn" id="offSave" style="width:100%">Usar este producto</button></div>`;
      box.querySelector('#offSave').addEventListener('click', () => {
        state.customFoods.push(f); save();
        closeModal(); ui.selFood = f.id; ui.foodQuery = ''; ui.foodCat = 'Todas'; render();
        toast('Producto guardado en "Escaneados"');
      });
    })
    .catch(() => { box.innerHTML = '<div class="result-box">No pude conectarme a Open Food Facts. Revisa tu conexión a internet.</div>'; });
}
