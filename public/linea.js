// El movimiento de la línea «pasa / no pasa» de la portada (linea.mjs la dibuja
// al construir). Cada pieza es una prueba real: pasa bajo el calibre, que la
// mide; si pasó sigue a la caja, si falló se desvía a la bandeja roja. Cada 12
// piezas cambia de suite; un clic, Enter o las flechas la cambian a mano. Solo
// corre mientras se ve, y con «reducir movimiento» se queda quieta. El tema lo
// manda la página (data-tema).

import { translateAlong } from "/anatomy/iso-kit.mjs";

const raiz = document.querySelector("[data-linea]");
if (raiz) iniciar(raiz);

function iniciar(raiz) {
  const V = JSON.parse(raiz.dataset.linea);
  const { P, B, GATE_X, DIVERT_X, TRAY, TRAY_Z, BOX_H, suites, textos } = V;
  if (!suites.length) return;
  const figura = raiz.querySelector(".iso");
  const stage = raiz.querySelector(".iso-stage");
  const svg = stage.querySelector("svg");
  const nodos = [...svg.querySelectorAll("[data-pieza]")];
  const calibre = svg.querySelector('[data-mueve="calibre"]');
  const caja = svg.querySelector(".ln-caja text");
  const readout = raiz.querySelector("[data-readout]");
  const titulo = raiz.querySelector(".ln-titulo");
  const quieto = matchMedia("(prefers-reduced-motion: reduce)");

  // El tema de la página: claro, oscuro o el del sistema.
  const oscuro = matchMedia("(prefers-color-scheme: dark)");
  const tema = () => {
    const t = document.documentElement.dataset.tema;
    figura.dataset.theme = t === "oscuro" || (t !== "claro" && oscuro.matches) ? "dark" : "light";
  };
  tema();
  new MutationObserver(tema).observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  oscuro.addEventListener("change", tema);

  const VEL = 34, PASO = 32, POR_SUITE = 12;
  const cursor = suites.map((s) => s.inicio);
  let si = 0, dadas = 0, ultima = null;

  function proxima() {
    if (dadas >= POR_SUITE) cambiar(si + 1);
    const s = suites[si], i = cursor[si];
    cursor[si] = (i + 1) % s.pruebas.length;
    dadas++;
    return { suite: si, n: i + 1, titulo: s.pruebas[i][0], pasa: s.pruebas[i][1] === 1 };
  }
  function cambiar(i) {
    si = (i + suites.length) % suites.length;
    dadas = 0;
  }
  const piezas = nodos.map((nodo, i) => ({ nodo, x: B.x0 + 8 - i * PASO, y: 0, z: B.z, prueba: proxima(), medida: false, fin: 0 }));
  function reciclar(p) {
    const atras = Math.min(...piezas.map((q) => q.x));
    Object.assign(p, { x: Math.min(B.x0 + 8, atras - PASO), y: 0, z: B.z, prueba: proxima(), medida: false, fin: 0 });
    p.nodo.removeAttribute("data-falla");
    // La que vuelve al principio queda atrás de todas: se pinta primero.
    p.nodo.parentNode.prepend(p.nodo);
  }
  function escribir() {
    const s = suites[ultima ? ultima.suite : si];
    const texto = ultima ? `${s.nombre} · ${ultima.n} ${textos.de} ${s.pruebas.length} · ${ultima.pasa ? textos.pasa : textos.falla}` : s.nombre;
    if (readout.textContent !== texto) readout.textContent = texto;
    const linea = ultima ? (ultima.pasa ? "✓ " : "✗ ") + ultima.titulo : "";
    if (titulo.textContent !== linea) titulo.textContent = linea;
    const n = String(s.pasadas).padStart(3, "0");
    if (caja.textContent !== n) caja.textContent = n;
  }

  let last = 0, frame = 0, visible = false;
  function tick(ahora) {
    const dt = last ? Math.min((ahora - last) / 1000, 1 / 30) : 1 / 60;
    last = ahora;
    let cerca = 99, luz = null;
    for (const p of piezas) {
      const falla = !p.prueba.pasa;
      if (falla && p.x >= DIVERT_X) {
        // Fuera de la cinta, hacia la bandeja, y abajo.
        if (p.y < TRAY.y + TRAY.d / 2) p.y += 70 * dt;
        else { p.z = Math.max(TRAY_Z + 2, p.z - 90 * dt); p.fin += dt; }
      } else if (p.x >= B.x1 - 4) {
        // Al final de la cinta cae a la caja.
        p.x += VEL * dt;
        p.z -= 120 * dt;
        if (p.z < BOX_H - 9) { reciclar(p); continue; }
      } else p.x += VEL * dt;
      if (p.fin > 0.8) { reciclar(p); continue; }
      p.nodo.setAttribute("visibility", p.x > B.x0 - 2 ? "visible" : "hidden");
      const d = Math.abs(p.x - GATE_X);
      if (d < cerca) cerca = d;
      if (!p.medida && p.x >= GATE_X) {
        p.medida = true;
        ultima = p.prueba;
        if (falla) p.nodo.setAttribute("data-falla", "");
      }
      if (d < 9) luz = p.prueba.pasa ? "pasa" : "falla";
      p.nodo.setAttribute("transform", translateAlong(P, [p.x, p.y, p.z]));
    }
    calibre.setAttribute("transform", translateAlong(P, [0, 0, -Math.max(0, 1 - cerca / 8) * 5]));
    if (luz) stage.dataset.luz = luz;
    else delete stage.dataset.luz;
    escribir();
    frame = visible && !quieto.matches ? requestAnimationFrame(tick) : 0;
  }
  const correr = () => {
    if (!frame && visible && !quieto.matches) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };
  new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; correr(); }, { rootMargin: "120px 0px" }).observe(stage);
  stage.addEventListener("click", () => cambiar(si + 1));
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "ArrowRight" || e.key === "ArrowDown") cambiar(si + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") cambiar(si - 1);
    else return;
    e.preventDefault();
  });
  for (const p of piezas) {
    p.nodo.setAttribute("visibility", p.x > B.x0 - 2 ? "visible" : "hidden");
    p.nodo.setAttribute("transform", translateAlong(P, [p.x, p.y, p.z]));
  }
  escribir();
}
