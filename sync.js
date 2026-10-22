// Sincronización opcional con Firebase (Auth con Google + Firestore, plan Spark gratuito).
// Los datos se reparten en varios documentos para no chocar con el límite de 1 MB por documento:
//   users/{uid}/parts/base       → perfil, rutina, plan, alimentos y recetas propias, etc.
//   users/{uid}/parts/m2026-10   → días y entrenamientos de ese mes
// Cada documento es { data: <JSON de { unidad: valor }>, ts, dev }. Una "unidad" es un campo base (b:profile),
// un día (d:2026-10-21) o un entrenamiento (w:id). Se recuerda un hash de lo último sincronizado por unidad,
// así cada dispositivo sabe qué cambió él y qué cambió el otro, y fusiona por unidad en vez de pisar todo.
// Si las reglas de Firestore aún no permiten la subcolección, se usa el formato antiguo users/{uid}.
(function () {
  'use strict';
  const V = '12.19.0';
  const BASE = `https://www.gstatic.com/firebasejs/${V}/`;
  const cfg = window.FIREBASE_CONFIG;
  const listeners = new Set();
  const S = { enabled: !!cfg, user: null, status: cfg ? 'Sin iniciar sesión' : 'No configurada' };
  let fb = null, uid = null, legacy = false, pushTimer = null, applying = false, unsubs = [], synced = {};
  // Cada perfil del teléfono sincroniza en su propia colección: el primero en "parts", los demás en "parts_<id>"
  const pid = () => (window.__fitplan && window.__fitplan.profileId) || 'p1';
  const partsCol = () => pid() === 'p1' ? 'parts' : 'parts_' + pid();

  function emit() { listeners.forEach(f => { try { f(S); } catch (e) { /* ignorar */ } }); }
  function set(patch) { Object.assign(S, patch); emit(); }
  const getState = () => window.__fitplan.get();
  const ts = s => (s && s._ts) || 0;
  const dev = (() => {
    try { let d = localStorage.getItem('fitplan-dev'); if (!d) { d = Math.random().toString(36).slice(2); localStorage.setItem('fitplan-dev', d); } return d; } catch (e) { return 'x'; }
  })();

  // ---------- Unidades ----------
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
  }
  const hv = v => hash(JSON.stringify(v));
  function units(st) {
    const u = {};
    for (const k of Object.keys(st)) if (k !== 'days' && k !== 'workouts' && k !== '_ts') u['b:' + k] = st[k];
    for (const k of Object.keys(st.days || {})) u['d:' + k] = st.days[k];
    for (const w of st.workouts || []) u['w:' + w.id] = w;
    return u;
  }
  function docOf(u, v) {
    if (u[0] === 'b') return 'base';
    if (u[0] === 'd') return 'm' + u.slice(2, 9);
    return 'm' + String(v && v.d || '').slice(0, 7);
  }
  // Aplica un cambio de una unidad sobre una copia del estado (v undefined = borrar)
  function applyUnit(st, u, v) {
    const key = u.slice(2);
    if (u[0] === 'b') { if (v === undefined) delete st[key]; else st[key] = v; }
    else if (u[0] === 'd') { st.days = { ...st.days }; if (v === undefined) delete st.days[key]; else st.days[key] = v; }
    else {
      st.workouts = (st.workouts || []).filter(w => w.id !== key);
      if (v !== undefined) st.workouts.push(v);
      st.workouts.sort((a, b) => (a.d < b.d ? -1 : 1));
    }
  }
  const syncKey = () => 'fitplan-sync2-' + uid + (pid() === 'p1' ? '' : '-' + pid());
  function loadSynced() { try { return JSON.parse(localStorage.getItem(syncKey())); } catch (e) { return null; } }
  function storeSynced() { try { localStorage.setItem(syncKey(), JSON.stringify(synced)); } catch (e) { /* ignorar */ } }
  function replaceState(st) { applying = true; try { window.__fitplan.replace(st); } finally { applying = false; } }

  // Fusión para el primer inicio de sesión en un dispositivo con datos en ambos lados:
  // lo más reciente manda en los datos sueltos y se unen días, alimentos y registros por id.
  function merge(a, b) {
    const [newer, older] = ts(a) >= ts(b) ? [a, b] : [b, a];
    const out = { ...older, ...newer };
    const days = {};
    for (const k of new Set([...Object.keys(older.days || {}), ...Object.keys(newer.days || {})])) {
      const x = (older.days || {})[k], y = (newer.days || {})[k];
      if (!x || !y) { days[k] = y || x; continue; }
      const byId = (p, q) => { const m = new Map(); [...p, ...q].forEach(i => m.set(i.id || JSON.stringify(i), i)); return [...m.values()]; };
      days[k] = { ...x, ...y, foods: byId(x.foods || [], y.foods || []), exercises: byId(x.exercises || [], y.exercises || []), water: Math.max(x.water || 0, y.water || 0) };
    }
    out.days = days;
    const uniq = (p, q, key) => { const m = new Map(); [...(p || []), ...(q || [])].forEach(i => m.set(key(i), i)); return [...m.values()]; };
    out.customFoods = uniq(older.customFoods, newer.customFoods, i => i.id || i.name);
    out.weights = uniq(older.weights, newer.weights, i => i.d).sort((m, n) => (m.d < n.d ? -1 : 1));
    out.measures = uniq(older.measures, newer.measures, i => JSON.stringify(i));
    out.customRecipes = uniq(older.customRecipes, newer.customRecipes, i => i.id);
    out.customExercises = uniq(older.customExercises, newer.customExercises, i => i.id);
    out.challenges = uniq(older.challenges, newer.challenges, i => i.id + i.start);
    out.combos = uniq(older.combos, newer.combos, i => i.id);
    out.badges = [...new Set([...(older.badges || []), ...(newer.badges || [])])];
    out.favFoods = [...new Set([...(older.favFoods || []), ...(newer.favFoods || [])])];
    out.workouts = uniq(older.workouts, newer.workouts, i => i.id).sort((m, n) => (m.d < n.d ? -1 : 1));
    out._ts = Date.now();
    return out;
  }

  // ---------- Recibir un documento ----------
  // Por unidad: si este dispositivo no la tocó desde la última sincronización, se adopta la de la nube;
  // si la tocó, se mantiene la local (se enviará en el próximo push).
  function receive(docId, payload) {
    const cur = units(getState());
    const names = new Set(Object.keys(payload));
    for (const u of Object.keys(synced)) if (synced[u][1] === docId) names.add(u);
    for (const u of Object.keys(cur)) if (docOf(u, cur[u]) === docId) names.add(u);
    let st = null, dirty = false;
    for (const u of names) {
      const L = u in cur ? hv(cur[u]) : undefined;
      const Sh = synced[u] && synced[u][0];
      const R = u in payload ? hv(payload[u]) : undefined;
      if (L === Sh) {
        if (R !== L) { st = st || { ...getState() }; applyUnit(st, u, payload[u]); }
        if (R === undefined) delete synced[u]; else synced[u] = [R, docId];
      } else if (R === L) {
        if (R === undefined) delete synced[u]; else synced[u] = [R, docId];
      } else dirty = true;
    }
    storeSynced();
    if (st) replaceState(st);
    return dirty;
  }

  // ---------- Enviar ----------
  async function pushDoc(docId, cur) {
    const ref = fb.doc(fb.db, 'users', uid, partsCol(), docId);
    let final = null;
    await fb.runTransaction(fb.db, async tx => {
      const snap = await tx.get(ref);
      const remote = snap.exists() ? JSON.parse(snap.data().data) : {};
      const out = { ...remote };
      const names = new Set();
      for (const u of Object.keys(synced)) if (synced[u][1] === docId) names.add(u);
      for (const u of Object.keys(cur)) if (docOf(u, cur[u]) === docId) names.add(u);
      for (const u of names) {
        const L = u in cur ? hv(cur[u]) : undefined;
        if (L === (synced[u] && synced[u][0])) continue; // sin cambios locales: queda lo de la nube
        if (L === undefined) delete out[u]; else out[u] = cur[u];
      }
      tx.set(ref, { data: JSON.stringify(out), ts: Date.now(), dev });
      final = out;
    });
    // Lo enviado ya está sincronizado; lo que la nube tenía distinto se aplica localmente
    for (const u of Object.keys(final)) if (u in cur && hv(cur[u]) === hv(final[u])) synced[u] = [hv(final[u]), docId];
    for (const u of Object.keys(synced)) if (synced[u][1] === docId && !(u in final) && !(u in cur)) delete synced[u];
    receive(docId, final);
  }
  async function push() {
    if (!uid || applying) return;
    if (legacy) return pushLegacy();
    const cur = units(getState());
    const docs = new Set();
    for (const u of Object.keys(cur)) if (hv(cur[u]) !== (synced[u] && synced[u][0])) docs.add(docOf(u, cur[u]));
    for (const u of Object.keys(synced)) if (!(u in cur)) docs.add(synced[u][1]);
    if (!docs.size) { set({ status: 'Sincronizado ✓' }); return; }
    try {
      for (const d of docs) await pushDoc(d, cur);
      set({ status: 'Sincronizado ✓' });
    } catch (e) {
      set({ status: 'Sin conexión: se enviará después' });
      clearTimeout(pushTimer); pushTimer = setTimeout(push, 30000);
    }
  }
  function schedulePush() {
    if (!uid || applying) return;
    set({ status: 'Guardando…' });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1500);
  }

  // ---------- Inicio de sesión ----------
  async function start(user) {
    uid = user.uid;
    legacy = false;
    const col = fb.collection(fb.db, 'users', uid, partsCol());
    let parts;
    try {
      parts = await fb.getDocs(col);
    } catch (e) {
      if (e && e.code === 'permission-denied') {
        if (pid() === 'p1') return startLegacy();
        set({ status: 'Para sincronizar este perfil, actualiza las reglas de Firestore' });
        return;
      }
      set({ status: 'Sin conexión' });
      setTimeout(() => { if (uid === user.uid && !unsubs.length) start(user); }, 30000);
      return;
    }
    try {
      const remoteUnits = {}, where = {};
      parts.forEach(d => { const p = JSON.parse(d.data().data); for (const u of Object.keys(p)) { remoteUnits[u] = p[u]; where[u] = d.id; } });
      const stored = loadSynced();
      if (stored) {
        synced = stored;
        parts.forEach(d => receive(d.id, JSON.parse(d.data().data)));
      } else {
        // Primera vez en este dispositivo: se fusiona lo local con la nube (o con el formato antiguo)
        let remote = null;
        synced = {};
        if (parts.size) {
          remote = { days: {}, workouts: [] };
          for (const u of Object.keys(remoteUnits)) { applyUnit(remote, u, remoteUnits[u]); synced[u] = [hv(remoteUnits[u]), where[u]]; }
        } else if (pid() === 'p1') {
          const old = await fb.getDoc(fb.doc(fb.db, 'users', uid));
          if (old.exists()) remote = JSON.parse(old.data().data);
        }
        const local = getState();
        const hasLocal = local.profile || Object.keys(local.days || {}).length;
        if (remote) replaceState(hasLocal ? merge(local, remote) : remote);
        storeSynced();
      }
      await push();
    } catch (e) { set({ status: 'Error al sincronizar' }); }
    unsubs.push(fb.onSnapshot(col, snap => {
      let dirty = false;
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
        try { dirty = receive(ch.doc.id, JSON.parse(ch.doc.data().data)) || dirty; } catch (e) { /* documento inválido */ }
      });
      if (dirty) schedulePush();
    }, () => set({ status: 'Sin conexión' })));
  }

  // ---------- Formato antiguo (un solo documento), por si las reglas no permiten la subcolección ----------
  async function pushLegacy() {
    try {
      await fb.setDoc(fb.doc(fb.db, 'users', uid), { data: JSON.stringify(getState()), ts: ts(getState()) });
      set({ status: 'Sincronizado ✓ (actualiza las reglas de Firestore)' });
    } catch (e) { set({ status: 'Sin conexión: se enviará después' }); }
  }
  async function startLegacy() {
    legacy = true;
    const ref = fb.doc(fb.db, 'users', uid);
    try {
      const snap = await fb.getDoc(ref);
      if (snap.exists()) {
        const remote = JSON.parse(snap.data().data);
        const local = getState();
        const hasLocal = local.profile || Object.keys(local.days || {}).length;
        const merged = hasLocal && ts(local) !== ts(remote) && !localStorage.getItem('fitplan-synced-' + uid) ? merge(local, remote) : null;
        replaceState(merged || (ts(remote) >= ts(local) ? remote : local));
      }
      localStorage.setItem('fitplan-synced-' + uid, '1');
      await pushLegacy();
    } catch (e) { set({ status: 'Error al sincronizar (revisa las reglas de Firestore)' }); }
    unsubs.push(fb.onSnapshot(ref, snap => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      let remote;
      try { remote = JSON.parse(snap.data().data); } catch (e) { return; }
      if (ts(remote) > ts(getState())) replaceState(remote);
      else if (ts(remote) < ts(getState())) pushLegacy();
    }, () => set({ status: 'Sin conexión' })));
  }

  async function init() {
    if (!cfg) return;
    try {
      const [app, auth, fs] = await Promise.all([
        import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js'),
      ]);
      const a = app.initializeApp(cfg);
      fb = {
        app: a, auth: auth.getAuth(a), db: fs.getFirestore(a), doc: fs.doc, collection: fs.collection, getDoc: fs.getDoc, getDocs: fs.getDocs,
        setDoc: fs.setDoc, onSnapshot: fs.onSnapshot, runTransaction: fs.runTransaction,
        GoogleAuthProvider: auth.GoogleAuthProvider, signInWithPopup: auth.signInWithPopup, signOut: auth.signOut,
      };
      auth.onAuthStateChanged(fb.auth, u => {
        unsubs.forEach(f => f()); unsubs = [];
        if (u) { set({ user: { name: u.displayName, email: u.email }, status: 'Conectando…' }); start(u); }
        else { uid = null; set({ user: null, status: 'Sin iniciar sesión' }); }
      });
    } catch (e) { set({ status: 'No se pudo cargar (necesita internet)' }); }
  }
  window.addEventListener('online', () => { if (uid) schedulePush(); });

  // ---------- Coach con IA (Gemini mediante Firebase AI Logic, nivel gratuito) ----------
  // Se prueban modelos en orden por si alguno deja de estar disponible en el nivel gratis
  // Modelos gratuitos de Firebase AI Logic (octubre de 2026); si Google retira uno, se usa el siguiente
  const AI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  let aiMod = null;
  // Espera máxima por intento; si no llega nada, se avisa en vez de quedar cargando para siempre
  const AI_TIMEOUT = 45000;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => { const e = new Error('timeout: la IA tardó más de ' + ms / 1000 + ' s'); e.code = 'timeout'; rej(e); }, ms))]);
  // image: { data (base64), mimeType } para preguntar por una foto; json: la respuesta viene como JSON
  async function ask({ history = [], message, system, onChunk, image, json, maxTokens = 1024, timeoutMs = AI_TIMEOUT }) {
    if (!fb || !fb.app) { const e = new Error('offline'); e.code = 'offline'; throw e; }
    if (!S.user) { const e = new Error('auth'); e.code = 'auth'; throw e; }
    aiMod = aiMod || await import(BASE + 'firebase-ai.js');
    const ai = aiMod.getAI(fb.app, { backend: new aiMod.GoogleAIBackend() });
    const hist = history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }));
    // Pensar poco (LOW) responde mucho más rápido; si un modelo no acepta la opción, se reintenta sin ella
    const base = { maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) };
    const configs = [{ thinkingConfig: { thinkingLevel: 'LOW' }, ...base }, base];
    const msg = image ? [message, { inlineData: { data: image.data, mimeType: image.mimeType } }] : message;
    let lastErr = null;
    for (const model of AI_MODELS) {
      for (const generationConfig of configs) {
        try {
          const gm = aiMod.getGenerativeModel(ai, { model, systemInstruction: system, generationConfig }, { timeout: timeoutMs });
          const chat = gm.startChat({ history: hist });
          const run = async () => {
            const res = await chat.sendMessageStream(msg);
            let full = '';
            for await (const ch of res.stream) {
              let t = '';
              try { t = ch.text(); } catch (e) { t = ''; } // fragmentos sin texto (p. ej., solo "pensamiento")
              if (t) { full += t; if (onChunk) onChunk(full); }
            }
            if (!full) { const e = new Error('respuesta vacía'); e.code = 'empty'; throw e; }
            return full;
          };
          return await withTimeout(run(), timeoutMs + 5000);
        } catch (e) {
          lastErr = e;
          const m = String(e && e.message);
          // Permisos, App Check o cuota no se arreglan cambiando de modelo
          if (/permission|403|api.?key|quota|429|resource.?exhausted|billing|unauthenticated|401|app check/i.test(m)) throw e;
          if (e.code === 'timeout') throw e;
          // Si el problema fue la opción de pensamiento, se prueba la misma IA sin ella; si no, el siguiente modelo
          if (!/think/i.test(m)) break;
        }
      }
    }
    throw lastErr;
  }

  window.FitSync = {
    state: S,
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    notify: schedulePush,
    async signIn() {
      if (!fb) return;
      try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); }
      catch (e) { set({ status: 'No se pudo iniciar sesión' }); }
    },
    async signOut() { if (fb) await fb.signOut(fb.auth); },
    ask,
    _test: { inject: f => { fb = f; }, injectAI: m => { aiMod = m; }, setUser: u => { S.user = u; }, start, push, getSynced: () => synced },
  };
  init();
})();
