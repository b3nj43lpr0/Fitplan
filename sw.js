// Service worker: permite usar la app sin conexión una vez instalada
const CACHE = 'fitplan-v23';
// Imágenes de ejercicios, librería de Firebase y fuentes: no cambian, así que viven en su propia caché
// y sobreviven a las actualizaciones de la app
const STATIC = 'fitplan-static-v1';
const FILES = ['./', './index.html', './styles.css', './js/core.js', './js/hoy.js', './js/comidas.js', './js/etiqueta.js', './js/actividad.js', './js/recetas.js', './js/entrenar.js', './js/progreso.js', './js/perfil.js', './js/coach.js', './js/main.js', './sync.js', './firebase-config.js', './data.js', './foods.js', './exercises.js', './vendor/zxing.min.js', './manifest.json', './icon.svg'];
const IMMUTABLE = ['https://raw.githubusercontent.com/RepDB/', 'https://www.gstatic.com/firebasejs/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== STATIC).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Primero lo guardado; si no está, se descarga y se guarda
function cacheFirst(req) {
  return caches.open(STATIC).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') c.put(req, res.clone());
    return res;
  })));
}
// Red primero para recibir actualizaciones, pero si tarda más de 3 s (señal mala) se usa lo guardado
function networkFirst(req, cacheName) {
  return caches.open(cacheName).then(c => new Promise(resolve => {
    let done = false;
    const fallback = () => c.match(req, { ignoreSearch: req.mode === 'navigate' }).then(hit => { if (hit && !done) { done = true; resolve(hit); } return hit; });
    const timer = setTimeout(fallback, 3000);
    // no-cache: pregunta siempre al servidor si hay versión nueva (GitHub Pages deja los archivos 10 min en la caché del navegador)
    fetch(req, { cache: 'no-cache' }).then(res => {
      clearTimeout(timer);
      if (res.ok) c.put(req, res.clone());
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then(hit => { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  }));
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (IMMUTABLE.some(p => url.href.startsWith(p))) return e.respondWith(cacheFirst(e.request));
  if (url.origin === location.origin) return e.respondWith(networkFirst(e.request, CACHE));
  if (url.origin === 'https://fonts.googleapis.com') return e.respondWith(networkFirst(e.request, STATIC));
});
