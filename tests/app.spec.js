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
  await page.click('[data-view=recetas]');
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
  await page.click('[data-tab-rec=plan]');
  await page.click('#genPlan');
  await page.click('[data-tab-rec=compras]');
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
  await page.click('[data-view=recetas]');
  await page.click('[data-tab-rec=plan]');
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
