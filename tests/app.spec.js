// Recorridos principales de la app con datos realistas de 3 semanas (tests/fixture.js)
const { test, expect } = require('@playwright/test');
const fixture = require('./fixture.js');

const state = page => page.evaluate(() => window.__fitplan.get());
const today = page => page.evaluate(() => {
  const s = window.__fitplan.get();
  const z = n => String(n).padStart(2, '0');
  const d = new Date();
  return s.days[`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`];
});

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  // Sin Firebase real: así la sesión simulada de la IA no se pierde cuando Firebase responde (en CI hay internet)
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto('/index.html');
  await page.evaluate(f => localStorage.setItem('fitplan-v1', JSON.stringify(f)), fixture());
  await page.reload();
});
test.afterEach(async ({ page }) => {
  expect(page.errors, 'errores de JavaScript en la página').toEqual([]);
});

test('perfil nuevo: calcula y entra a Hoy', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#pNombre', 'Ana');
  await page.click('#saveProfile');
  await expect(page.locator('.hello .name')).toHaveText('Ana');
});

test('Hoy: repetir, agua, editar y ＋ por comida', async ({ page }) => {
  const n0 = (await today(page)).foods.length;
  await page.click('[data-repeat=cena]');
  expect((await today(page)).foods.length).toBeGreaterThan(n0);
  await page.click('[data-water-step="1"]');
  expect((await today(page)).water).toBe(4);
  const id = await page.getAttribute('[data-edit-food]', 'data-edit-food');
  await page.click(`[data-edit-food="${id}"]`);
  await page.fill('#eGrams', '100');
  await page.click('#eSave');
  expect((await today(page)).foods.find(f => f.id === id).grams).toBe(100);
  await page.click('[data-add-meal=snack]');
  await expect(page.locator('[data-pick-meal=snack]')).toHaveClass(/on/);
});

test('Comidas: agregar rápido, hoja, registro rápido y alimento propio', async ({ page }) => {
  await page.click('[data-view=comidas]');
  await page.click('[data-pick-meal=snack]');
  const n0 = (await today(page)).foods.length;
  await page.click('[data-quick]');
  expect((await today(page)).foods.length).toBe(n0 + 1);
  expect((await today(page)).foods.at(-1).meal).toBe('snack');
  await page.fill('#foodSearch', 'empanada');
  await expect(page.locator('#foodSearch')).toBeFocused();
  expect(await page.locator('#foodList [data-food]').count()).toBeGreaterThan(1);
  await page.click('#foodList [data-food]');
  await page.click('[data-step="1"]');
  await page.click('[data-sheet-meal=almuerzo]');
  await page.click('#addFood');
  expect((await today(page)).foods.at(-1).meal).toBe('almuerzo');
  await page.click('#quickLog');
  await page.fill('#qKcal', '350');
  await page.click('#qAdd');
  expect((await today(page)).foods.at(-1).kcal).toBe(350);
  await page.click('#newFood');
  await page.fill('#cfName', 'Mi barra');
  await page.fill('#cfKcal', '400');
  await page.click('#cfSave');
  await page.click('#addFood');
  expect((await state(page)).customFoods.some(f => f.name === 'Mi barra')).toBe(true);
});

test('Recetas: agregar, detalle, crear receta, plan y compras', async ({ page }) => {
  await page.click('[data-view=comidas]');
  await page.click('[data-tab-com=recetas]');
  const n0 = (await today(page)).foods.length;
  await page.click('.rcard [data-log-recipe]');
  await page.click('[data-open-recipe]');
  await page.click('#rcAdd');
  expect((await today(page)).foods.length).toBe(n0 + 2);
  await page.click('#newRecipe');
  await page.fill('#rcName', 'Prueba');
  await page.fill('#rcSearch', 'arroz');
  await page.click('[data-pick]');
  await page.click('#rcSave');
  expect((await state(page)).customRecipes).toHaveLength(1);
  await page.click('[data-tab-com=plan]');
  await page.click('#genPlan');
  await page.click('[data-tab-com=compras]');
  await expect(page.locator('#shareList')).toBeVisible();
});

test('Entrenar: rutina, entrenamiento completo, actividad y biblioteca', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.click('#genRoutine');
  await page.click('[data-start="0"]');
  // Primero viene el calentamiento (sin descanso); se salta hasta el primer ejercicio de fuerza
  const warm = (await state(page)).routine.days[0].exercises.filter(x => x.warm).length;
  for (let i = 0; i < warm; i++) await page.click('#wNext');
  await page.fill('[data-kg="0"]', '50');
  await page.click('[data-set="0"]');
  await page.click('#rSkip');
  while (await page.locator('#wNext').count()) await page.click('#wNext');
  await page.click('#wFinish');
  await page.click('#okW');
  const s = await state(page);
  expect(s.routine.days[0].done).toBe(true);
  expect(s.workouts.at(-1).ex.find(x => x.sets.some(z => z.kg === 50))).toBeTruthy();
  await page.click('[data-toggle-day="2"]');
  await expect(page.locator('[data-start="2"]')).toBeVisible();
  await page.click('[data-tab-rut=actividad]');
  await page.click('[data-act=trotar]');
  await page.click('#addEx');
  expect((await today(page)).exercises.some(e => /Trotar/.test(e.name))).toBe(true);
  await page.click('[data-tab-rut=biblioteca]');
  await page.fill('#exSearch', 'sentadilla');
  expect(await page.locator('.ex-card').count()).toBeGreaterThan(3);
});

test('Progreso: peso, pestañas y gráfico de fuerza', async ({ page }) => {
  await page.click('[data-view=progreso]');
  await page.click('[data-wstep="-0.1"]');
  await page.click('#addWeight');
  expect((await state(page)).weights.some(w => w.kg === 80.2)).toBe(true);
  await page.click('[data-tab-prog=resumen]');
  await expect(page.locator('.chart.stacked')).toBeVisible();
  await page.click('[data-tab-prog=fuerza]');
  await page.click('[data-strength]');
  await expect(page.locator('.modal svg.wchart')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.click('[data-tab-prog=logros]');
  await expect(page.locator('.badge.on').first()).toBeVisible();
});

test('Perfil, tema y navegación', async ({ page }) => {
  await page.click('.hello [data-go=perfil]');
  await page.click('[data-theme-mode=dark]');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.click('[data-view=hoy]');
  await page.click('[data-go=ejercicio]');
  await expect(page.locator('[data-tab-rut=actividad]')).toHaveClass(/active/);
});

test('carga liviana: no descarga ejercicios ni lector al abrir', async ({ page }) => {
  const urls = [];
  page.on('request', r => urls.push(r.url()));
  await page.reload();
  await page.waitForTimeout(500);
  expect(urls.some(u => /exercises\.js|zxing/.test(u))).toBe(false);
});

test('Entrenar: calentamiento, superseries, progresión y ejercicio propio', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.selectOption('#rNivel', 'intermedio');
  await page.click('#genRoutine');
  const r = (await state(page)).routine;
  expect(r.days.every(d => d.exercises[0].warm)).toBe(true);
  expect(r.days.some(d => d.exercises.some(x => x.ss))).toBe(true);
  // Progresión: todas las series en el tope del rango → sube el peso
  const sg = await page.evaluate(() => {
    state.workouts.push({ id: 'wx', d: todayKey(), name: 'x', minutes: 40, ex: [{ id: 'bench-press', sets: [{ kg: 60, reps: 10 }, { kg: 60, reps: 10 }] }] });
    return [suggestion({ ex: 'bench-press', series: 2, reps: '8-10' }), suggestion({ ex: 'bench-press', series: 2, reps: '8-12' })];
  });
  expect(sg[0]).toMatchObject({ kg: 62.5, reps: 8, up: true });
  expect(sg[1]).toMatchObject({ kg: 60, reps: 11 });
  // Superserie: tras una serie del primero pasa al segundo
  const di = r.days.findIndex(d => d.exercises.some(x => x.ss));
  const first = r.days[di].exercises.findIndex(x => x.ss);
  if (!(await page.locator(`[data-start="${di}"]`).count())) await page.click(`[data-toggle-day="${di}"]`);
  await page.click(`[data-start="${di}"]`);
  for (let i = 0; i < first; i++) await page.click('#wNext');
  await page.click('[data-set="0"]');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fitplan-session')).i)).toBe(first + 1);
  await page.click('#wQuit');
  // Ejercicio propio
  await page.click('[data-tab-rut=biblioteca]');
  await page.click('#newEx');
  await page.fill('#ceName', 'Remo máquina azul');
  await page.click('#ceSave');
  await page.fill('#exSearch', 'azul');
  await expect(page.locator('.ex-card')).toHaveCount(1);
});

test('Metas inteligentes: carbos en días de entreno, aviso de proteína y plan con entrenos', async ({ page }) => {
  // Día con ejercicio: la meta de carbos sube
  const g = await page.evaluate(() => { const tg = calcTargets(); return [tg.carb, dayGoals(tg, 400).carb, dayGoals(tg, 0).carb]; });
  expect(g[1]).toBeCloseTo(g[0] + 70, 0);
  expect(g[2]).toBe(g[0]);
  await page.click('[data-view=rutinas]');
  await page.click('#genRoutine');
  await page.click('[data-view=comidas]');
  await page.click('[data-tab-com=recetas]');
  await page.click('[data-tab-com=plan]');
  await page.click('#genPlan');
  const plan = (await state(page)).plan;
  expect(plan.days.filter(d => d.train)).toHaveLength(3);
  await expect(page.locator('.tag', { hasText: 'entreno' }).first()).toBeVisible();
  // Aviso de proteína (forzamos la hora de la tarde)
  const n = await page.evaluate(() => {
    const H = Date.prototype.getHours; Date.prototype.getHours = () => 19;
    try { return nudges({ foods: [{ meal: 'almuerzo', kcal: 500, p: 5, c: 50, g: 10 }], exercises: [], water: 20 }, calcTargets()).map(x => x.id); }
    finally { Date.prototype.getHours = H; }
  });
  expect(n).toContain('prot');
});

test('Deshacer, buscar recetas por ingrediente y accesos directos', async ({ page }) => {
  const n0 = (await today(page)).foods.length;
  await page.click('[data-del-food]');
  expect((await today(page)).foods.length).toBe(n0 - 1);
  await page.click('.toast-undo');
  expect((await today(page)).foods.length).toBe(n0);
  await page.click('[data-view=comidas]');
  await page.click('[data-tab-com=recetas]');
  await page.fill('#recSearch', 'pollo arroz');
  await expect(page.locator('#recSearch')).toBeFocused();
  await expect(page.locator('#recList .rcard').first()).toContainText('Tiene todo');
  const w0 = (await today(page)).water;
  await page.goto('/index.html?a=agua');
  expect((await today(page)).water).toBe(w0 + 1);
  expect(page.url()).not.toContain('?a=');
  await page.goto('/index.html?a=entrenar');
  await expect(page.locator('[data-tab-rut=rutina]')).toHaveClass(/active/);
});

test('sin señal: la app y la rutina funcionan sin conexión', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.click('[data-view=rutinas]');
  await page.click('#genRoutine');
  // Las imágenes de la rutina se guardan solas
  await expect(page.locator('#offlineBox')).toContainText('Lista para entrenar sin señal', { timeout: 30000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.hello .name')).toHaveText('Benja');
  await page.click('[data-view=rutinas]');
  await expect(page.locator('.day-list .ex').first()).toBeVisible();
  const loaded = await page.$$eval('.day-list img.ex-thumb', imgs => Promise.all(imgs.map(i => i.decode().then(() => i.naturalWidth > 0, () => false))));
  expect(loaded.length).toBeGreaterThan(0);
  expect(loaded.every(Boolean)).toBe(true);
  await context.setOffline(false);
});

test('Íconos de comidas según el alimento', async ({ page }) => {
  const icons = await page.evaluate(() => ['Pechuga de pollo asada (sin piel)', 'Repollo', 'Pan amasado', 'Espinaca cruda', 'Empanada de pino (horno)', 'Tallarines con salsa boloñesa']
    .map(n => foodIcon(allFoods().find(f => f.name === n))));
  expect(icons).toEqual(['🍗', '🥬', '🍞', '🥬', '🥟', '🍝']);
  await expect(page.locator('.meal .fi').first()).toBeVisible();
  await page.click('[data-view=comidas]');
  await expect(page.locator('#foodList .fi').first()).toHaveText('🍗');
});

test('Más entrenamientos: tipos de rutina y entrenamiento suelto', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.waitForSelector('#genRoutine');
  for (const [prog, dias, first] of [['ppl', 3, 'Empuje'], ['bro', 5, 'Pecho'], ['gluteos', 3, 'Glúteos'], ['fuerza', 2, 'Fuerza A'], ['circuito', 3, 'Circuito A'], ['torso', 4, 'Torso']]) {
    if (!(await page.locator('#rProg').count())) await page.click('#cfgToggle');
    await page.selectOption('#rProg', prog);
    await page.selectOption('#rDias', String(dias));
    await page.selectOption('#rEq', 'gym');
    await page.click('#genRoutine');
    const r = (await state(page)).routine;
    expect(r.programa).toBe(prog);
    expect(r.days).toHaveLength(dias);
    expect(r.days[0].name).toContain(first);
    expect(r.days.every(d => d.exercises.filter(x => !x.warm && !x.stretch).length >= 3)).toBe(true);
  }
  // La rutina de fuerza usa los básicos con barra a 5×5
  await page.click('#cfgToggle');
  await page.selectOption('#rProg', 'fuerza');
  await page.selectOption('#rDias', '3');
  await page.click('#genRoutine');
  const f = (await state(page)).routine.days[0].exercises.filter(x => !x.warm && !x.stretch);
  expect(f.map(x => x.ex).slice(0, 3)).toEqual(['squat', 'bench-press', 'barbell-row']);
  expect(f[0]).toMatchObject({ series: 5, reps: '5' });
  // Fuera del gimnasio la de fuerza no aplica
  await page.click('#cfgToggle');
  await page.selectOption('#rEq', 'casa');
  await page.click('#genRoutine');
  expect((await state(page)).routine.programa).toBe('auto');
  // Entrenamiento suelto: no cambia la rutina y suma la actividad del día
  const before = JSON.stringify((await state(page)).routine);
  await page.click('[data-quick-w=core]');
  await page.click('#qkNew');
  await page.click('#qkGo');
  await page.click('[data-set="0"]');
  while (await page.locator('#wNext').count()) await page.click('#wNext');
  await page.click('#wFinish');
  await page.click('#okW');
  expect(JSON.stringify((await state(page)).routine)).toBe(before);
  expect((await today(page)).exercises.some(e => e.name === 'Entrenamiento: Core 15 min')).toBe(true);
});

test('Déficit: balance, ritmo, meta, avisos y semana de mantención', async ({ page }) => {
  // Ritmo: cambia la meta de calorías
  const kc = await page.evaluate(() => ['suave', 'moderado', 'rapido'].map(r => { state.profile.ritmo = r; return Math.round(calcTargets().kcal); }));
  expect(kc[0] - kc[1]).toBe(200);
  expect(kc[1] - kc[2]).toBe(250);
  await page.evaluate(() => { state.profile.ritmo = 'moderado'; });
  // Hoy muestra el balance de ayer y de la semana
  await page.reload();
  await expect(page.locator('.deficit-card')).toContainText('Últimos 7 días');
  // El déficit de un día es gasto + ejercicio − comida
  const d = await page.evaluate(() => { const k = shiftKey(todayKey(), -1), t = totals(state.days[k]), tg = calcTargets(); return [dayDeficit(k, tg), tg.tdee + t.burned - t.kcal]; });
  expect(d[0]).toBeCloseTo(d[1], 5);
  await page.click('[data-prog-tab=deficit]');
  await expect(page.locator('.def-chart .dc')).toHaveCount(14);
  // Meta y proyección
  await page.fill('#dMeta', '75');
  await page.selectOption('#dRitmo', 'suave');
  await page.click('#dSave');
  const p = (await state(page)).profile;
  expect(p).toMatchObject({ meta: 75, ritmo: 'suave' });
  await expect(page.locator('.result-box').first()).toContainText(/semanas|no te acercas/);
  // Aviso de déficit muy agresivo: 7 días comiendo 600 kcal
  await page.evaluate(() => { for (let i = 1; i <= 7; i++) state.days[shiftKey(todayKey(), -i)] = { foods: [{ id: 'x' + i, name: 'x', meal: 'almuerzo', kcal: 600, p: 40, c: 60, g: 20 }], exercises: [], water: 8 }; save(); render(); });
  await expect(page.locator('.warn-box').first()).toContainText(/Más de 1.000 kcal|metabolismo basal/);
  // Semana de mantención: la meta pasa a ser el gasto
  await page.evaluate(() => { state.dietBreak = { from: todayKey(), until: shiftKey(todayKey(), 6) }; });
  expect(await page.evaluate(() => Math.round(calcTargets().kcal) === Math.round(calcTargets().tdee))).toBe(true);
});

test('Desafíos de 30 días y resumen semanal', async ({ page }) => {
  await page.click('[data-view=progreso]');
  await page.click('[data-tab-prog=logros]');
  await page.click('[data-start-ch=pasos]');
  await page.click('[data-start-ch=agua]');
  await page.click('[data-check-ch=pasos]');
  const c = (await state(page)).challenges.find(x => x.id === 'pasos');
  expect(Object.keys(c.checks)).toHaveLength(1);
  await page.click('[data-view=hoy]');
  await expect(page.locator('.card', { hasText: 'Desafíos' })).toContainText('10.000 pasos');
  // Un desafío que empezó hace 31 días y se cumplió se cierra como ganado
  await page.evaluate(() => {
    const start = shiftKey(todayKey(), -31), checks = {};
    for (let i = 0; i < 30; i++) checks[shiftKey(start, i)] = true;
    state.challenges.push({ id: 'sueno', start, checks }); save(); render();
  });
  const s = (await state(page)).challenges.find(x => x.id === 'sueno');
  expect(s).toMatchObject({ closed: true, won: true });
  // Resumen semanal: aparece solo una vez por semana
  await page.evaluate(() => { state.weeklySeen = null; save(); });
  await page.reload();
  await expect(page.locator('.weekly')).toBeVisible();
  await page.click('#wkOk');
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.locator('.weekly')).toHaveCount(0);
});

test('Leer la etiqueta nutricional con la cámara (OCR)', async ({ page }) => {
  test.setTimeout(120000);
  await page.click('[data-view=comidas]');
  await page.click('#newFood');
  await page.setInputFiles('#cfPhoto', require('path').join(__dirname, 'assets', 'etiqueta.png'));
  await expect(page.locator('#cfStatus')).toContainText('Leí 4 de 4', { timeout: 90000 });
  expect(await page.inputValue('#cfKcal')).toBe('420');
  expect(await page.inputValue('#cfP')).toBe('8.5');
  expect(await page.inputValue('#cfG')).toBe('15.2');
  expect(await page.inputValue('#cfC')).toBe('62');
  expect(await page.inputValue('#cfPor')).toBe('30');
  // El intérprete también entiende etiquetas con la porción primero o con kJ
  const r = await page.evaluate(() => [
    parseLabel('Porción 200 ml\n 1 porción 100 ml\nEnergía (kcal) 130 65\nProteínas (g) 6,4 3,2\nGrasa total (g) 3,0 1,5\nHidratos de carbono disponibles (g) 19,6 9,8'),
    parseLabel('Por 100 g\nEnergía 1760 kJ / 420 kcal\nGrasas 15 g\nde las cuales saturadas 6 g\nHidratos de carbono 62 g\nProteínas 8.5 g'),
  ]);
  expect(r[0]).toMatchObject({ kcal: 65, p: 3.2, g: 1.5, c: 9.8, por: 200 });
  expect(r[1]).toMatchObject({ kcal: 420, p: 8.5, g: 15, c: 62 });
});

test('Combos y ayuno intermitente', async ({ page }) => {
  // Guardar el desayuno de hoy (avena + plátano) como combo
  await page.click('[data-save-combo=desayuno]');
  await page.fill('#cbName', 'Desayuno de siempre');
  await page.click('#cbSave');
  expect((await state(page)).combos).toHaveLength(1);
  await page.click('[data-view=comidas]');
  await page.click('[data-pick-meal=snack]');
  await page.click('[data-cat="🍱 Combos"]');
  const n0 = (await today(page)).foods.length;
  await page.click('[data-combo-add]');
  const foods = (await today(page)).foods;
  expect(foods.length).toBe(n0 + 2);
  expect(foods.slice(-2).every(f => f.meal === 'snack')).toBe(true);
  // Ayuno: se activa en Perfil y aparece en Hoy
  await page.click('.page-head [data-go=perfil]');
  await page.selectOption('#fastPlan', '16');
  await page.check('#fastOn');
  await page.click('[data-view=hoy]');
  await page.click('#fastStart');
  expect((await state(page)).fasting.start).toBeGreaterThan(0);
  await expect(page.locator('.fast-card')).toContainText('En ayuno');
  // Simulamos que empezó hace 17 horas: la meta está cumplida
  await page.evaluate(() => { state.fasting.start = Date.now() - 17 * 3600000; render(); });
  await expect(page.locator('#fastMsg')).toContainText('Meta cumplida');
  await page.click('#fastEnd');
  const f = (await state(page)).fasting;
  expect(f.start).toBeNull();
  expect(f.log.at(-1).ok).toBe(true);
});

test('Entrenamiento: historial, semana de descarga y cronómetro de cardio', async ({ page }) => {
  // Historial del press de banca (los datos de prueba traen 10 sesiones)
  expect(await page.evaluate(() => exHistory('bench-press').length)).toBe(5);
  await page.click('[data-view=rutinas]');
  await page.waitForSelector('#genRoutine');
  await page.selectOption('#rEq', 'gym');
  await page.click('#genRoutine');
  await page.click('[data-quick-w=fuerza]');
  await page.click('#qkGo');
  for (let i = 0; i < 6 && !(await page.locator('#wk h2', { hasText: 'Press de Banca con Barra' }).count()); i++) await page.click('#wNext');
  await page.click('summary:has-text("Historial")');
  await expect(page.locator('.hist-row')).toHaveCount(5);
  await page.click('#wQuit');
  // Semana de descarga: al completar la semana 4 llega la 5, de descarga
  await page.evaluate(() => { state.routine.week = 4; state.routine.days.forEach((d, i) => { if (!d.done) setDayDone(i); }); save(); render(); });
  const r = (await state(page)).routine;
  expect(r).toMatchObject({ week: 5, deload: true });
  await expect(page.locator('.warn-box', { hasText: 'Semana de descarga' })).toBeVisible();
  const lens = await page.evaluate(() => {
    startWorkout(0);
    const ses = JSON.parse(localStorage.getItem('fitplan-session'));
    return state.routine.days[0].exercises.map((x, k) => [x.series, ses.sets[k].length, !!(x.warm || x.stretch)]);
  });
  expect(lens.filter(([, , w]) => !w).every(([a, b]) => b < a)).toBe(true);
  await page.click('#wQuit');
  // Cronómetro: 30 minutos trotando, 5 km → 6:00 min/km
  await page.click('[data-tab-rut=actividad]');
  await page.click('[data-cardio-act=trotar]');
  await page.click('#cdStart');
  await expect(page.locator('#cdT')).toBeVisible();
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('fitplan-cardio')); c.start = Date.now() - 30 * 60000; localStorage.setItem('fitplan-cardio', JSON.stringify(c)); render(); });
  await page.click('#cdStop');
  await page.fill('#cdKm', '5');
  await expect(page.locator('#cdPace')).toContainText('6:00 min/km');
  await page.click('#cdSave');
  const ex = (await today(page)).exercises.at(-1);
  expect(ex).toMatchObject({ minutes: 30, km: 5 });
  expect(ex.name).toContain('6:00 min/km');
});

test('Varias personas en el mismo teléfono', async ({ page }) => {
  await page.click('#avatarBtn');
  await page.click('#openProfiles');
  await page.fill('#newProf', 'Sofía');
  await Promise.all([page.waitForEvent('load'), page.click('#addProf')]);
  // Perfil nuevo: empieza vacío, en la bienvenida y con su nombre puesto
  await expect(page.locator('#pNombre')).toHaveValue('Sofía');
  await page.fill('#pPeso', '60');
  await page.fill('#pAltura', '165');
  await page.selectOption('#pSexo', 'm');
  await page.click('#saveProfile');
  await expect(page.locator('.hello .name')).toHaveText('Sofía');
  expect(Object.keys((await state(page)).days)).toHaveLength(0);
  const idx = await page.evaluate(() => profilesIndex());
  expect(idx.list.map(p => p.name)).toEqual(['Benja', 'Sofía']);
  // Volver a Benja: sus datos siguen ahí
  await page.click('#avatarBtn');
  await page.click('#openProfiles');
  await Promise.all([page.waitForEvent('load'), page.click(`[data-switch="p1"]`)]);
  await expect(page.locator('.hello .name')).toHaveText('Benja');
  expect(Object.keys((await state(page)).days).length).toBeGreaterThan(10);
  // Eliminar a Sofía desde Perfil
  await page.click('.hello [data-go=perfil]');
  await page.click('[data-del-p]');
  expect((await page.evaluate(() => profilesIndex())).list).toHaveLength(1);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fitplan-v1-')))).toEqual([]);
});

test('Coach: chat con IA (simulada), contexto sin datos personales y coach básico de respaldo', async ({ page }) => {
  // IA simulada: devuelve la respuesta por partes, como la real
  await page.evaluate(() => {
    window.__asked = [];
    window.FitSync.ask = async ({ message, history, system, onChunk }) => {
      window.__asked.push({ message, history, system });
      const txt = '**¡Bien hecho!** Registraste todos los días.\n- Sube la proteína en el desayuno.';
      onChunk(txt.slice(0, 10)); await new Promise(r => setTimeout(r, 50)); onChunk(txt);
      return txt;
    };
  });
  await page.click('[data-view=coach]');
  await expect(page.locator('.coach-log .msg.model').first()).toContainText('Conozco tus registros');
  await page.click('[data-q=bien]');
  await expect(page.locator('.msg.model').last()).toContainText('¡Bien hecho!');
  await expect(page.locator('.msg.model b').last()).toHaveText('¡Bien hecho!');
  // El mensaje lleva los datos, pero no el nombre de la persona
  const asked = await page.evaluate(() => window.__asked[0]);
  expect(asked.message).toContain('Metas diarias');
  expect(asked.message).toContain('Últimos 7 días');
  expect(asked.message).not.toContain('Benja');
  expect(asked.system).toContain('español de Chile');
  // Pregunta escrita: el historial anterior viaja con ella
  await page.fill('#cMsg', '¿Qué ceno hoy?');
  await page.press('#cMsg', 'Enter');
  await expect(page.locator('.msg.user').last()).toHaveText('¿Qué ceno hoy?');
  expect(await page.evaluate(() => window.__asked[1].history.length)).toBe(2);
  // Mientras responde no se puede mandar otra pregunta
  await expect(page.locator('[data-q=mejorar]')).toBeDisabled();
  await expect(page.locator('.msg.model').last()).toContainText('Sube la proteína');
  await expect(page.locator('.msg.model')).toHaveCount(2); // el saludo inicial se reemplaza por la conversación
  await expect(page.locator('[data-q=mejorar]')).toBeEnabled();
  // Si la IA falla (por ejemplo, sin iniciar sesión), responde el coach básico
  await page.evaluate(() => { window.FitSync.ask = async () => { const e = new Error('auth'); e.code = 'auth'; throw e; }; });
  await page.click('[data-q=mejorar]');
  await expect(page.locator('.msg.model').last()).toContainText('inicia sesión con Google');
  // El chat queda guardado en el teléfono
  expect(await page.evaluate(() => coachLog().length)).toBe(6);
  // Si Firebase rechaza la petición, se muestra el motivo y el detalle técnico para revisarlo
  await page.evaluate(() => { window.FitSync.ask = async () => { throw new Error('[403] PERMISSION_DENIED: Firebase AI Logic API has not been used in project'); }; });
  await page.click('[data-q=meta]');
  await expect(page.locator('.msg.model').last()).toContainText('Falta activar la IA en Firebase');
  await expect(page.locator('.msg.model').last()).toContainText('Detalle técnico: [403] PERMISSION_DENIED');
  // App Check exigido sin token: indica cómo desactivarlo
  await page.evaluate(() => { window.FitSync.ask = async () => { throw new Error('AI: Error fetching [401 ] Firebase App Check token is invalid. (AI/fetch-error)'); }; });
  await page.click('[data-q=bien]');
  await expect(page.locator('.msg.model').last()).toContainText('App Check → APIs → Firebase AI Logic');
  const basic = await page.evaluate(() => basicCoach('semana'));
  expect(basic.some(x => x.startsWith('✅')) || basic.some(x => x.startsWith('💡'))).toBe(true);
});

// IA simulada para las funciones nuevas: responde según lo que se le pide
async function fakeAI(page) {
  await page.evaluate(() => {
    // Sesión simulada fija: si Firebase real carga (el service worker lo descarga aunque se bloquee en la página), no la borra
    for (const [k, v] of [['enabled', true], ['user', { name: 'x' }]]) Object.defineProperty(window.FitSync.state, k, { get: () => v, set() {}, configurable: true });
    window.__asked = [];
    window.FitSync.ask = async o => {
      window.__asked.push(o);
      const m = o.message;
      if (o.json && /Esto comí|foto/.test(m)) return '```json\n' + JSON.stringify({ items: [{ name: 'Marraqueta casera', grams: 100, kcal: 270, p: 8, c: 56, g: 1 }, { name: 'Palta', grams: 50, kcal: 999, p: 1, c: 4, g: 7 }, { name: 'Agua', grams: 200, kcal: 0 }], meal: 'desayuno', note: 'Porción estimada' }) + '\n```';
      if (o.json && /Mi entrenamiento/.test(m)) return JSON.stringify({ strength: [{ id: null, name: 'Press de banca con barra', sets: [{ kg: 70, reps: 10 }, { kg: 70, reps: 8 }] }, { id: null, name: 'Remo en máquina Hammer', sets: [{ kg: 40, reps: 12 }] }], cardio: [{ act: 'trotar', minutes: 20, km: 3 }, { act: 'inventado', minutes: 5 }], minutes: 40, note: '' });
      if (o.json && /Arma /.test(m)) return JSON.stringify({ name: 'Bowl de pollo y arroz', minutes: 20, items: [{ name: 'Pechuga de pollo', grams: 150, kcal: 248, p: 46, c: 0, g: 5 }, { name: 'Arroz', grams: 120, kcal: 156, p: 3, c: 34, g: 0 }], steps: ['Cocina el arroz.', 'Dora el pollo.'], tip: 'Agrega verduras.' });
      const txt = '**✅ Lo que hiciste bien**\n- Registraste 6 días.\n**🎯 Meta para esta semana**\n- 140 g de proteína diaria.';
      if (o.onChunk) o.onChunk(txt);
      return txt;
    };
  });
}

test('IA: registrar comida escribiendo o con foto, con revisión antes de guardar', async ({ page }) => {
  // Sin sesión: pide iniciar sesión en vez de fallar
  await page.click('[data-view=comidas]');
  await page.click('#aiText');
  await expect(page.locator('.modal')).toContainText('inicia sesión con Google');
  await page.click('[data-go-login]');
  await expect(page.locator('#main')).toContainText('Sincronización');
  await fakeAI(page);
  await page.click('[data-view=comidas]');
  const n0 = (await today(page)).foods.length;
  await page.click('#aiText');
  await page.fill('#afText', 'una marraqueta con palta');
  await page.click('#afGo');
  // La palta se reconoce en la base y usa sus valores reales (no los 999 kcal de la IA); el agua sin calorías se descarta
  await expect(page.locator('.ai-item')).toHaveCount(2);
  await expect(page.locator('.ai-item').nth(1)).toContainText('de la base');
  await expect(page.locator('[data-ai-meal=desayuno]')).toHaveClass(/on/);
  // Cambiar gramos escala las calorías; desmarcar quita el alimento
  await page.fill('[data-ai-g="0"]', '50');
  await page.dispatchEvent('[data-ai-g="0"]', 'change');
  await expect(page.locator('.ai-item').first().locator('.kcal')).toHaveText('135');
  await page.click('[data-ai-meal=snack]');
  await page.click('#aiSave');
  const fs = (await today(page)).foods.slice(n0);
  expect(fs).toHaveLength(2);
  expect(fs[0]).toMatchObject({ name: 'Marraqueta casera', grams: 50, kcal: 135, meal: 'snack', ai: true });
  expect(fs[1].foodId).toBe('palta');
  expect(fs[1].kcal).toBeLessThan(200);
  expect(await page.evaluate(() => window.__asked[0].json)).toBe(true);
  // Foto: la imagen viaja a la IA en base64
  await page.click('#aiPhoto');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#afPhoto', { name: 'plato.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.ai-item')).toHaveCount(2);
  const img = await page.evaluate(() => window.__asked.at(-1).image);
  expect(img.mimeType).toBe('image/jpeg');
  expect(img.data.length).toBeGreaterThan(50);
  // Si la IA falla, se muestra el motivo
  await page.evaluate(() => { window.FitSync.ask = async () => { throw new Error('[429] quota exceeded'); }; });
  await page.click('#afGo');
  await expect(page.locator('#afOut')).toContainText('cuota gratis');
});

test('IA: registrar ejercicio escribiendo, con récord y ejercicio nuevo', async ({ page }) => {
  await fakeAI(page);
  await page.click('[data-view=rutinas]');
  await page.click('[data-tab-rut=actividad]');
  const w0 = (await state(page)).workouts.length;
  await page.click('#aiEx');
  await page.fill('#aeText', 'press banca 70x10 y 70x8, remo hammer 40x12 y 20 min trote 3 km');
  await page.click('#aeGo');
  await expect(page.locator('.ai-result')).toContainText('Press de Banca con Barra');
  await expect(page.locator('.ai-result .pr-tag')).toHaveCount(1); // 70 × 10 supera su mejor marca
  await expect(page.locator('[data-ae-ex="1"]')).toHaveValue(''); // "Nuevo: Remo en máquina Hammer"
  // La IA del sistema recibe la biblioteca para elegir bien el ejercicio
  expect(await page.evaluate(() => window.__asked.at(-1).system)).toContain('squat: Sentadilla Trasera con Barra');
  await expect(page.locator('.ai-result')).toContainText('Trotar');
  await expect(page.locator('.ai-result')).not.toContainText('inventado');
  // Para corregir, la lista ofrece ejercicios parecidos de la biblioteca
  expect(await page.evaluate(() => exerciseCandidates('Sentadilla con barra').map(e => e.id))).toContain('squat');
  await page.click('#aeSave');
  await expect(page.locator('#toast')).toContainText('Nuevo récord en Press de Banca con Barra');
  const s = await state(page);
  expect(s.workouts).toHaveLength(w0 + 1);
  const w = s.workouts.at(-1);
  expect(w.minutes).toBe(40);
  expect(w.ex[0]).toEqual({ id: 'bench-press', sets: [{ kg: 70, reps: 10 }, { kg: 70, reps: 8 }] });
  expect(s.customExercises.map(e => e.n)).toEqual(['Remo en máquina Hammer']);
  const ex = (await today(page)).exercises;
  expect(ex.some(e => e.name.startsWith('Pesas: Press de Banca') && e.minutes === 40)).toBe(true);
  expect(ex.some(e => e.name.startsWith('Trotar') && e.minutes === 20 && e.km === 3)).toBe(true);
  // El récord aparece en Progreso → Fuerza
  await page.click('[data-view=progreso]');
  await page.click('[data-tab-prog=fuerza]');
  await expect(page.locator('.pr-box')).toContainText('Press de Banca con Barra');
  await page.click('[data-strength=bench-press]');
  await expect(page.locator('.modal')).toContainText('Peso máximo');
  await expect(page.locator('.modal')).toContainText('70 kg × 10');
  await page.click('[data-metric=vol]');
  await expect(page.locator('#mLbl')).toContainText('Volumen');
});

test('IA: armar una comida con lo que queda y revisión semanal del coach', async ({ page }) => {
  await fakeAI(page);
  await page.click('[data-view=comidas]');
  await page.click('[data-tab-com=recetas]');
  await page.click('#aiMeal');
  await page.fill('#amHave', 'pollo y arroz');
  await page.click('[data-am-pref=proteina]');
  await page.click('[data-am-meal=cena]');
  await page.click('#amGo');
  await expect(page.locator('.ai-result')).toContainText('Bowl de pollo y arroz');
  const q = await page.evaluate(() => window.__asked.at(-1).message);
  expect(q).toContain('una cena');
  expect(q).toContain('pollo y arroz');
  expect(q).toContain('Alta en proteína');
  await page.click('#amCombo');
  expect((await state(page)).combos.at(-1)).toMatchObject({ name: 'Bowl de pollo y arroz', meal: 'cena' });
  // Otra idea: le pide que no repita la anterior
  await page.click('#amAgain');
  await expect(page.locator('.ai-result')).toBeVisible();
  expect(await page.evaluate(() => window.__asked.at(-1).message)).toContain('No repitas estas ideas: Bowl de pollo y arroz');
  const n0 = (await today(page)).foods.length;
  await page.click('#amAdd');
  const fs = (await today(page)).foods.slice(n0);
  expect(fs.map(f => f.meal)).toEqual(['cena', 'cena']);
  // Revisión semanal: el resumen del lunes trae el análisis del coach y queda guardado
  await page.click('[data-view=progreso]');
  await page.click('[data-tab-prog=resumen]');
  await page.click('#lastWeek');
  await expect(page.locator('#wkAI')).toContainText('Lo que hiciste bien');
  const asks = await page.evaluate(() => window.__asked.length);
  await page.click('#wkOk');
  await page.click('#lastWeek');
  await expect(page.locator('#wkAI')).toContainText('140 g de proteína');
  expect(await page.evaluate(() => window.__asked.length)).toBe(asks); // la segunda vez no se vuelve a preguntar
  expect(await page.evaluate(() => coachLog().at(-1).text)).toContain('Meta para esta semana');
});

test('Récords: aviso en vivo al superar tu marca durante el entrenamiento', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  // Mejor marca del fixture en press de banca: 60 kg × 10 → 1RM ≈ 80 kg
  expect(Math.round(await page.evaluate(() => loadExercises().then(() => bestE1rm('bench-press'))))).toBe(80);
  await page.evaluate(() => startWorkout(0, { name: 'Pecho', exercises: [{ ex: 'bench-press', series: 3, reps: '8-10', rest: '0' }] }));
  await page.fill('[data-kg="0"]', '50');
  await page.fill('[data-reps="0"]', '10');
  await page.click('[data-set="0"]');
  await expect(page.locator('#toast')).not.toContainText('récord');
  await page.fill('[data-kg="1"]', '65');
  await page.fill('[data-reps="1"]', '10');
  await page.click('[data-set="1"]');
  await expect(page.locator('#toast')).toContainText('¡Nuevo récord en Press de Banca con Barra! 1RM ≈ 87 kg (antes 80)');
  // Solo avisa una vez por ejercicio en la sesión
  expect(await page.evaluate(() => activeSession().prs)).toEqual(['bench-press']);
});

test('Gym: elegir ejercicios por músculo, anotar series y calorías, editar y borrar', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.click('[data-tab-rut=actividad]');
  await page.click('#gymLog');
  // Primero se elige el ejercicio: por músculo, equipo o búsqueda con nombres de gimnasio
  await page.click('[data-gg=triceps]');
  await page.click('[data-ge=polea]');
  await expect(page.locator('[data-gp="x-rope-pushdown"]')).toBeVisible();
  await page.click('[data-gg=todos]');
  await page.click('[data-ge=todos]');
  await page.fill('#gQ', 'press frances');
  await expect(page.locator('[data-gp]').first()).toBeVisible();
  expect(await page.locator('[data-gp]').count()).toBeGreaterThan(0);
  await page.fill('#gQ', 'cruce poleas');
  await page.click('[data-gp="x-cable-crossover-high"]');
  await page.fill('#gQ', 'press banca barra');
  await page.click('[data-gp="bench-press"]');
  await expect(page.locator('#gDone')).toHaveText(/2 ejercicios/);
  await page.click('#gDone');
  // El press de banca parte con las series de la última vez; el cruce de poleas con 3 vacías
  await expect(page.locator('.gym-ex')).toHaveCount(2);
  await expect(page.locator('.gym-ex').nth(1)).toContainText('última vez');
  await page.fill('[data-gs-kg="0:0"]', '15');
  await page.fill('[data-gs-reps="0:0"]', '12');
  await page.fill('[data-gs-kg="0:1"]', '15');
  await page.fill('[data-gs-reps="0:1"]', '10');
  await page.click('[data-gs-del="0:2"]'); // la tercera serie no se hizo
  await page.fill('[data-gs-kg="1:0"]', '70'); // récord: 70 × 10
  await expect(page.locator('.gym-ex').nth(1).locator('.pr-tag')).toBeVisible();
  await page.click('[data-gs-add="1"]');
  // Las calorías dependen de la duración y la intensidad
  const kcal = async () => Number(await page.locator('.gym-sum .mini').nth(2).locator('b').textContent());
  await page.fill('#gMin', '45');
  const k1 = await kcal();
  expect(k1).toBeGreaterThan(150);
  await page.click('[data-gi=intensa]');
  expect(await kcal()).toBeGreaterThan(k1);
  // Si se cierra sin guardar, el borrador queda guardado
  await page.click('.modal-x');
  await expect(page.locator('#gymLog')).toContainText('2 ejercicios sin guardar');
  await page.click('#gymLog');
  await expect(page.locator('.gym-ex')).toHaveCount(2);
  const w0 = (await state(page)).workouts.length;
  await page.click('#gSave');
  await expect(page.locator('#toast')).toContainText('Nuevo récord en Press de Banca con Barra');
  let s = await state(page);
  expect(s.workouts).toHaveLength(w0 + 1);
  const w = s.workouts.at(-1);
  expect(w.minutes).toBe(45);
  expect(w.ex[0]).toEqual({ id: 'x-cable-crossover-high', sets: [{ kg: 15, reps: 12 }, { kg: 15, reps: 10 }] });
  expect(w.ex[1].sets[0].kg).toBe(70);
  const entry = (await today(page)).exercises.at(-1);
  expect(entry.wid).toBe(w.id);
  expect(entry.name).toContain('Cruce de Poleas');
  expect(Math.round(entry.kcal)).toBeGreaterThan(k1);
  expect(await page.evaluate(() => gymDraft())).toBeNull();
  // Editar: se reemplaza la misma sesión
  await page.click(`[data-edit-gym="${w.id}"]`);
  await page.fill('[data-gs-reps="0:1"]', '11');
  await page.click('#gSave');
  s = await state(page);
  expect(s.workouts).toHaveLength(w0 + 1);
  expect(s.workouts.at(-1).ex[0].sets[1].reps).toBe(11);
  expect((await today(page)).exercises.filter(e => e.wid === w.id)).toHaveLength(1);
  // Borrar quita también las series; deshacer las recupera
  await page.click(`[data-del-ex="${(await today(page)).exercises.find(e => e.wid === w.id).id}"]`);
  expect((await state(page)).workouts).toHaveLength(w0);
  await page.click('.toast-undo');
  expect((await state(page)).workouts).toHaveLength(w0 + 1);
});

test('Biblioteca: grupos musculares finos y ejercicios extra de gimnasio', async ({ page }) => {
  const r = await page.evaluate(async () => {
    await loadExercises();
    const db = exDB(), by = g => db.filter(e => e.cat !== 'estiramiento' && e.cat !== 'cardio' && exMuscle(e) === g).length;
    return { total: db.length, extra: db.filter(e => e.id.startsWith('x-')).length, groups: Object.fromEntries(MUSCLE_GROUPS.map(([k]) => [k, by(k)])), ids: new Set(db.map(e => e.id)).size };
  });
  expect(r.extra).toBeGreaterThan(50);
  expect(r.ids).toBe(r.total); // sin ids repetidos
  for (const [g, n] of Object.entries(r.groups)) expect(n, g).toBeGreaterThan(10);
});

test('IA gym: ejercicios sin series pasan al registro del gym para completar kg y reps', async ({ page }) => {
  await fakeAI(page);
  await page.evaluate(() => {
    window.FitSync.ask = async o => { window.__asked.push(o); return JSON.stringify({ strength: [
      { id: 'incline-db-curl', name: 'Curl inclinado con mancuernas', sets: [] },
      { id: 'concentration-curl', name: 'Curl concentrado con barra Z', sets: [] },
      { id: 'ez-bar-lying-tricep-extension', name: 'Press francés', sets: [] },
      { id: 'tricep-pushdown', name: 'Extensión de tríceps hacia abajo', sets: [] },
      { id: 'machine-shoulder-press', name: 'Press militar en máquina', sets: [] },
      { id: 'lateral-raise', name: 'Elevación lateral con mancuernas', sets: [] },
    ], cardio: [{ act: 'trotar', minutes: 15 }], minutes: null }); };
  });
  await page.click('[data-view=rutinas]');
  await page.click('[data-tab-rut=actividad]');
  await page.click('#aiEx');
  await page.fill('#aeText', 'Curl inclinado con mancuernas y curl concentrado con barras en z, press frances y extension de triceps hacia abajo y press militar en maquina con elevación de mancuernas');
  await page.click('#aeGo');
  // Antes decía "No entendí ejercicios"; ahora muestra los 6 y pide completar las series
  await expect(page.locator('.ai-result .ex-pick')).toHaveCount(6);
  await expect(page.locator('.ai-result')).toContainText('Sin series');
  expect(await page.evaluate(() => window.__asked.at(-1).system)).toContain('no inventes números');
  await page.click('#aeEdit');
  // Se abre el registro del gym con los 6 ejercicios y 3 series para llenar; el trote ya quedó guardado
  await expect(page.locator('.gym-ex')).toHaveCount(6);
  await expect(page.locator('.gym-ex').first()).toContainText('Curl con mancuernas en banco inclinado');
  expect((await today(page)).exercises.some(e => e.name.startsWith('Trotar') && e.minutes === 15)).toBe(true);
  await page.fill('[data-gs-kg="0:0"]', '10');
  await page.fill('[data-gs-reps="0:0"]', '12');
  await page.click('#gSave');
  const w = (await state(page)).workouts.at(-1);
  expect(w.ex).toEqual([{ id: 'incline-db-curl', sets: [{ kg: 10, reps: 12 }] }]); // solo las series con repeticiones
});

test('Foto del plato: base de alimentos, valores por 100 g, porción, rango y corrección', async ({ page }) => {
  await fakeAI(page);
  await page.evaluate(() => {
    window.FitSync.ask = async o => {
      window.__asked.push(o);
      const fixed = /CORRECCIÓN/.test(o.message);
      return JSON.stringify({
        dish: 'Pollo con arroz', confidence: 'media', meal: null, note: 'Supuse arroz blanco.',
        items: [
          { name: 'Pechuga de pollo a la plancha', id: 'pollo', grams: fixed ? 300 : 150, kcal100: 999 }, // de la base: se usan sus valores, no los de la IA
          { name: 'Arroz blanco al vapor', id: null, grams: 200, kcal100: 130, p100: 2.7, c100: 28, g100: 0.3 },
          { name: 'Aceite de cocción', id: 'no-existe', grams: 10, kcal100: 884, p100: 0, c100: 0, g100: 100 },
        ],
      });
    };
  });
  await page.click('[data-view=comidas]');
  await page.click('#aiPhoto');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#afPhoto', { name: 'plato.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.ai-item')).toHaveCount(3);
  // La foto se analiza con más detalle y la IA recibe la base de alimentos y el método
  const req = await page.evaluate(() => window.__asked.at(-1));
  expect(req.think).toBe('MEDIUM');
  expect(req.system).toContain('pollo: Pechuga de pollo asada');
  expect(req.system).toContain('Aceite de cocción');
  // Pollo 150 g de la base (165 kcal/100 g) = 248; arroz 200 g × 1,3 = 260; aceite 10 g = 88 → 596
  const total = async () => Number(await page.locator('.ai-total-row div').first().locator('b').textContent());
  expect(await total()).toBe(596);
  await expect(page.locator('.ai-item').first()).toContainText('valores de la base');
  await expect(page.locator('.ai-total')).toContainText('Confianza media');
  await expect(page.locator('.ai-total')).toContainText('entre 477 y 715 kcal');
  await expect(page.locator('.ai-total-row .prot b')).toHaveText('52 g'); // 46,5 + 5,4 de proteína
  // Porción ¾ escala todo
  await page.click('[data-ai-k="0.75"]');
  expect(await total()).toBe(447);
  await page.click('[data-ai-k="1"]');
  // Corrección: se vuelve a preguntar con la estimación anterior y lo que dijo la persona
  await page.click('.ai-fix summary');
  await page.fill('#aiFixTxt', 'eran 2 pechugas');
  await page.click('#aiFixGo');
  await expect.poll(total).toBe(843);
  const fix = await page.evaluate(() => window.__asked.at(-1).message);
  expect(fix).toContain('CORRECCIÓN DE LA PERSONA (respétala): eran 2 pechugas');
  expect(fix).toContain('"name":"Pechuga de pollo asada (sin piel)","grams":150');
  // Sin comida indicada, se anota según la hora
  const guess = await page.evaluate(() => guessMeal());
  await expect(page.locator(`[data-ai-meal=${guess}]`)).toHaveClass(/on/);
  const n0 = (await today(page)).foods.length;
  await page.click('#aiSave');
  const fs = (await today(page)).foods.slice(n0);
  expect(fs.map(f => [f.name, f.grams, f.meal])).toEqual([['Pechuga de pollo asada (sin piel)', 300, guess], ['Arroz blanco al vapor', 200, guess], ['Aceite de cocción', 10, guess]]);
  expect(fs[0].foodId).toBe('pollo');
  await expect(page.locator('#toast')).toContainText('843 kcal');
});

test('Gasto real: se mide con comidas y peso, se ofrece en Hoy y cambia la meta', async ({ page }) => {
  // 21 días comiendo 2.000 kcal y bajando 0,5 kg/semana → gasto ≈ 2.000 + 0,5 × 7.700 / 7 = 2.550
  await page.evaluate(() => {
    state.days = {}; state.weights = [];
    for (let i = 1; i <= 21; i++) {
      const k = shiftKey(todayKey(), -i);
      state.days[k] = { foods: [{ id: 'a' + i, name: 'a', meal: 'almuerzo', kcal: 1200, p: 80, c: 100, g: 40 }, { id: 'b' + i, name: 'b', meal: 'cena', kcal: 800, p: 50, c: 60, g: 30 }], exercises: [], water: 8 };
      if (i % 3 === 0) state.weights.push({ d: k, kg: Math.round((80 + i * 0.5 / 7) * 10) / 10 });
    }
    state.weights.push({ d: todayKey(), kg: 80 });
    state.profile.gastoReal = false; state.profile.gastoRealNo = null;
    save();
  });
  await page.reload();
  const r = await page.evaluate(() => realTdee());
  expect(r.ready).toBe(true);
  expect(r.measured).toBeGreaterThan(2450);
  expect(r.measured).toBeLessThan(2650);
  expect(r.conf).toBe(1);
  // Antes de aceptarlo, la meta sigue con la fórmula; Hoy ofrece usarlo
  const before = await page.evaluate(() => Math.round(calcTargets().kcal));
  await expect(page.locator('.nudge').first()).toContainText('Medí tu gasto real');
  await page.click('[data-nudge=gasto]');
  await page.click('#rtYes');
  const tg = await page.evaluate(() => calcTargets());
  expect(tg.real).toBe(true);
  expect(Math.round(tg.tdee)).toBe(Math.round(r.v));
  expect(Math.round(tg.kcal)).not.toBe(before);
  await expect(page.locator('.hero')).toContainText('Meta según tu gasto real');
  // En Progreso → Peso se ve y se puede volver a la fórmula
  await page.click('[data-view=progreso]');
  await page.click('[data-tab-prog=peso]');
  await expect(page.locator('.real-tdee')).toContainText('En uso');
  await page.click('#rtToggle');
  expect(await page.evaluate(() => calcTargets().real)).toBe(false);
  // Con pocos datos dice qué falta
  await page.evaluate(() => { state.days = {}; save(); render(); });
  await expect(page.locator('.real-tdee')).toContainText('me falta');
});

test('Gym: peso sugerido para hoy, calorías por tiempo en serie y duración real', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.click('[data-tab-rut=actividad]');
  // Última vez en press de banca (fixture): 60 × 10 y 60 × 9 → mismo peso, 10 reps
  expect(await page.evaluate(() => loadExercises().then(() => nextTarget('bench-press')))).toMatchObject({ kg: 60, reps: 10 });
  // Si llegó a 12 en todas, sube 2,5 kg y vuelve a 8
  expect(await page.evaluate(() => { state.workouts.push({ id: 'w', d: todayKey(), name: 'x', minutes: 40, ex: [{ id: 'bench-press', sets: [{ kg: 60, reps: 12 }, { kg: 60, reps: 12 }] }] }); return nextTarget('bench-press'); })).toMatchObject({ kg: 62.5, reps: 8, sets: 2 });
  await page.evaluate(() => { state.workouts.pop(); });
  await page.click('#gymLog');
  await page.fill('#gQ', 'press banca barra');
  await page.click('[data-gp="bench-press"]');
  await page.click('#gDone');
  await expect(page.locator('.gym-tip')).toContainText('60 kg × 10');
  await page.click('[data-gx-tip="0"]');
  await expect(page.locator('[data-gs-reps="0:0"]')).toHaveValue('10');
  await expect(page.locator('[data-gs-reps="0:1"]')).toHaveValue('10');
  // Calorías: una hora con 18 series no cuenta como 60 min levantando sin parar
  const k = await page.evaluate(() => {
    const items = [{ id: 'bench-press', sets: Array.from({ length: 18 }, () => ({ kg: 60, reps: 10 })) }];
    return { hora: gymKcal(items, 60), intensa: gymKcal(items, 60, 'intensa'), sinPausa: burnedKcal(5, 60) };
  });
  expect(k.hora).toBeLessThan(k.sinPausa);
  expect(k.hora).toBeGreaterThan(150);
  expect(k.intensa).toBeGreaterThan(k.hora);
  // Duración real: desde la primera serie anotada
  await page.evaluate(() => { const d = gymDraft(); d.t0 = Date.now() - 47 * 60000; storeGymDraft(d); });
  await page.click('.modal-x');
  await page.click('#gymLog');
  await expect(page.locator('.gym-foot')).toContainText('Llevas 50 min');
  await expect(page.locator('#gMin')).toHaveValue('50');
});

test('Consejo del día en Hoy: calculado sin IA y con IA una vez por momento del día', async ({ page }) => {
  await expect(page.locator('.tip-card')).toBeVisible();
  const basic = await page.evaluate(() => basicTip());
  await expect(page.locator('#dayTip')).toHaveText(basic);
  await fakeAI(page);
  await page.evaluate(() => { window.FitSync.ask = async o => { window.__asked.push(o); return 'Te faltan **40 g** de proteína: suma 2 huevos en la once.'; }; });
  await page.click('[data-view=comidas]');
  await page.click('[data-view=hoy]');
  await expect(page.locator('#dayTip')).toContainText('Te faltan 40 g de proteína');
  expect(await page.evaluate(() => window.__asked.at(-1).message)).toContain('UN consejo concreto');
  // Queda guardado: al volver a Hoy no se pregunta de nuevo
  const n = await page.evaluate(() => window.__asked.length);
  await page.click('[data-view=comidas]');
  await page.click('[data-view=hoy]');
  await expect(page.locator('#dayTip')).toContainText('Te faltan 40 g');
  expect(await page.evaluate(() => window.__asked.length)).toBe(n);
  // ↻ pide otro distinto
  await page.click('#tipMore');
  await expect.poll(() => page.evaluate(() => window.__asked.length)).toBe(n + 1);
  expect(await page.evaluate(() => window.__asked.at(-1).message)).toContain('Que sea distinto');
});

test('Etiqueta y productos con IA: crear alimento, producto sin código y foto que aprende', async ({ page }) => {
  await fakeAI(page);
  await page.evaluate(() => {
    window.FitSync.ask = async o => {
      window.__asked.push(o);
      if (/envase/.test(o.message)) return JSON.stringify({ name: 'Galletas de avena', brand: 'Marca X', per100: { kcal: 452, p: 7.1, c: 64.3, g: 18.2 }, portion_g: 30, ok: true });
      return JSON.stringify({ dish: 'Arroz con pollo', confidence: 'alta', items: [{ name: 'Arroz blanco', id: null, grams: 200, kcal100: 130, p100: 2.7, c100: 28, g100: 0.3 }, { name: 'Pollo', id: 'pollo', grams: 150 }] });
    };
  });
  const png = { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') };
  // Crear alimento: la etiqueta se lee con IA (no con el lector del teléfono)
  await page.click('[data-view=comidas]');
  await page.click('#newFood');
  await page.setInputFiles('#cfPhoto', png);
  await expect(page.locator('#cfStatus')).toContainText('Leí la etiqueta con IA');
  await expect(page.locator('#cfKcal')).toHaveValue('452');
  await expect(page.locator('#cfP')).toHaveValue('7.1');
  await expect(page.locator('#cfPor')).toHaveValue('30');
  await expect(page.locator('#cfName')).toHaveValue('Galletas de avena Marca X');
  expect(await page.evaluate(() => window.__asked.at(-1).system)).toContain('columna de 100 g');
  await page.click('.modal-x');
  // Producto que no está en Open Food Facts: se crea con fotos y queda con su código
  await page.route('https://world.openfoodfacts.org/**', r => r.fulfill({ json: { status: 0 } }));
  await page.click('#scanBtn');
  await page.fill('#scanCode', '7801234567890');
  await page.click('#scanSearch');
  await page.click('#offAI');
  await page.setInputFiles('#apPhotos', [png, png]);
  await expect(page.locator('#apName')).toHaveValue('Galletas de avena');
  expect(await page.evaluate(() => [].concat(window.__asked.at(-1).image).length)).toBe(2);
  await page.click('#apSave');
  const f = (await state(page)).customFoods.find(x => x.id === 'off_7801234567890');
  expect(f).toMatchObject({ name: 'Galletas de avena', kcal: 452, p: 7.1, por: 30, cat: 'Escaneados' });
  await page.click('.modal-x');
  // La foto del plato aprende: la IA recibe tus porciones habituales y tus combos
  await page.evaluate(() => {
    for (let i = 1; i <= 3; i++) state.days[shiftKey(todayKey(), -i)].foods.push({ id: 'r' + i, name: 'Arroz blanco', grams: 180, meal: 'almuerzo', kcal: 234, p: 5, c: 50, g: 1 });
    state.combos.push({ id: 'c1', name: 'Mi desayuno', items: [{ name: 'Huevo', grams: 100, kcal: 155, p: 13, c: 1, g: 11 }] });
    save();
  });
  await page.click('#aiPhoto');
  await page.setInputFiles('#afPhoto', png);
  await expect(page.locator('.ai-item')).toHaveCount(2);
  const sys = await page.evaluate(() => window.__asked.at(-1).system);
  expect(sys).toContain('PORCIONES HABITUALES');
  expect(sys).toContain('Arroz blanco ~180 g (3 veces)');
  expect(sys).toContain('Mi desayuno: Huevo 100 g');
  // Antes y después: la foto de lo que sobró viaja junto a la del plato servido
  await page.setInputFiles('#aiLeft', png);
  await expect(page.locator('.ai-total')).toContainText('descontando lo que sobró');
  const last = await page.evaluate(() => window.__asked.at(-1));
  expect([].concat(last.image)).toHaveLength(2);
  expect(last.message).toContain('lo que SOBRÓ');
  expect(last.message).toContain('"name":"Arroz blanco","grams":200');
  await expect(page.locator('#aiLeft')).toHaveCount(0); // ya se descontó
});

test('Respaldos: crear, recuperar lo que falta sin borrar y volver exactamente a una copia', async ({ page }) => {
  // Nube simulada: la lista y las copias viven en memoria de la página
  await page.evaluate(() => {
    for (const [k, v] of [['enabled', true], ['user', { name: 'x', email: 'yo@mail.com' }], ['status', 'Sincronizado ✓']]) Object.defineProperty(window.FitSync.state, k, { get: () => v, set() {}, configurable: true });
    const store = [];
    window.FitSync.backups = {
      list: async () => store.map(b => b.meta).sort((a, b) => b.created - a.created),
      create: async reason => { const st = JSON.parse(JSON.stringify(state)); const meta = { id: 'b' + store.length, created: Date.now() + store.length, reason, days: Object.keys(st.days).length, foods: 0, workouts: st.workouts.length, chunks: 1 }; store.push({ meta, st }); return meta; },
      load: async id => JSON.parse(JSON.stringify(store.find(b => b.meta.id === id).st)),
    };
    window.__bk = store;
  });
  await page.click('.hello [data-go=perfil]');
  await page.click('#syncBk');
  await page.click('#bkNew');
  await expect(page.locator('.bk-item')).toHaveCount(1);
  await expect(page.locator('.bk-item')).toContainText('Manual');
  // Después del respaldo se pierde un día y se anota algo nuevo
  const k = await page.evaluate(() => { const ks = Object.keys(state.days).sort(); delete state.days[ks[0]]; state.days[todayKey()].foods.push({ id: 'nuevo', name: 'Nuevo', kcal: 100, p: 1, c: 1, g: 1, meal: 'snack' }); save(); return ks[0]; });
  await page.click('[data-bk=b0]');
  await page.click('#rsMerge');
  await expect(page.locator('#toast')).toContainText('recuperé 1 días');
  let s = await state(page);
  expect(s.days[k]).toBeTruthy();
  expect((await today(page)).foods.some(f => f.id === 'nuevo')).toBe(true); // no se borró lo nuevo
  expect(await page.evaluate(() => window.__bk.map(b => b.meta.reason))).toEqual(['manual', 'antes de restaurar']);
  // Volver exactamente: lo nuevo se quita
  await page.click('#syncBk');
  await page.click('[data-bk=b0]');
  await page.click('#rsExact');
  await expect(page.locator('#toast')).toContainText('volvieron a esa copia');
  expect((await today(page)).foods.some(f => f.id === 'nuevo')).toBe(false);
  // Y la copia de "antes de restaurar" permite deshacerlo
  await page.click('#syncBk');
  await expect(page.locator('.bk-item')).toHaveCount(3);
  await expect(page.locator('.bk-item').first()).toContainText('Antes de restaurar');
});

// Toque simulado (deslizar) con eventos táctiles reales del navegador
async function swipe(page, selector, dx, dy) {
  await page.evaluate(([sel, dx, dy]) => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + 10;
    const t = (cx, cy) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(x, y)], changedTouches: [t(x, y)] }));
    for (let i = 1; i <= 5; i++) el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(x + dx * i / 5, y + dy * i / 5)], changedTouches: [t(x + dx * i / 5, y + dy * i / 5)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(x + dx, y + dy)] }));
  }, [selector, dx, dy]);
}

test('UX: navegación con Comidas (recetas, plan y compras dentro), Coach y Perfil en el avatar', async ({ page }) => {
  await expect(page.locator('.nav [data-view]')).toHaveText(['Hoy', 'Comidas', 'Entrenar', 'Coach', 'Progreso', 'Perfil']);
  await page.click('[data-view=comidas]');
  await expect(page.locator('[data-tab-com]')).toHaveText(['Registrar', 'Recetas', 'Plan', 'Compras']);
  await page.click('[data-tab-com=recetas]');
  await expect(page.locator('#recSearch')).toBeVisible();
  // Los enlaces antiguos a "recetas" llegan a Comidas → Recetas
  await page.evaluate(() => go('recetas'));
  await expect(page.locator('[data-tab-com=recetas]')).toHaveClass(/active/);
  await expect(page.locator('.nav [data-view=comidas]')).toHaveClass(/active/);
  await page.click('[data-view=coach]');
  await expect(page.locator('.coach-page #cMsg')).toBeVisible();
  await expect(page.locator('#fab')).toBeHidden(); // en el chat no tapa el campo de texto
  await page.click('.page-head [data-go=perfil]');
  await expect(page.locator('#saveProfile')).toBeVisible();
});

test('UX: botón ＋ (agua, peso, buscar) y buscador global', async ({ page }) => {
  const w0 = (await today(page)).water;
  await page.click('#fab');
  await expect(page.locator('.qa-tile')).toHaveCount(8);
  await page.click('[data-qa=agua]');
  expect((await today(page)).water).toBe(w0 + 1);
  await page.click('#fab');
  await page.click('[data-qa=peso]');
  await page.fill('#wqKg', '79.4');
  await page.click('#wqSave');
  expect((await state(page)).weights.at(-1)).toMatchObject({ kg: 79.4 });
  await page.click('#fab');
  await page.click('[data-qa=buscar]');
  await expect(page.locator('#foodSearch')).toBeFocused();
  // Buscador global: secciones, alimentos y recetas
  await page.click('[data-view=hoy]');
  await page.click('#gSearch');
  await page.fill('#gsQ', 'compras');
  await page.click('[data-gs-place]');
  await expect(page.locator('[data-tab-com=compras]')).toHaveClass(/active/);
  await page.click('[data-view=hoy]');
  await page.click('#gSearch');
  await page.fill('#gsQ', 'avena');
  await expect(page.locator('[data-gs-food]').first()).toBeVisible();
  await expect(page.locator('[data-gs-rec]').first()).toBeVisible();
  await page.click('[data-gs-food]');
  await expect(page.locator('#addFood')).toBeVisible(); // abre la hoja del alimento
});

test('UX: Hoy con "Te toca", tarjetas personalizables, avisos agrupados y consejo de primer uso', async ({ page }) => {
  // Primer uso: un consejo que se va con "Entendido" y no vuelve
  await expect(page.locator('.first-tip')).toContainText('Toca ＋');
  await page.click('[data-first-ok]');
  await page.reload();
  await expect(page.locator('.first-tip')).toHaveCount(0);
  // Te toca: ✓ Comí esto lo anota en esa comida
  await expect(page.locator('.toca')).toBeVisible();
  const name = await page.locator('.toca .toca-main b').textContent();
  await page.click('.toca [data-toca-swap]');
  const name2 = await page.locator('.toca .toca-main b').textContent();
  expect(name2).not.toBe(name);
  const meal = await page.getAttribute('.toca [data-log-recipe]', 'data-meal');
  const n0 = (await today(page)).foods.length;
  await page.click('.toca [data-log-recipe]');
  const fs = (await today(page)).foods;
  expect(fs.length).toBeGreaterThan(n0);
  expect(fs.at(-1).meal).toBe(meal);
  // Personalizar: ocultar el agua y subir los macros al principio
  await page.click('#hoyEdit');
  await page.uncheck('[data-he-on=agua]');
  for (let i = 0; i < 2; i++) await page.click('.he-row:has([data-he-on=macros]) [data-he-up]');
  await page.click('#heSave');
  await expect(page.locator('.water-card')).toHaveCount(0);
  await expect(page.locator('.hoy-cards > .card').first()).toContainText('Macros del día');
  await page.click('#hoyEdit');
  await page.click('#heReset');
  await expect(page.locator('.water-card')).toHaveCount(1);
  // Avisos: el primero visible y el resto agrupado
  await page.evaluate(() => { state.days[todayKey()].water = 0; save(); render(); });
  const nn = await page.locator('.nudge').count();
  if (nn > 1) await expect(page.locator('.nudge-more summary')).toContainText('para hoy');
});

test('UX: Entrenar estilo Hevy: empezar, ✓ por serie con descanso, entrenamiento en curso, repetir e historial', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await expect(page.locator('[data-tab-rut=rutina]')).toHaveText(/Entrenar/);
  // Historial con el último entrenamiento y su detalle
  await expect(page.locator('[data-hist]').first()).toBeVisible();
  await page.click('[data-hist]');
  await expect(page.locator('.modal')).toContainText('Press de Banca con Barra');
  await page.click('.modal-x');
  // Empezar: registro del gym con ✓ por serie
  await page.click('#startEmpty');
  await page.fill('#gQ', 'press banca barra');
  await page.click('[data-gp="bench-press"]');
  await page.click('#gDone');
  await page.click('[data-gs-done="0:0"]');
  await expect(page.locator('.gym-set').nth(1)).toHaveClass(/done/); // nth(0) es el encabezado
  await expect(page.locator('.gym-rest')).toContainText('Descanso');
  await expect(page.locator('#gEl')).toBeVisible();
  // Al cerrar queda la barra "Entrenamiento en curso" para volver
  await page.click('.modal-x');
  await expect(page.locator('#wbar')).toBeVisible();
  await expect(page.locator('#wbar')).toContainText('Entrenamiento en curso');
  await page.click('#wbar');
  await expect(page.locator('.gym-set.done')).toHaveCount(1);
  await page.click('#gSave');
  await expect(page.locator('#wbar')).toBeHidden();
  // Repetir el último: carga los mismos ejercicios
  await page.click('[data-repeat-w]');
  await expect(page.locator('.gym-ex')).toHaveCount(1);
  await expect(page.locator('.gym-ex')).toContainText('Press de Banca con Barra');
});

test('UX: deslizar para borrar un alimento y para cerrar una ventana', async ({ page }) => {
  const id = await page.getAttribute('[data-edit-food]', 'data-edit-food');
  await swipe(page, `[data-edit-food="${id}"]`, -160, 0);
  expect((await today(page)).foods.some(f => f.id === id)).toBe(false);
  await expect(page.locator('.toast-undo')).toBeVisible();
  await page.click('#fab');
  await expect(page.locator('.modal')).toBeVisible();
  await swipe(page, '.modal h2', 0, 200);
  await expect(page.locator('.modal')).toHaveCount(0);
});

test('PC: Registrar y Buscar en la barra lateral, calendario en una fila y Hoy en dos columnas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#fab')).toBeHidden();
  await page.click('#navAdd');
  await expect(page.locator('.qa-tile')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await page.click('#navFind');
  await page.fill('#gsQ', 'compras');
  await expect(page.locator('[data-gs-place]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  const strip = await page.locator('.weekstrip').boundingBox();
  expect(strip.height).toBeLessThan(120);
  expect(await page.locator('.hoy-cards').evaluate(e => getComputedStyle(e).columnCount)).toBe('2');
  // Con el zoom, la barra lateral calza justo con la pantalla
  const nav = await page.locator('.nav').boundingBox();
  expect(nav.height).toBeLessThanOrEqual(901);
});

// Simula la app Android: Capacitor con el plugin Health (Health Connect) y datos de un reloj
async function fakeAndroid(page, opts = {}) {
  await page.addInitScript(o => {
    const now = new Date();
    const at = (h, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d.toISOString(); };
    window.__hc = { asked: null, reads: 0 };
    const samples = {
      heartRate: [{ value: 62 }, { value: 88 }, { value: 140 }],
      restingHeartRate: [{ value: 58 }],
      oxygenSaturation: [{ value: 97 }, { value: 95 }],
      weight: [{ value: 79.6 }],
      sleep: [{ value: 450, stages: [{ stage: 'light', durationMinutes: 240 }, { stage: 'deep', durationMinutes: 90 }, { stage: 'rem', durationMinutes: 80 }, { stage: 'awake', durationMinutes: 20 }] }],
    };
    const sums = { steps: 8432, distance: 6100, calories: 512 };
    // Registros sueltos (como los escribe Mi Fitness): el reloj y, aparte, el teléfono con menos pasos
    if (o.records) {
      samples.steps = [{ value: 5000, sourceId: 'com.mi.health' }, { value: 3432, sourceId: 'com.mi.health' }, { value: 1200, sourceId: 'android' }];
      samples.totalCalories = [{ value: 1500, sourceId: 'com.mi.health' }, { value: 880, sourceId: 'com.mi.health' }];
    }
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Health: {
          isAvailable: async () => ({ available: true }),
          requestAuthorization: async o => { window.__hc.asked = o; return { readAuthorized: o.read, readDenied: [] }; },
          queryAggregated: async q => {
            window.__hc.reads++;
            if (q.dataType === 'totalCalories') throw new Error('Unsupported data type for aggregation'); // como el plugin real
            return { samples: o.records ? [] : [{ value: sums[q.dataType] || 0 }] };
          },
          checkAuthorization: async q => ({ readAuthorized: q.read, readDenied: [] }),
          readSamples: async o => ({ samples: (samples[o.dataType] || []).map(s => ({ ...s, startDate: at(7), endDate: at(8) })) }),
          queryWorkouts: async () => ({ workouts: [{ workoutType: 'running', duration: 1800, totalEnergyBurned: 310, totalDistance: 5200, startDate: at(7), endDate: at(7, 30), platformId: 'w1' }] }),
          openHealthConnectSettings: async () => {},
        },
      },
    };
  }, opts);
  await page.reload();
}

test('Reloj (app Android): conectar, ver los datos en Hoy, importar entrenamiento y peso una sola vez', async ({ page }) => {
  await fakeAndroid(page);
  await page.evaluate(() => { const s = window.__fitplan.get(); const z = n => String(n).padStart(2, '0'); const d = new Date(); const k = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; s.weights = s.weights.filter(w => w.d !== k); window.__fitplan.replace(s); });
  await page.reload();
  await page.click('.watch-card [data-watch=connect]');
  await expect(page.locator('.watch-minis .mini')).toHaveCount(6);
  await expect(page.locator('.watch-card')).toContainText('8432');
  await expect(page.locator('.watch-card')).toContainText('6 h 50');
  expect(await page.evaluate(() => window.__hc.asked.read)).toContain('workouts');
  const t = await today(page);
  expect(t.watch.steps).toBe(8432);
  expect(t.watch.hr).toEqual({ avg: 97, min: 62, max: 140 });
  const run = t.exercises.find(e => e.id === 'hc-w1');
  expect(run.kcal).toBe(310);
  expect(run.minutes).toBe(30);
  expect((await state(page)).weights.some(w => w.kg === 79.6)).toBe(true);
  // Si lo borro, no vuelve a aparecer al leer otra vez
  await page.evaluate(() => { const s = window.__fitplan.get(); const z = n => String(n).padStart(2, '0'); const d = new Date(); const k = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; s.days[k].exercises = s.days[k].exercises.filter(e => e.id !== 'hc-w1'); window.__fitplan.replace(s); });
  await page.reload();
  await page.click('.watch-card [data-watch=sync]');
  await expect(page.locator('.toast')).toContainText('Reloj actualizado');
  expect((await today(page)).exercises.some(e => e.id === 'hc-w1')).toBe(false);
  // Perfil: opciones del reloj
  await page.click('#avatarBtn');
  await expect(page.locator('[data-watch=sync7]')).toBeVisible();
});

test('Reloj en el PC/web: sin app Android no muestra la tarjeta vacía y Perfil ofrece descargar la APK', async ({ page }) => {
  await expect(page.locator('.watch-card')).toHaveCount(0);
  await page.click('#avatarBtn');
  await expect(page.locator('a[href*="releases/download/android/FitPlan.apk"]')).toBeVisible();
});

test('Reloj: si Health Connect no suma rápido, cuenta los registros sin duplicar fuentes y usa las calorías totales', async ({ page }) => {
  await fakeAndroid(page, { records: true });
  await page.click('.watch-card [data-watch=connect]');
  await expect(page.locator('.watch-card')).toContainText('8432');
  await expect(page.locator('.watch-card')).toContainText('kcal totales');
  const w = (await today(page)).watch;
  expect(w.steps).toBe(8432); // del reloj; no suma los 1200 del teléfono encima
  expect(w.total).toBe(2380);
  expect(w.last).toBeTruthy();
  await page.click('#avatarBtn');
  await page.click('[data-watch=diag]');
  await expect(page.locator('.modal')).toContainText('suma 9632');
  await expect(page.locator('.modal')).toContainText('Calorías totales');
});
