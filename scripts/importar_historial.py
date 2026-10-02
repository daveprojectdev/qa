"""Importa a data/corridas/ las corridas anteriores a qa.davidameth.dev.

    python scripts/importar_historial.py

Una sola vez (2026-10-02), y se deja en el repo para que se pueda ver de
dónde salió cada dato. Usa `gh` con la sesión local y solo la biblioteca
estándar.

De cada corrida de GitHub Actions saca lo que todavía exista:
- Si el informe sigue guardado (Playwright lo guarda 14 días; el de la API,
  90), saca de él el resultado prueba por prueba: `detalle: true`.
- Si ya venció, solo queda lo que GitHub dice de la corrida: la fecha y si
  terminó en verde o en rojo. Se publica como «pasa» o «falla» sin cifras
  (`detalle: false`). No se inventa ningún número.
- Si la corrida terminó en rojo antes de llegar a las pruebas (la
  comprobación de tipos, la preparación de la máquina), es «no-corrio», con
  el paso que falló como motivo. Pintarla en rojo diría que fallaron pruebas
  que nunca se ejecutaron.
- Si terminó en rojo solo por el paso que publica aquí (el 403 del token del
  2026-10-02), cuenta lo que dijeron las pruebas.

Las corridas que ya están en data/corridas/ no se duplican: si les falta el
detalle prueba por prueba y su informe sigue guardado, solo se les añade.
"""

import base64
import io
import json
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CORRIDAS = RAIZ / "data" / "corridas"

SUITES = {
    "portafolio-e2e": {"repo": "daveprojectdev/PortafolioWeb", "workflow": "e2e.yml", "publico": False},
    "api-torneo": {"repo": "daveprojectdev/api-torneo", "workflow": "ci.yml", "publico": True},
}
# Pasos que no son las pruebas: si solo falló uno de estos, las pruebas dicen el resultado.
PUBLICAR = "Publicar en qa.davidameth.dev"
ESTADOS = {"expected": "pasa", "unexpected": "falla", "flaky": "inestable", "skipped": "omitida"}
ANSI = re.compile(r"\x1b\[[0-9;]*m")


def gh(*args: str) -> bytes:
    return subprocess.run(["gh", *args], check=True, capture_output=True).stdout


def gh_json(*args: str):
    return json.loads(gh(*args))


def corto(texto: str | None) -> str | None:
    if not texto:
        return None
    limpio = ANSI.sub("", texto).strip().splitlines()[0][:300]
    return limpio or None


def ya_importadas(suite: str) -> dict[str, Path]:
    ids = {}
    for f in (CORRIDAS / suite).glob("*.json"):
        partes = f.stem.split("-")
        if len(partes) >= 2:
            ids[partes[1]] = f
    return ids


def artefactos(repo: str) -> dict[str, list[dict]]:
    por_corrida: dict[str, list[dict]] = {}
    datos = gh_json("api", f"repos/{repo}/actions/artifacts?per_page=100")
    for a in datos["artifacts"]:
        if not a["expired"]:
            por_corrida.setdefault(str(a["workflow_run"]["id"]), []).append(a)
    return por_corrida


def descargar(repo: str, artefacto: dict) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(gh("api", f"repos/{repo}/actions/artifacts/{artefacto['id']}/zip")))


# ── Playwright: el informe HTML lleva sus datos dentro, como un zip en base64 ──
def desde_playwright(z: zipfile.ZipFile) -> dict:
    html = z.read("index.html").decode("utf-8")
    datos = zipfile.ZipFile(io.BytesIO(base64.b64decode(re.search(r"data:application/zip;base64,([A-Za-z0-9+/=]+)", html).group(1))))
    informe = json.loads(datos.read("report.json"))
    pruebas = []
    for archivo in informe["files"]:
        detalle = json.loads(datos.read(archivo["fileId"] + ".json"))
        for t in detalle["tests"]:
            ultimo = t["results"][-1] if t.get("results") else {}
            error = (ultimo.get("errors") or [{}])[0]
            pruebas.append(
                {
                    "archivo": archivo["fileName"].replace("\\", "/"),
                    "titulo": " › ".join([*t.get("path", []), t["title"]]),
                    "proyecto": t["projectName"],
                    "estado": ESTADOS[t["outcome"]],
                    "ms": t["duration"],
                    "error": corto(error.get("message")) if t["outcome"] in ("unexpected", "flaky") else None,
                }
            )
    s = informe["stats"]
    fin = datetime.fromtimestamp((informe["startTime"] + informe["duration"]) / 1000, UTC)
    return {
        "fecha": fin.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "resultado": "pasa" if s["unexpected"] == 0 else "falla",
        "pasadas": s["expected"],
        "fallidas": s["unexpected"],
        "inestables": s["flaky"],
        "omitidas": s["skipped"],
        "duracion_s": round(informe["duration"] / 1000),
        "cobertura": None,
        "pruebas": pruebas,
    }


# ── pytest: JUnit, y la cobertura del JSON o, en las corridas viejas, del HTML ──
def desde_pytest(z: zipfile.ZipFile) -> dict:
    raiz = ET.fromstring(z.read("junit.xml"))
    grupos = [raiz] if raiz.tag == "testsuite" else raiz.findall("testsuite")
    pruebas = []
    for g in grupos:
        for c in g.iter("testcase"):
            fallo = c.find("failure") if c.find("failure") is not None else c.find("error")
            omitida = c.find("skipped") is not None
            pruebas.append(
                {
                    "archivo": c.get("classname", "").replace(".", "/") + ".py",
                    "titulo": c.get("name"),
                    "proyecto": None,
                    "estado": "falla" if fallo is not None else "omitida" if omitida else "pasa",
                    "ms": round(float(c.get("time", 0)) * 1000),
                    "error": corto(fallo.get("message")) if fallo is not None else None,
                }
            )
    nombres = z.namelist()
    if "cobertura.json" in nombres:
        cobertura = round(json.loads(z.read("cobertura.json"))["totals"]["percent_covered"], 1)
    else:
        # La fórmula de coverage.py: líneas y ramas ejecutadas sobre el total.
        estado = json.loads(z.read("cobertura/status.json"))
        n = [f["index"]["nums"] for f in estado["files"].values()]
        total = sum(x["n_statements"] + x["n_branches"] for x in n)
        hechas = sum(x["n_statements"] - x["n_missing"] + x["n_branches"] - x["n_missing_branches"] for x in n)
        cobertura = round(100 * hechas / total, 1)
    fallidas = sum(p["estado"] == "falla" for p in pruebas)
    omitidas = sum(p["estado"] == "omitida" for p in pruebas)
    return {
        "fecha": grupos[0].get("timestamp", "")[:19] + "Z",
        "resultado": "pasa" if fallidas == 0 else "falla",
        "pasadas": len(pruebas) - fallidas - omitidas,
        "fallidas": fallidas,
        "inestables": 0,
        "omitidas": omitidas,
        "duracion_s": round(sum(float(g.get("time", 0)) for g in grupos)),
        "cobertura": cobertura,
        "pruebas": pruebas,
    }


def pasos_fallidos(repo: str, corrida: str) -> list[str]:
    datos = gh_json("run", "view", corrida, "-R", repo, "--json", "jobs")
    return [p["name"] for j in datos["jobs"] for p in j["steps"] if p["conclusion"] == "failure"]


def main() -> None:
    for suite, cfg in SUITES.items():
        repo = cfg["repo"]
        hechas = ya_importadas(suite)
        arts = artefactos(repo)
        corridas = gh_json(
            "run", "list", "-R", repo, "-w", cfg["workflow"], "-L", "100",
            "--json", "databaseId,conclusion,updatedAt,event,headSha,attempt",
        )
        (CORRIDAS / suite).mkdir(parents=True, exist_ok=True)
        for r in corridas:
            rid = str(r["databaseId"])
            if r["conclusion"] not in ("success", "failure"):
                continue
            # En la API solo cuenta lo que llega a main (el CI también corre en PR).
            if suite == "api-torneo" and r["event"] != "push":
                continue

            base = {
                "suite": suite,
                "importada": True,
                "commit": r["headSha"][:7],
                "corrida": f"https://github.com/{repo}/actions/runs/{rid}" if cfg["publico"] else None,
                "fallos": [],
            }
            propios = arts.get(rid, [])
            if suite == "api-torneo":
                propios = [a for a in propios if a["name"] in ("informe-de-pruebas", "informe-de-pruebas-py3.12")]
            propios.sort(key=lambda a: a["id"])  # el último es el del último intento

            if rid in hechas:
                # Ya publicada por el CI: solo se le añade el detalle si le falta.
                archivo = hechas[rid]
                previa = json.loads(archivo.read_text(encoding="utf-8"))
                if "pruebas" not in previa and propios:
                    z = descargar(repo, propios[-1])
                    datos = desde_playwright(z) if suite == "portafolio-e2e" else desde_pytest(z)
                    previa["pruebas"] = datos["pruebas"]
                    previa["detalle"] = True
                    archivo.write_text(json.dumps(previa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(f"  {suite} {rid}: ya estaba; se le añadió el detalle")
                continue

            if propios:
                z = descargar(repo, propios[-1])
                datos = desde_playwright(z) if suite == "portafolio-e2e" else desde_pytest(z)
                datos["fallos"] = [
                    f"[{p['proyecto']}] {p['titulo']}" if p["proyecto"] else f"{p['archivo']}::{p['titulo']}"
                    for p in datos["pruebas"] if p["estado"] == "falla"
                ][:25]
                corrida = {**base, **datos, "detalle": True}
            elif r["conclusion"] == "success":
                corrida = {**base, "fecha": r["updatedAt"], "resultado": "pasa", "detalle": False}
            else:
                pasos = pasos_fallidos(repo, rid)
                if pasos and all(p == PUBLICAR for p in pasos):
                    print(f"  {suite} {rid}: solo falló la publicación y no hay informe; se salta")
                    continue
                motivo = ", ".join(dict.fromkeys(pasos)) or "desconocido"
                antes = not any("test" in p.lower() or "prueba" in p.lower() for p in pasos)
                corrida = {
                    **base,
                    "fecha": r["updatedAt"],
                    "resultado": "no-corrio" if antes else "falla",
                    "motivo": motivo,
                    "detalle": False,
                }

            nombre = corrida["fecha"].replace("-", "").replace(":", "")[:15] + "Z"
            destino = CORRIDAS / suite / f"{nombre}-{rid}-{r['attempt']}.json"
            destino.write_text(json.dumps(corrida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"  {suite} {rid}: {corrida['resultado']}{'' if corrida['detalle'] else ' (sin detalle)'} → {destino.name}")


if __name__ == "__main__":
    main()
