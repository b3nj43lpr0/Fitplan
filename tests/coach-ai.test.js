// Lógica de FitSync.ask con una IA falsa: reintentos, cambio de modelo, App Check y límite de espera (node tests/coach-ai.test.js)
const vm = require('vm'), fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
function load() {
  const win = { FIREBASE_CONFIG: null, __fitplan: { get: () => ({}), replace() {} }, addEventListener() {} };
  const ctx = { window: win, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, console, Math, JSON, Date, Promise, Error, String };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const api = win.FitSync;
  api._test.inject({ app: {} });
  api._test.setUser({ email: 'x' });
  return api;
}
// behaviour(model, cfg) → { throws } | { chunks: [...] } | { hang: true }
function fakeAI(behaviour, calls) {
  return {
    getAI: () => ({}), GoogleAIBackend: function () {},
    getGenerativeModel: (ai, params, opts) => ({
      startChat: () => ({
        sendMessageStream: async () => {
          calls.push(params.model + (params.generationConfig.thinkingConfig ? '+low' : ''));
          const b = behaviour(params.model, params.generationConfig);
          if (b.throws) throw new Error(b.throws);
          if (b.hang) return new Promise(() => {});
          return { stream: (async function* () { for (const c of b.chunks) yield { text: () => { if (c === null) throw new Error('sin texto'); return c; } }; })() };
        },
      }),
    }),
  };
}
let bad = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) bad++; };
(async () => {
  let calls = [], api = load();
  api._test.injectAI(fakeAI(() => ({ chunks: [null, 'Hola', ' Benja'] }), calls));
  let got = [];
  const r1 = await api.ask({ message: 'x', system: 's', onChunk: t => got.push(t) });
  ok(r1 === 'Hola Benja' && got.at(-1) === 'Hola Benja' && calls[0] === 'gemini-3.8-flash+low', 'usa gemini-3.8-flash pensando poco e ignora fragmentos sin texto');

  calls = []; api = load();
  api._test.injectAI(fakeAI((m, cfg) => cfg.thinkingConfig ? { throws: '[400] thinking_level is not supported for this model' } : { chunks: ['ok'] }, calls));
  ok(await api.ask({ message: 'x' }) === 'ok' && calls.join() === 'gemini-3.8-flash+low,gemini-3.8-flash', 'si no acepta "pensar poco", reintenta el mismo modelo sin esa opción');

  calls = []; api = load();
  api._test.injectAI(fakeAI(m => m === 'gemini-3.8-flash' ? { throws: '[404] model not found' } : { chunks: ['desde 3.6'] }, calls));
  ok(await api.ask({ message: 'x' }) === 'desde 3.6' && calls[0] === 'gemini-3.8-flash+low' && calls.at(-1).startsWith('gemini-3.6-flash'), 'si un modelo no existe, pasa al siguiente');

  calls = []; api = load();
  api._test.injectAI(fakeAI(() => ({ throws: '[401 ] Firebase App Check token is invalid.' }), calls));
  try { await api.ask({ message: 'x' }); ok(false, 'App Check'); } catch (e) { ok(/App Check/.test(e.message) && calls.length === 1, 'App Check: se detiene al primer intento y devuelve el error'); }

  calls = []; api = load();
  api._test.injectAI(fakeAI(() => ({ hang: true }), calls));
  const t0 = Date.now();
  try { await api.ask({ message: 'x', timeoutMs: 100 }); ok(false, 'timeout'); } catch (e) { ok(e.code === 'timeout' && Date.now() - t0 < 7000, 'si la IA no responde, corta por tiempo en vez de quedar cargando'); }

  calls = []; api = load();
  api._test.injectAI(fakeAI(() => ({ chunks: [null] }), calls));
  try { await api.ask({ message: 'x' }); ok(false, 'vacía'); } catch (e) { ok(e.code === 'empty' || /vacía/.test(e.message), 'una respuesta sin texto cuenta como error'); }

  console.log(bad ? bad + ' fallas' : 'Todo bien');
  process.exit(bad ? 1 : 0);
})();
