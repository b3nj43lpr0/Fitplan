// FitPlan · Leer la etiqueta nutricional con la cámara (OCR dentro del teléfono, sin enviar la foto)
'use strict';

// Convierte el texto de una etiqueta en { kcal, p, c, g, por } por 100 g.
// Las etiquetas chilenas traen columnas "100 g" y "1 porción"; si solo hay porción, se convierte.
function parseLabel(raw) {
  const text = norm(raw).replace(/(\d),(\d)/g, '$1.$2').replace(/[|]/g, ' ');
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const nums = l => (l.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const porM = text.match(/porcion[^\d\n]{0,25}(\d+(?:\.\d+)?)\s*(g|ml|gr)\b/);
  const por = porM ? Number(porM[1]) : null;
  // ¿La primera columna es 100 g? Se mira el encabezado de la tabla
  const head = lines.find(l => /100\s*(g|ml)/.test(l) && /porcion/.test(l));
  const firstIs100 = head ? head.search(/100\s*(g|ml)/) < head.search(/porcion/) : null;
  const pick = vals => {
    if (!vals.length) return null;
    if (vals.length === 1) return por && firstIs100 === false ? vals[0] * 100 / por : vals[0];
    const [a, b] = vals;
    if (firstIs100 === false && por) return a * 100 / por;
    if (firstIs100 === null && por && a > 0 && b > 0) {
      // Sin encabezado claro: la columna de 100 g es la que cumple a/b ≈ 100/porción
      const r = 100 / por;
      if (Math.abs(b / a - r) < Math.abs(a / b - r)) return b;
    }
    return a;
  };
  const find = (re, skip) => {
    const l = lines.find(x => re.test(x) && !(skip && skip.test(x)));
    if (!l) return null;
    // Se quita el nombre del nutriente y la unidad entre paréntesis para no confundir números
    const rest = l.replace(re, ' ').replace(/\((k?cal|g|mg|kj)\)/g, ' ');
    return pick(nums(rest));
  };
  let kcal = null;
  const eLine = lines.find(l => /energ|calor/.test(l));
  if (eLine) {
    const m = eLine.match(/(\d+(?:\.\d+)?)\s*kcal/g);
    if (m && m.length) kcal = pick(m.map(x => parseFloat(x)));
    else {
      const v = nums(eLine.replace(/energ\w*|calor\w*/, ' ').replace(/\((k?cal|kj)\)/g, ' '));
      // Si la línea trae kJ y kcal sin rotular, la kcal es la menor del par (1 kcal = 4,184 kJ)
      kcal = /kj/.test(eLine) && v.length >= 2 ? pick(v.filter((x, i) => i % 2 === 1)) : pick(v);
    }
  }
  const p = find(/prote\w*/);
  const g = find(/grasas?( totales?)?|lipidos?/, /saturad|trans|mono|poli/);
  const c = find(/h\.?\s*de\s*c\.?(\s*disp\w*\.?)?|hidratos?( de carbono)?( disponibles?)?|carbohidratos?( totales?)?/, /azucar/);
  const r = x => x === null || isNaN(x) ? null : Math.round(x * 10) / 10;
  return { kcal: r(kcal), p: r(p), c: r(c), g: r(g), por };
}
// Carga el lector solo cuando se usa (≈6 MB la primera vez; después queda guardado)
function loadOcr() {
  if (window.Tesseract) return Promise.resolve();
  if (!loadOcr.p) loadOcr.p = new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/tesseract/tesseract.min.js';
    sc.onload = ok;
    sc.onerror = () => { loadOcr.p = null; fail(); };
    document.head.appendChild(sc);
  });
  return loadOcr.p;
}
async function readLabel(file, onStatus) {
  await loadOcr();
  const base = new URL('vendor/tesseract/', location.href).href;
  const worker = await Tesseract.createWorker('spa', 1, {
    workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang',
    logger: m => { if (onStatus && m.status) onStatus(m.status === 'recognizing text' ? `Leyendo… ${Math.round(m.progress * 100)} %` : 'Preparando el lector…'); },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally { await worker.terminate(); }
}
