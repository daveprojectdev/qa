// Construye qa.davidameth.dev a partir de data/corridas/<suite>/*.json.
//
// Cada archivo es el resumen de UNA corrida, y lo sube el CI del repo que la
// hizo (ver README). Un archivo por corrida y no un historial que se reescribe:
// dos suites que terminan a la vez nunca chocan, y el historial de git es el
// registro de cuándo llegó cada una.
//
// Sin dependencias: Vercel corre `node build.mjs` y sirve dist/.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = import.meta.dirname;
const SALIDA = join(RAIZ, "dist");
const HISTORIAL = 30; // barras por suite
const ZONA = "America/Panama";

const suites = JSON.parse(readFileSync(join(RAIZ, "suites.json"), "utf8"));

function corridas(id) {
  const dir = join(RAIZ, "data", "corridas", id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const T = {
  es: {
    lang: "es",
    titulo: "Calidad, en vivo",
    desc: "El resultado de cada corrida de pruebas de los proyectos de David Ameth Martínez Sánchez, publicado por el propio CI.",
    intro:
      "Cada vez que una de mis suites de pruebas termina, el CI publica aquí su resultado. Nadie edita esta página a mano: si algo falla, se ve.",
    pasa: "Pasando",
    falla: "Fallando",
    sin: "Sin corridas todavía",
    ultima: "Última corrida",
    pasadas: "pasadas",
    fallidas: "fallidas",
    inestables: "inestables",
    omitidas: "omitidas",
    duracion: "duración",
    cobertura: "cobertura",
    historial: (n, ok) => `Últimas ${n} corridas: ${ok} pasaron y ${n - ok} fallaron`,
    fallos: "Qué falló",
    verObjetivo: "Ver lo que prueba",
    verCorrida: "Ver la corrida",
    verCodigo: "Ver el código",
    cuando: "Cuándo corre",
    como: "Cómo funciona",
    comoTexto:
      "Al terminar, cada workflow de GitHub Actions resume su informe (JSON de Playwright o JUnit de pytest) y sube ese resumen a este repositorio. Cada subida despliega la página de nuevo. Los datos crudos también están en",
    volver: "davidameth.dev",
    otro: { href: "/en/", texto: "English" },
    hace: "hace",
    fechaLocale: "es-PA",
  },
  en: {
    lang: "en",
    titulo: "Quality, live",
    desc: "The result of every test run of David Ameth Martínez Sánchez's projects, published by the CI itself.",
    intro:
      "Every time one of my test suites finishes, the CI publishes its result here. Nobody edits this page by hand: if something fails, it shows.",
    pasa: "Passing",
    falla: "Failing",
    sin: "No runs yet",
    ultima: "Latest run",
    pasadas: "passed",
    fallidas: "failed",
    inestables: "flaky",
    omitidas: "skipped",
    duracion: "duration",
    cobertura: "coverage",
    historial: (n, ok) => `Last ${n} runs: ${ok} passed and ${n - ok} failed`,
    fallos: "What failed",
    verObjetivo: "See what it tests",
    verCorrida: "See the run",
    verCodigo: "See the code",
    cuando: "When it runs",
    como: "How it works",
    comoTexto:
      "When it finishes, each GitHub Actions workflow summarizes its report (Playwright JSON or pytest JUnit) and uploads that summary to this repository. Every upload redeploys the page. The raw data is also at",
    volver: "davidameth.dev",
    otro: { href: "/", texto: "Español" },
    hace: "ago",
    fechaLocale: "en-US",
  },
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function duracion(s) {
  if (s == null) return "—";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
}

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

function tarjeta(s, t, idioma) {
  const lista = corridas(s.id);
  const u = lista.at(-1);
  const recientes = lista.slice(-HISTORIAL);
  const ok = recientes.filter((r) => r.resultado === "pasa").length;

  const estado = !u
    ? `<span class="estado vacio">${t.sin}</span>`
    : u.resultado === "pasa"
      ? `<span class="estado pasa"><i aria-hidden="true"></i>${t.pasa}</span>`
      : `<span class="estado falla"><i aria-hidden="true"></i>${t.falla}</span>`;

  const cifras = u
    ? `<dl class="cifras">
        <div><dt>${t.pasadas}</dt><dd>${u.pasadas}</dd></div>
        <div><dt>${t.fallidas}</dt><dd${u.fallidas ? ' class="mal"' : ""}>${u.fallidas}</dd></div>
        ${u.inestables ? `<div><dt>${t.inestables}</dt><dd>${u.inestables}</dd></div>` : ""}
        ${u.omitidas ? `<div><dt>${t.omitidas}</dt><dd>${u.omitidas}</dd></div>` : ""}
        ${u.cobertura != null ? `<div><dt>${t.cobertura}</dt><dd>${u.cobertura.toLocaleString(t.fechaLocale)} %</dd></div>` : ""}
        <div><dt>${t.duracion}</dt><dd>${duracion(u.duracion_s)}</dd></div>
      </dl>`
    : "";

  const barras = recientes.length
    ? `<div class="historial" role="img" aria-label="${esc(t.historial(recientes.length, ok))}">
        ${recientes
          .map(
            (r) =>
              `<span class="${r.resultado}" title="${esc(`${fecha(r.fecha, t)} · ${r.pasadas} ${t.pasadas}, ${r.fallidas} ${t.fallidas}`)}"></span>`,
          )
          .join("")}
      </div>`
    : "";

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
      ${estado}
    </header>
    <p class="que">${esc(s.que[idioma])}</p>
    ${u ? `<p class="meta">${t.ultima}: <time datetime="${u.fecha}" data-relativa>${fecha(u.fecha, t)}</time>${u.commit ? ` · <code>${esc(u.commit)}</code>` : ""}</p>` : ""}
    ${cifras}
    ${barras}
    ${fallos}
    <p class="meta">${t.cuando}: ${esc(s.cuando[idioma])}</p>
    ${enlaces ? `<p class="enlaces">${enlaces}</p>` : ""}
  </div></article>`;
}

function pagina(idioma) {
  const t = T[idioma];
  const url = idioma === "es" ? "https://qa.davidameth.dev/" : "https://qa.davidameth.dev/en/";
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.titulo} · davidameth.dev</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="es" href="https://qa.davidameth.dev/">
<link rel="alternate" hreflang="en" href="https://qa.davidameth.dev/en/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<meta name="color-scheme" content="light dark">
<link rel="preload" href="/fuentes/schibsted-grotesk-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilo.css">
</head>
<body>
<main>
  <nav class="barra">
    <a class="marca" href="https://davidameth.dev${idioma === "en" ? "/en/" : "/"}" aria-label="David Ameth Martínez Sánchez · ${t.volver}"><span class="punto" aria-hidden="true"></span>d</a>
    <a class="idioma" href="${t.otro.href}" hreflang="${idioma === "es" ? "en" : "es"}">${t.otro.texto}</a>
  </nav>
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
  </footer>
</main>
<script>
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

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(join(SALIDA, "en"), { recursive: true });
cpSync(join(RAIZ, "public"), SALIDA, { recursive: true });
writeFileSync(join(SALIDA, "index.html"), pagina("es"));
writeFileSync(join(SALIDA, "en", "index.html"), pagina("en"));
writeFileSync(
  join(SALIDA, "estado.json"),
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      suites: suites.map((s) => ({ id: s.id, corridas: corridas(s.id) })),
    },
    null,
    2,
  ),
);
console.log(`dist/ listo: ${suites.map((s) => `${s.id} (${corridas(s.id).length})`).join(", ")}`);
