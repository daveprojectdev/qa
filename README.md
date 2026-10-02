# qa.davidameth.dev

Calidad, en vivo: el resultado de cada corrida de pruebas de mis proyectos, publicado por el propio CI. Nadie edita esta página a mano.

| Suite | Qué prueba | Cuándo corre |
| --- | --- | --- |
| `portafolio-e2e` | Playwright contra [davidameth.dev](https://davidameth.dev): escritorio y teléfono, enlaces, SEO, paridad ES/EN y axe WCAG 2.1 AA | lunes, jueves y sábado, 06:00 (Panamá) |
| `api-torneo` | pytest, Hypothesis, Schemathesis y oráculo contra [api.davidameth.dev](https://api.davidameth.dev) ([código](https://github.com/daveprojectdev/api-torneo)) | en cada push a `main` |

## Cómo funciona

1. Al terminar, el workflow de cada repo resume su informe (el JSON de Playwright o el JUnit y la cobertura de pytest) en un JSON pequeño.
2. Lo sube aquí como un archivo nuevo, `data/corridas/<suite>/<fecha>-<corrida>.json`, con la API de contenidos de GitHub y un token de grano fino que solo puede escribir en este repo. Un archivo por corrida, para que dos suites que terminan a la vez nunca choquen.
3. Cada subida es un commit, y Vercel vuelve a desplegar: `node build.mjs` arma `dist/` sin dependencias.

Los datos crudos están también en [`/estado.json`](https://qa.davidameth.dev/estado.json).

El repo del portafolio es privado, así que sus corridas no llevan enlace: se publican las cifras y los títulos de las pruebas que fallen.

## Formato de una corrida

```json
{
  "suite": "api-torneo",
  "fecha": "2026-10-02T04:38:52Z",
  "resultado": "pasa",
  "pasadas": 90,
  "fallidas": 0,
  "inestables": 0,
  "omitidas": 0,
  "duracion_s": 44,
  "cobertura": 99.4,
  "commit": "dfadcbb",
  "corrida": "https://github.com/daveprojectdev/api-torneo/actions/runs/…",
  "fallos": []
}
```

## Local

```
node build.mjs
```

Las fuentes de `public/fuentes/` (Schibsted Grotesk, Atkinson Hyperlegible Next e IBM Plex Mono) están bajo la SIL Open Font License 1.1.
