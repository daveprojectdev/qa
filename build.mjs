// Construye qa.davidameth.dev a partir de data/corridas/<suite>/*.json.
//
// Cada archivo es el resumen de UNA corrida, y lo sube el CI del repo que la
// hizo (ver README). Un archivo por corrida y no un historial que se reescribe:
// dos suites que terminan a la vez nunca chocan, y el historial de git es el
// registro de cuándo llegó cada una. Las anteriores al 2026-10-02 las importó
// scripts/importar_historial.py desde GitHub Actions.
//
// Una corrida tiene uno de tres resultados: «pasa», «falla» o «no-corrio» (el
// CI terminó en rojo antes de llegar a las pruebas). Si trae `pruebas`, se
// puede ver prueba por prueba; si no (`detalle: false`), de ella solo queda
// el resultado y se dibuja más clara.
//
// Sale una portada por idioma y una página por corrida. Sin dependencias:
// Vercel corre `node build.mjs` y sirve dist/.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const RAIZ = import.meta.dirname;
const SALIDA = join(RAIZ, "dist");
const HISTORIAL = 30; // barras por suite
const ZONA = "America/Panama";
const DOMINIO = "https://qa.davidameth.dev";

const suites = JSON.parse(readFileSync(join(RAIZ, "suites.json"), "utf8"));

function corridas(id) {
  const dir = join(RAIZ, "data", "corridas", id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), "utf8")), slug: basename(f, ".json") }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
const DATOS = Object.fromEntries(suites.map((s) => [s.id, corridas(s.id)]));

// Las corridas que están en marcha. El CI escribe un aviso al empezar en
// data/en-curso/<suite>/ y lo borra al terminar, pase lo que pase. Si una
// corrida se cae sin borrarlo, pasadas dos horas se ignora: no hay corrida de
// estas suites que dure tanto, y un «en ejecución» eterno sería una mentira.
const VIGENCIA_EN_CURSO = 2 * 60 * 60 * 1000;
function enCurso(id) {
  const dir = join(RAIZ, "data", "en-curso", id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .filter((r) => Date.now() - new Date(r.fecha).getTime() < VIGENCIA_EN_CURSO)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
const EN_CURSO = Object.fromEntries(suites.map((s) => [s.id, enCurso(s.id)]));

const T = {
  es: {
    lang: "es",
    raiz: "/",
    corridas: "/corridas",
    titulo: "Calidad, en vivo",
    desc: "El resultado de cada corrida de pruebas de los proyectos de David Ameth Martínez Sánchez, publicado por el propio CI.",
    intro:
      "Cada vez que una de mis suites de pruebas termina, el CI publica aquí su resultado. Nadie edita esta página a mano: si algo falla, se ve.",
    estado: { pasa: "Pasando", falla: "Fallando", "no-corrio": "No corrió", "en-curso": "En ejecución" },
    resultado: { pasa: "Pasó", falla: "Falló", "no-corrio": "No corrió", "en-curso": "En ejecución" },
    prueba: { pasa: "pasó", falla: "falló", inestable: "inestable", omitida: "omitida" },
    sin: "Sin corridas todavía",
    ultima: "Última corrida",
    pasadas: "pasadas",
    fallidas: "fallidas",
    inestables: "inestables",
    omitidas: "omitidas",
    duracion: "duración",
    cobertura: "cobertura",
    historial: (n) => `Últimas ${n} corridas, de la más reciente a la más antigua. Cada barra lleva a su corrida.`,
    leyenda: {
      "en-curso": "en ejecución",
      pasa: "pasó",
      falla: "falló",
      "no-corrio": "no corrió",
      parcial: "rayada: sin detalle, solo queda el resultado",
    },
    masReciente: "más reciente",
    masAntigua: "más antigua",
    ultimaTerminada: "Última terminada",
    corriendoDesde: "Empezó",
    fallos: "Qué falló",
    verPruebas: (n) => `Ver las ${n} pruebas`,
    motivo: "Falló antes de las pruebas, en",
    sinDetalle:
      "De esta corrida solo queda el resultado: GitHub guarda el informe completo 14 días y este ya había vencido cuando se importó el historial.",
    importada: "Importada del historial de GitHub Actions.",
    anterior: "Más antigua",
    siguiente: "Más reciente",
    volverPortada: "Todas las suites",
    verObjetivo: "Ver lo que prueba",
    verCorrida: "Ver la corrida en GitHub",
    verCodigo: "Ver el código",
    cuando: "Cuándo corre",
    como: "Cómo funciona",
    comoTexto:
      "Al terminar, cada workflow de GitHub Actions resume su informe (JSON de Playwright o JUnit de pytest) y sube ese resumen a este repositorio. Cada subida despliega la página de nuevo. Los datos crudos también están en",
    volver: "davidameth.dev",
    otro: "English",
    tema: "Cambiar entre tema claro y oscuro",
    fechaLocale: "es-PA",
  },
  en: {
    lang: "en",
    raiz: "/en/",
    corridas: "/en/runs",
    titulo: "Quality, live",
    desc: "The result of every test run of David Ameth Martínez Sánchez's projects, published by the CI itself.",
    intro:
      "Every time one of my test suites finishes, the CI publishes its result here. Nobody edits this page by hand: if something fails, it shows.",
    estado: { pasa: "Passing", falla: "Failing", "no-corrio": "Didn't run", "en-curso": "Running" },
    resultado: { pasa: "Passed", falla: "Failed", "no-corrio": "Didn't run", "en-curso": "Running" },
    prueba: { pasa: "passed", falla: "failed", inestable: "flaky", omitida: "skipped" },
    sin: "No runs yet",
    ultima: "Latest run",
    pasadas: "passed",
    fallidas: "failed",
    inestables: "flaky",
    omitidas: "skipped",
    duracion: "duration",
    cobertura: "coverage",
    historial: (n) => `Last ${n} runs, newest to oldest. Each bar opens its run.`,
    leyenda: {
      "en-curso": "running",
      pasa: "passed",
      falla: "failed",
      "no-corrio": "didn't run",
      parcial: "striped: no detail, only the result is left",
    },
    masReciente: "newest",
    masAntigua: "oldest",
    ultimaTerminada: "Latest finished",
    corriendoDesde: "Started",
    fallos: "What failed",
    verPruebas: (n) => `See all ${n} tests`,
    motivo: "Failed before the tests, at",
    sinDetalle:
      "Only the result of this run is left: GitHub keeps the full report for 14 days, and this one had expired when the history was imported.",
    importada: "Imported from the GitHub Actions history.",
    anterior: "Older",
    siguiente: "Newer",
    volverPortada: "All suites",
    verObjetivo: "See what it tests",
    verCorrida: "See the run on GitHub",
    verCodigo: "See the code",
    cuando: "When it runs",
    como: "How it works",
    comoTexto:
      "When it finishes, each GitHub Actions workflow summarizes its report (Playwright JSON or pytest JUnit) and uploads that summary to this repository. Every upload redeploys the page. The raw data is also at",
    volver: "davidameth.dev",
    otro: "Español",
    tema: "Switch between light and dark theme",
    fechaLocale: "en-US",
  },
};

// Iconos de Phosphor (MIT), los mismos `moon` y `sun` del portafolio.
const LUNA = `<svg class="i luna" aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"/></svg>`;
const SOL = `<svg class="i sol" aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>`;
// La marca de cada prueba. Va con su palabra para lectores de pantalla.
const MARCA = { pasa: "✓", falla: "✗", inestable: "↻", omitida: "–" };

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function duracion(s) {
  if (s == null) return "—";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
}

const ms = (n, t) =>
  n < 1000 ? `${n} ms` : `${(n / 1000).toLocaleString(t.fechaLocale, { maximumFractionDigits: 1 })} s`;

function fecha(iso, t) {
  return new Intl.DateTimeFormat(t.fechaLocale, {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const rutaCorrida = (s, r, t) => `${t.corridas}/${s.id}/${r.slug}/`;

function chipEstado(resultado, t, textos = t.estado) {
  return `<span class="estado ${resultado}"><i aria-hidden="true"></i>${textos[resultado]}</span>`;
}

function cifras(u, t) {
  if (u?.pasadas == null) return "";
  return `<dl class="cifras">
        <div><dt>${t.pasadas}</dt><dd>${u.pasadas}</dd></div>
        <div><dt>${t.fallidas}</dt><dd${u.fallidas ? ' class="mal"' : ""}>${u.fallidas}</dd></div>
        ${u.inestables ? `<div><dt>${t.inestables}</dt><dd>${u.inestables}</dd></div>` : ""}
        ${u.omitidas ? `<div><dt>${t.omitidas}</dt><dd>${u.omitidas}</dd></div>` : ""}
        ${u.cobertura != null ? `<div><dt>${t.cobertura}</dt><dd>${u.cobertura.toLocaleString(t.fechaLocale)} %</dd></div>` : ""}
        <div><dt>${t.duracion}</dt><dd>${duracion(u.duracion_s)}</dd></div>
      </dl>`;
}

// Las pruebas de una corrida, agrupadas por archivo como en el informe de
// Playwright. Los archivos con algo roto salen abiertos.
function listaPruebas(pruebas, t) {
  const grupos = new Map();
  for (const p of pruebas) {
    if (!grupos.has(p.archivo)) grupos.set(p.archivo, []);
    grupos.get(p.archivo).push(p);
  }
  return `<div class="pruebas">${[...grupos]
    .map(([archivo, ps]) => {
      const n = (e) => ps.filter((p) => p.estado === e).length;
      const cuenta = [
        `${n("pasa")} ${t.pasadas}`,
        n("falla") && `<b class="mal">${n("falla")} ${t.fallidas}</b>`,
        n("inestable") && `${n("inestable")} ${t.inestables}`,
        n("omitida") && `${n("omitida")} ${t.omitidas}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const roto = n("falla") || n("inestable");
      return `<details class="archivo"${roto ? " open" : ""}>
        <summary><code>${esc(archivo)}</code><span class="cuenta">${cuenta}</span></summary>
        <ul>${ps
          .map(
            (p) => `<li class="${p.estado}">
            <span class="m" aria-hidden="true">${MARCA[p.estado]}</span>
            <span class="t"><span class="sr">${t.prueba[p.estado]}: </span>${esc(p.titulo)}${p.proyecto ? ` <span class="chip">${esc(p.proyecto)}</span>` : ""}${p.error ? `<span class="error">${esc(p.error)}</span>` : ""}</span>
            <span class="ms">${p.estado === "omitida" ? "" : ms(p.ms, t)}</span>
          </li>`,
          )
          .join("")}</ul>
      </details>`;
    })
    .join("")}</div>`;
}

// «Solo queda el resultado»: no aplica a la que no corrió, que nunca tuvo pruebas.
const parcial = (r) => !r.detalle && r.resultado !== "no-corrio";

function barras(s, lista, t) {
  // De la más reciente a la más antigua, de izquierda a derecha, como se lee.
  const corriendo = EN_CURSO[s.id];
  const recientes = lista.slice(-HISTORIAL).reverse();
  if (!recientes.length && !corriendo.length) return "";
  const hay = (f) => recientes.some(f);
  const leyenda = [
    corriendo.length && `<span><i class="en-curso"></i>${t.leyenda["en-curso"]}</span>`,
    `<span><i class="pasa"></i>${t.leyenda.pasa}</span>`,
    hay((r) => r.resultado === "falla") && `<span><i class="falla"></i>${t.leyenda.falla}</span>`,
    hay((r) => r.resultado === "no-corrio") && `<span><i class="no-corrio"></i>${t.leyenda["no-corrio"]}</span>`,
    hay(parcial) && `<span><i class="pasa parcial"></i>${t.leyenda.parcial}</span>`,
  ]
    .filter(Boolean)
    .join("");
  const vivas = corriendo.map((r) => {
    const texto = `${t.resultado["en-curso"]} · ${t.corriendoDesde} ${fecha(r.fecha, t)}`;
    return r.corrida
      ? `<a class="en-curso" href="${esc(r.corrida)}" title="${esc(texto)}" aria-label="${esc(texto)}"></a>`
      : `<span class="en-curso" role="img" title="${esc(texto)}" aria-label="${esc(texto)}"></span>`;
  });
  const hechas = recientes.map((r, i) => {
    const texto = `${fecha(r.fecha, t)} · ${t.resultado[r.resultado]}${r.pasadas != null ? ` · ${r.pasadas} ${t.pasadas}, ${r.fallidas} ${t.fallidas}` : ""}${parcial(r) ? ` · ${t.leyenda.parcial}` : ""}`;
    const clases = [r.resultado, parcial(r) && "parcial", i === 0 && "ultima"].filter(Boolean);
    return `<a class="${clases.join(" ")}" href="${rutaCorrida(s, r, t)}" title="${esc(texto)}" aria-label="${esc(texto)}"></a>`;
  });
  // Las etiquetas de los extremos miden lo mismo que la fila de barras: con
  // pocas corridas, «más antigua» tiene que quedar bajo la última barra.
  return `<div class="linea-tiempo">
        <nav class="historial" aria-label="${esc(t.historial(recientes.length + corriendo.length))}">
          ${[...vivas, ...hechas].join("")}
        </nav>
        <p class="ejes" aria-hidden="true"><span>← ${t.masReciente}</span><span>${t.masAntigua} →</span></p>
      </div>
      <p class="leyenda">${leyenda}</p>`;
}

function tarjeta(s, t, idioma) {
  const lista = DATOS[s.id];
  const u = lista.at(-1);
  const corriendo = EN_CURSO[s.id][0];

  const fallos =
    u && u.fallos?.length
      ? `<details class="fallos"><summary>${t.fallos} (${u.fallidas})</summary><ul>${u.fallos
          .map((f) => `<li>${esc(f)}</li>`)
          .join("")}</ul></details>`
      : "";

  const enlaces = [
    `<a href="${esc(s.objetivo)}">${t.verObjetivo}</a>`,
    u?.corrida ? `<a href="${esc(u.corrida)}">${t.verCorrida}</a>` : "",
    s.codigo ? `<a href="${esc(s.codigo)}">${t.verCodigo}</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<article class="bisel"><div class="placa">
    <header class="cabeza">
      <h2>${esc(s.nombre[idioma])}</h2>
      ${corriendo ? chipEstado("en-curso", t) : u ? chipEstado(u.resultado, t) : `<span class="estado vacio">${t.sin}</span>`}
    </header>
    <p class="que">${esc(s.que[idioma])}</p>
    ${corriendo ? `<p class="meta en-curso-meta">${t.estado["en-curso"]} · ${t.corriendoDesde} <time datetime="${corriendo.fecha}" data-relativa>${fecha(corriendo.fecha, t)}</time></p>` : ""}
    ${u ? `<p class="meta">${corriendo ? t.ultimaTerminada : t.ultima}: <a href="${rutaCorrida(s, u, t)}"><time datetime="${u.fecha}" data-relativa>${fecha(u.fecha, t)}</time></a>${u.commit ? ` · <code>${esc(u.commit)}</code>` : ""}</p>` : ""}
    ${u?.resultado === "no-corrio" ? `<p class="meta">${t.motivo} «${esc(u.motivo)}».</p>` : ""}
    ${cifras(u, t)}
    ${barras(s, lista, t)}
    ${fallos}
    ${u?.pruebas?.length ? `<details class="todas"><summary>${t.verPruebas(u.pruebas.length)}</summary>${listaPruebas(u.pruebas, t)}</details>` : ""}
    <p class="meta">${t.cuando}: ${esc(s.cuando[idioma])}</p>
    ${enlaces ? `<p class="enlaces">${enlaces}</p>` : ""}
  </div></article>`;
}

function paginaCorrida(s, i, t, idioma) {
  const lista = DATOS[s.id];
  const r = lista[i];
  const ant = lista[i - 1];
  const sig = lista[i + 1];
  const cuerpo = `
  <p class="migas"><a href="${t.raiz}">${t.volverPortada}</a> / ${esc(s.nombre[idioma])}</p>
  <article class="bisel"><div class="placa">
    <header class="cabeza">
      <h1 class="h-corrida"><time datetime="${r.fecha}">${fecha(r.fecha, t)}</time></h1>
      ${chipEstado(r.resultado, t, t.resultado)}
    </header>
    <p class="meta">${esc(s.nombre[idioma])}${r.commit ? ` · <code>${esc(r.commit)}</code>` : ""}</p>
    ${r.resultado === "no-corrio" ? `<p class="nota">${t.motivo} «${esc(r.motivo)}».</p>` : ""}
    ${!r.detalle && r.resultado !== "no-corrio" ? `<p class="nota">${t.sinDetalle}</p>` : ""}
    ${cifras(r, t)}
    ${r.pruebas?.length ? listaPruebas(r.pruebas, t) : ""}
    ${r.importada ? `<p class="meta">${t.importada}</p>` : ""}
    ${r.corrida ? `<p class="enlaces"><a href="${esc(r.corrida)}">${t.verCorrida}</a></p>` : ""}
  </div></article>
  <nav class="pasos">
    ${sig ? `<a href="${rutaCorrida(s, sig, t)}">← ${t.siguiente}</a>` : "<span></span>"}
    ${ant ? `<a href="${rutaCorrida(s, ant, t)}">${t.anterior} →</a>` : "<span></span>"}
  </nav>`;
  const otra = T[idioma === "es" ? "en" : "es"];
  return documento({
    idioma,
    titulo: `${s.nombre[idioma]} · ${fecha(r.fecha, t)}`,
    desc: t.desc,
    rutas: { [idioma]: rutaCorrida(s, r, t), [idioma === "es" ? "en" : "es"]: rutaCorrida(s, r, otra) },
    cuerpo,
    indexar: false,
  });
}

function portada(idioma) {
  const t = T[idioma];
  return documento({
    idioma,
    titulo: `${t.titulo} · davidameth.dev`,
    desc: t.desc,
    rutas: { es: "/", en: "/en/" },
    indexar: true,
    cuerpo: `
  <header class="portada">
    <h1>${t.titulo}</h1>
    <p>${t.intro}</p>
  </header>
  <div class="suites">
    ${suites.map((s) => tarjeta(s, t, idioma)).join("\n")}
  </div>
  <footer class="pie">
    <h2>${t.como}</h2>
    <p>${t.comoTexto} <a href="/estado.json">estado.json</a> · <a href="https://github.com/daveprojectdev/qa">github.com/daveprojectdev/qa</a></p>
  </footer>`,
  });
}

function documento({ idioma, titulo, desc, rutas, cuerpo, indexar }) {
  const t = T[idioma];
  const otro = idioma === "es" ? "en" : "es";
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
${indexar ? "" : '<meta name="robots" content="noindex">\n'}<link rel="canonical" href="${DOMINIO}${rutas[idioma]}">
<link rel="alternate" hreflang="es" href="${DOMINIO}${rutas.es}">
<link rel="alternate" hreflang="en" href="${DOMINIO}${rutas.en}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<meta name="color-scheme" content="light dark">
<script>
  // Antes del primer fotograma: el tema elegido en davidameth.dev o aquí
  // (cookie \`tema\` del dominio entero), o el del sistema.
  (() => {
    const g = document.cookie.match(/(?:^|; )tema=(claro|oscuro)/);
    document.documentElement.dataset.tema = g ? g[1] : matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  })();
</script>
<link rel="preload" href="/fuentes/schibsted-grotesk-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilo.css">
</head>
<body>
<main>
  <nav class="barra">
    <a class="marca" href="https://davidameth.dev${idioma === "en" ? "/en/" : "/"}" aria-label="David Ameth Martínez Sánchez · ${t.volver}"><span class="punto" aria-hidden="true"></span>d</a>
    <div class="herramientas">
      <button type="button" class="tool" data-tema-boton aria-label="${t.tema}">${LUNA}${SOL}</button>
      <a class="idioma" href="${rutas[otro]}" hreflang="${otro}">${t.otro}</a>
    </div>
  </nav>
  ${cuerpo}
</main>
<script>
  // La misma cookie que escribe davidameth.dev: lo que se elige aquí también
  // vale allá.
  document.querySelector("[data-tema-boton]").addEventListener("click", () => {
    const r = document.documentElement;
    const tema = r.dataset.tema === "oscuro" ? "claro" : "oscuro";
    r.dataset.tema = tema;
    document.cookie = "tema=" + tema + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure" +
      (location.hostname.endsWith("davidameth.dev") ? "; Domain=davidameth.dev" : "");
  });
  // «hace 2 días» junto a la fecha: la página solo se reconstruye cuando llega
  // una corrida, así que lo antiguo que está el dato se calcula al mirarla.
  const rtf = new Intl.RelativeTimeFormat(${JSON.stringify(t.lang)}, { numeric: "auto" });
  for (const el of document.querySelectorAll("time[data-relativa]")) {
    const min = (new Date(el.dateTime) - Date.now()) / 60000;
    const [v, u] = Math.abs(min) < 60 ? [min, "minute"] : Math.abs(min) < 1440 ? [min / 60, "hour"] : [min / 1440, "day"];
    el.insertAdjacentText("afterend", " (" + rtf.format(Math.round(v), u) + ")");
  }
</script>
</body>
</html>
`;
}

function escribir(ruta, html) {
  const dir = join(SALIDA, ruta);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
cpSync(join(RAIZ, "public"), SALIDA, { recursive: true });
let paginas = 0;
for (const idioma of ["es", "en"]) {
  const t = T[idioma];
  escribir(t.raiz, portada(idioma));
  for (const s of suites)
    DATOS[s.id].forEach((r, i) => {
      escribir(rutaCorrida(s, r, t), paginaCorrida(s, i, t, idioma));
      paginas++;
    });
}
// Los datos crudos sin el detalle prueba por prueba, que haría el archivo
// enorme: ese está en data/corridas/ del repositorio.
writeFileSync(
  join(SALIDA, "estado.json"),
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      suites: suites.map((s) => ({
        id: s.id,
        corridas: DATOS[s.id].map(({ pruebas, slug, ...r }) => r),
      })),
    },
    null,
    2,
  ),
);
console.log(
  `dist/ listo: ${suites.map((s) => `${s.id} (${DATOS[s.id].length})`).join(", ")}; ${paginas} páginas de corrida`,
);
