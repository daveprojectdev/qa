# Seguridad

## Reportar una vulnerabilidad

Si encuentras un problema de seguridad en `qa.davidameth.dev` o en este repositorio,
escríbeme a **hola@davidameth.dev** con el asunto «Seguridad: qa». Por favor no abras un
*issue* público mientras no esté corregido.

Respondo en un plazo de 3 días hábiles.

## Qué hay aquí y qué no

- La página es estática: no tiene formularios, cuentas ni datos personales.
- Los resultados los suben los workflows de otros repositorios con un token de grano
  fino (`QA_TOKEN`) que **solo puede escribir en este repositorio**; la suite de red y
  DNS usa el `GITHUB_TOKEN` de su propia corrida. Ningún token está en el código: viven
  como secretos de GitHub Actions.
- Las corridas del portafolio vienen de un repositorio privado: se publican sus cifras y
  los títulos de las pruebas, nunca el código ni el informe completo.

---

**English:** to report a security issue, email hola@davidameth.dev with the subject
“Security: qa”. Please don't open a public issue until it's fixed.
