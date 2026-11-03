// La línea «pasa / no pasa» de la portada: una cinta lleva una pieza por cada
// prueba de la última corrida de cada suite; un calibre la mide; las que pasan
// siguen a la caja del final y las que fallan se desvían a la bandeja roja.
//
// Se dibuja aquí, al construir, con el kit de la skill «anatomy»
// (public/anatomy/iso-kit.mjs, licencia MIT); en el navegador solo se mueve
// (public/linea.js). Las pruebas, sus títulos y su resultado salen de
// data/corridas/: nada de lo que muestra se escribe a mano.
//
// Con azimut 38, +x baja a la derecha y +y baja a la izquierda: la cinta corre
// hacia quien mira, la bandeja queda del lado que se ve y los postes del frente
// se pintan después de las piezas, que pasan entre ellos.

import * as k from "./public/anatomy/iso-kit.mjs";

const W = 640;
const H = 400;
const PLATE = { x: -180, y: -46, w: 350, d: 116, r: 8 };
const BELT = { x0: -160, x1: 120, y: 13, z: 40 }; // y: media anchura de la cinta
const GATE_X = -40;
const DIVERT_X = 30;
const TRAY = { x: DIVERT_X - 16, y: 34, w: 34, d: 24, r: 2 };
const TRAY_Z = 18;
const BOX = { x: 112, y: -22, w: 44, d: 44, r: 2 };
const BOX_H = 26;
const PIECE = 11;
const PIEZAS = 9;
const CORTO = { "portafolio-e2e": "e2e", "api-torneo": "api", "red-dns": "dns", "lab-red": "lab" };

const TEXTOS = {
  es: {
    titulo: "Línea pasa / no pasa",
    pista: "Toca o haz clic: siguiente suite",
    etiqueta: "Línea de control de calidad: Enter o las flechas cambian de suite",
    claves: ["El calibre: mide cada pieza", "La bandeja: las pruebas que fallaron"],
    pie: "Cada pieza es una prueba real de la última corrida de cada suite. El calibre la mide: si pasa, sigue a la caja; si falla, se desvía a la bandeja roja. La caja marca cuántas pasaron en esa corrida.",
    pasa: "pasa",
    falla: "falla",
    de: "de",
    proyecto: { desktop: "escritorio", mobile: "teléfono" },
  },
  en: {
    titulo: "Pass / fail line",
    pista: "Click or tap: next suite",
    etiqueta: "Quality control line: Enter or the arrow keys switch suites",
    claves: ["The gauge: measures every piece", "The tray: the tests that failed"],
    pie: "Each piece is a real test from each suite's latest run. The gauge measures it: if it passes, it moves on to the box; if it fails, it's pushed off into the red tray. The box shows how many passed in that run.",
    pasa: "passed",
    falla: "failed",
    de: "of",
    proyecto: { desktop: "desktop", mobile: "phone" },
  },
};

const P = k.fitProjection([...k.boxCorners(PLATE, -15, 0), [GATE_X, -24, 84], [BELT.x0, 0, 60]], W, H, { pad: 22, azimuth: 38 });
const at = (p) => k.iso(p, P);
const S = (p, s) => k.solidSvg(p, s);
const L = (d, s) => k.lineSvg(d, s);
const D = (pts, s) => k.dotsSvg(pts, s);
const depth = (x, y) => k.depthOf([x, y, 0], P);

function mesa() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
  for (const [x, y] of k.corners(PLATE, 22).sort((a, b) => depth(...a) - depth(...b))) {
    out.push(S(k.cylinder(x, y, 7, -15, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -13.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 13, w: 140, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  return out.join("");
}
function patas() {
  const out = [];
  for (const x of [BELT.x0 + 14, BELT.x1 - 14]) for (const y of [-BELT.y - 4, BELT.y + 4]) out.push(S(k.slabOf({ x: x - 3, y: y - 3, w: 6, d: 6, r: 1 }, 0, BELT.z - 6, P, 2, 0.4), { tone: "mid" }));
  return out.join("");
}
// Larguero de un lado de la cinta; el del frente lleva sus tornillos.
function bastidor(lado) {
  const y = lado < 0 ? -BELT.y - 5 : BELT.y + 1;
  const out = [S(k.slabOf({ x: BELT.x0 - 4, y, w: BELT.x1 - BELT.x0 + 8, d: 4, r: 0.8 }, BELT.z - 7, 9, P, 2, 0.4), { tone: "mid" })];
  if (lado > 0) out.push(D([BELT.x0 + 4, BELT.x0 + 70, BELT.x0 + 140, BELT.x0 + 210, BELT.x1 - 4].map((x) => at([x, y + 4, BELT.z - 2.5])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
// La cinta, con sus tablillas de borde a borde.
function cinta() {
  const out = [S(k.slabOf({ x: BELT.x0, y: -BELT.y, w: BELT.x1 - BELT.x0, d: BELT.y * 2, r: 6 }, BELT.z - 4, 4, P, 6, 0), { tone: "lo", crease: "lo" })];
  const marcas = [];
  for (let x = BELT.x0 + 8; x < BELT.x1 - 6; x += 7) marcas.push(k.lineOnTop([x, -BELT.y], [x, BELT.y], BELT.z, P));
  out.push(L(marcas.join(""), { tone: "faint" }));
  return out.join("");
}
const poste = (lado) => S(k.slabOf({ x: GATE_X - 4, y: lado < 0 ? -BELT.y - 12 : BELT.y + 5, w: 8, d: 7, r: 1 }, 0, 80, P, 2, 0.5), { tone: "mid" });
function portalArriba() {
  const out = [S(k.slabOf({ x: GATE_X - 6, y: -BELT.y - 13, w: 12, d: BELT.y * 2 + 26, r: 1.5 }, 80, 7, P, 3, 0.5), { tone: "mid" })];
  out.push(D([-BELT.y - 9, BELT.y + 9].map((y) => at([GATE_X, y, 87])), { size: 0.5 }));
  out.push(S(k.cylinder(GATE_X, 0, 5, 72, 8, P, 28, 0.4), { tone: "mid" }));
  return out.join("");
}
// La mordaza del calibre: vástago y pie; baja hasta tocar la pieza que pasa.
function calibre() {
  return S(k.cylinder(GATE_X, 0, 1.8, 58, 16, P, 16), { tone: "hi", crease: "none", lit: true }) + S(k.slabOf({ x: GATE_X - 7, y: -7, w: 14, d: 14, r: 1 }, 54, 4, P, 2, 0.4), { tone: "hi", lit: true });
}
function bandeja() {
  return S(k.slabOf({ x: TRAY.x + 8, y: TRAY.y + 8, w: 6, d: 6, r: 1 }, 0, TRAY_Z, P, 2, 0.3), { tone: "mid" }) + S(k.slabOf(TRAY, TRAY_Z, 2, P, 3, 0.4), { tone: "lo" });
}
// Las paredes de la bandeja, que tapan el pie de las piezas que caen en ella.
function bandejaFrente() {
  const out = [`<path class="iso-line" d="${k.planOutline(TRAY, TRAY_Z + 7, P, 3)}"/>`];
  // Las aristas salen del arco de cada esquina redondeada (a r·(1 − 1/√2) del borde), no de la esquina cuadrada.
  for (const [x, y] of k.corners(TRAY, TRAY.r * (1 - Math.SQRT1_2))) out.push(`<path class="iso-line" d="${k.segment([x, y, TRAY_Z + 2], [x, y, TRAY_Z + 7], P)}"/>`);
  return `<g class="ln-bandeja">${out.join("")}</g>`;
}
function caja(pasadas) {
  const out = [S(k.slabOf(BOX, 0, BOX_H, P, 3, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(BOX, 3), BOX_H, P, 3), { tone: "lo" }));
  out.push(`<g class="ln-caja">${k.faceTextSvg(k.sideMatrix([BOX.x + BOX.w, BOX.y + BOX.d - 6], 10, P, "right"), String(pasadas).padStart(3, "0"), { size: 9, tone: "hi" })}</g>`);
  return out.join("");
}

// Las pruebas de la última corrida de cada suite, sin las omitidas, en el orden en que corrieron.
function pruebasDe(r, t) {
  return (r?.pruebas ?? [])
    .filter((p) => p.estado === "pasa" || p.estado === "falla" || p.estado === "inestable")
    .map((p) => [p.titulo + (p.proyecto ? ` · ${t.proyecto[p.proyecto] ?? p.proyecto}` : ""), p.estado === "falla" ? 0 : 1]);
}

export function linea({ suites, datos, idioma }) {
  const t = TEXTOS[idioma];
  const lista = suites
    .filter((s) => datos[s.id].at(-1)?.pruebas?.length)
    .map((s) => {
      const u = datos[s.id].at(-1);
      const pruebas = pruebasDe(u, t);
      // La gira empieza unas piezas antes del primer fallo, para que se vea.
      const fallo = pruebas.findIndex((p) => p[1] === 0);
      return { nombre: s.nombre[idioma], corto: CORTO[s.id] ?? s.id, pasadas: u.pasadas, inicio: fallo > 3 ? fallo - 3 : 0, pruebas };
    });
  const piezas = Array.from({ length: PIEZAS }, (_, i) => `<g class="ln-pieza" data-pieza="${i}" visibility="hidden">${S(k.slabOf({ x: -PIECE / 2, y: -PIECE / 2, w: PIECE, d: PIECE, r: 1.2 }, 0, 9, P, 2, 0.5), { tone: "hi" })}</g>`).join("");
  const svg = k.figureSvg({
    width: W,
    height: H,
    label: t.pie,
    body: [
      mesa(),
      caja(lista[0]?.pasadas ?? 0),
      patas(),
      bastidor(-1),
      poste(-1),
      bandeja(),
      cinta(),
      `<g class="ln-piezas">${piezas}</g>`,
      bastidor(1),
      bandejaFrente(),
      poste(1),
      `<path class="ln-luz" d="${k.sideRing([GATE_X + 4, BELT.y + 8.5, 66], 2.2, "x", P)}"/>`,
      `<g data-mueve="calibre">${calibre()}</g>`,
      portalArriba(),
    ],
  });
  const vivo = { P, B: BELT, GATE_X, DIVERT_X, TRAY, TRAY_Z, BOX_H, suites: lista, textos: { pasa: t.pasa, falla: t.falla, de: t.de } };
  const placa = k.plateHtml({
    fig: "",
    title: t.titulo,
    hint: t.pista,
    readout: lista[0]?.nombre ?? "",
    keys: [
      { mark: "lit", label: t.claves[0] },
      { mark: "red", label: t.claves[1] },
    ],
    caption: t.pie,
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="${t.etiqueta}">${svg}</div><p class="ln-titulo" aria-live="polite"></p>`,
  });
  // En el mismo bisel que las tarjetas de las suites, para que se vea de la familia.
  const json = JSON.stringify(vivo).replace(/&/g, "&amp;").replace(/'/g, "&#39;");
  return `<section class="linea bisel" aria-label="${t.titulo}" data-linea='${json}'><div class="placa"><div class="iso" data-theme="light">${placa}</div></div></section>`;
}

export const ISO_CSS = k.ISO_CSS;
