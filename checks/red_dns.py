"""Red y DNS de davidameth.dev: lo que un navegador, un correo o una autoridad
de certificados ven del dominio, comprobado desde fuera.

    python checks/red_dns.py > resumen.json

Lo corre todos los días `.github/workflows/red-dns.yml` y el resultado se
publica en qa.davidameth.dev como cualquier otra suite. Solo usa la biblioteca
estándar: el DNS se consulta por DNS sobre HTTPS a dos resolutores públicos
(Google y Cloudflare), así que no depende del resolutor de la máquina.

Cada comprobación es una «prueba» con su archivo (el grupo), su título y su
resultado, en el mismo formato que las demás suites.
"""

from __future__ import annotations

import http.client
import json
import os
import socket
import ssl
import sys
import time
import urllib.parse
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime

DOMINIO = "davidameth.dev"
# Los subdominios, todos en Vercel con un CNAME propio.
SUBDOMINIOS = ["www", "torneo", "api", "qa"]
HOSTS = [DOMINIO, *(f"{s}.{DOMINIO}" for s in SUBDOMINIOS)]
DIAS_MINIMOS = 20  # Vercel renueva con unos 30 días de margen
UN_ANIO = 365 * 24 * 3600

RESOLUTORES = {
    "Google": "https://dns.google/resolve",
    "Cloudflare": "https://cloudflare-dns.com/dns-query",
}


class Fallo(Exception):
    """La comprobación no se cumple; el mensaje dice por qué."""


def doh(nombre: str, tipo: str, resolutor: str = "Google") -> dict:
    q = urllib.parse.urlencode({"name": nombre, "type": tipo, "do": "1"})
    pet = urllib.request.Request(
        f"{RESOLUTORES[resolutor]}?{q}", headers={"accept": "application/dns-json"}
    )
    with urllib.request.urlopen(pet, timeout=10) as r:
        return json.load(r)


def respuestas(nombre: str, tipo: str) -> list[str]:
    codigo = {"A": 1, "CNAME": 5, "MX": 15, "TXT": 16, "AAAA": 28, "DS": 43, "CAA": 257}[tipo]
    datos = doh(nombre, tipo)
    # Tal cual llega: un CAA es `0 issue "letsencrypt.org"` y sus comillas son
    # parte del valor. Solo a los TXT se les quitan (en `txt`).
    return [a["data"] for a in datos.get("Answer", []) if a["type"] == codigo]


def txt(nombre: str) -> list[str]:
    # Un TXT largo llega partido en cadenas "a" "b"; se unen.
    return [v.strip('"').replace('" "', "") for v in respuestas(nombre, "TXT")]


# ------------------------------------------------------------ comprobaciones


def dnssec_ds() -> None:
    if not respuestas(DOMINIO, "DS"):
        raise Fallo("la zona padre (.dev) no publica un registro DS: DNSSEC está apagado")


def dnssec_valida(resolutor: str) -> Callable[[], None]:
    def comprobar() -> None:
        datos = doh(DOMINIO, "A", resolutor)
        if datos.get("Status") != 0:
            raise Fallo(f"{resolutor} respondió con código {datos.get('Status')} (2 = la firma no valida)")
        if not datos.get("AD"):
            raise Fallo(f"{resolutor} resolvió pero no marcó la respuesta como validada (AD)")

    return comprobar


def resuelve(host: str) -> Callable[[], None]:
    def comprobar() -> None:
        if host == DOMINIO:
            if not respuestas(host, "A"):
                raise Fallo("el dominio principal no tiene registro A")
            return
        destino = respuestas(host, "CNAME")
        if not destino or "vercel-dns" not in destino[0]:
            raise Fallo(f"se esperaba un CNAME a Vercel y llegó {destino or 'nada'}")

    return comprobar


def sin_aaaa() -> None:
    # Vercel no admite IPv6 en dominios propios: un AAAA mandaría parte del
    # tráfico a otro sitio y puede frenar la emisión del certificado.
    if respuestas(DOMINIO, "AAAA"):
        raise Fallo("hay un registro AAAA en el dominio principal; Vercel no atiende IPv6")


def spf_unico() -> None:
    spf = [t for t in txt(DOMINIO) if t.startswith("v=spf1")]
    if len(spf) != 1:
        raise Fallo(f"tiene que haber exactamente un SPF y hay {len(spf)} (con dos, ambos se ignoran)")


def spf_cierra() -> None:
    spf = next((t for t in txt(DOMINIO) if t.startswith("v=spf1")), "")
    if not spf.endswith(("~all", "-all")):
        raise Fallo(f"el SPF no termina en ~all ni -all: «{spf}»")


def dmarc_publicado() -> None:
    if not any(t.startswith("v=DMARC1") for t in txt(f"_dmarc.{DOMINIO}")):
        raise Fallo("no hay registro DMARC en _dmarc.davidameth.dev")


def dmarc_informa() -> None:
    dmarc = next((t for t in txt(f"_dmarc.{DOMINIO}") if t.startswith("v=DMARC1")), "")
    if "rua=mailto:" not in dmarc:
        raise Fallo("el DMARC no pide informes (rua): no se enteraría nadie de una suplantación")


def mx_reenvio() -> None:
    mx = respuestas(DOMINIO, "MX")
    if not mx or not all("efwd.spaceship.net" in m for m in mx):
        raise Fallo(f"el correo ya no apunta al reenvío de Spaceship: {mx or 'sin MX'}")


def caa_letsencrypt() -> None:
    caa = respuestas(DOMINIO, "CAA")
    if not any('issue "letsencrypt.org"' in c for c in caa):
        raise Fallo(f"ningún CAA autoriza a Let's Encrypt, la que usa Vercel: {caa or 'sin CAA'}")


def emisores(caa: list[str]) -> set[str]:
    """Las autoridades que autoriza un conjunto de CAA (`0 issue "x"` → x)."""
    return {c.split('"')[1] for c in caa if ' issue "' in c and c.split('"')[1]}


def caa_igual_a_vercel() -> None:
    # Vercel publica en el destino de sus CNAME las autoridades con las que
    # puede emitir, Let's Encrypt y sus respaldos. El CAA del dominio principal
    # tiene que autorizar exactamente esas: una de menos rompe una renovación
    # de respaldo, y una de más (o mal escrita: el 2026-10-02 entró
    # «section.com» por «sectigo.com») abre la puerta a quien no hace falta.
    destino = respuestas(f"api.{DOMINIO}", "CNAME")
    if not destino:
        raise Fallo("no se pudo leer el destino de Vercel para comparar")
    de_vercel = emisores(respuestas(destino[0].rstrip("."), "CAA"))
    propios = emisores(respuestas(DOMINIO, "CAA"))
    if propios != de_vercel:
        faltan, sobran = sorted(de_vercel - propios), sorted(propios - de_vercel)
        raise Fallo(f"el CAA no coincide con el de Vercel; faltan {faltan or 'ninguna'}, sobran {sobran or 'ninguna'}")


def caa_sin_comodines() -> None:
    caa = respuestas(DOMINIO, "CAA")
    if not any('issuewild ";"' in c for c in caa):
        raise Fallo("el CAA no prohíbe certificados comodín (issuewild \";\")")


def certificado(host: str) -> Callable[[], None]:
    def comprobar() -> None:
        contexto = ssl.create_default_context()
        try:
            with socket.create_connection((host, 443), timeout=10) as s:
                with contexto.wrap_socket(s, server_hostname=host) as t:
                    cert = t.getpeercert()
        except ssl.SSLCertVerificationError as e:
            raise Fallo(f"el certificado no es válido para {host}: {e.verify_message}") from e
        vence = datetime.fromtimestamp(ssl.cert_time_to_seconds(cert["notAfter"]), UTC)
        dias = (vence - datetime.now(UTC)).days
        if dias < DIAS_MINIMOS:
            raise Fallo(f"al certificado le quedan {dias} días (vence el {vence:%Y-%m-%d})")

    return comprobar


def peticion(host: str, ruta: str = "/", seguro: bool = True) -> http.client.HTTPResponse:
    clase = http.client.HTTPSConnection if seguro else http.client.HTTPConnection
    conexion = clase(host, timeout=10)
    conexion.request("HEAD", ruta, headers={"User-Agent": "qa.davidameth.dev red-dns"})
    return conexion.getresponse()


def http_a_https(host: str) -> Callable[[], None]:
    def comprobar() -> None:
        r = peticion(host, seguro=False)
        destino = r.getheader("Location", "")
        if r.status not in (301, 308) or not destino.startswith("https://"):
            raise Fallo(f"http:// respondió {r.status} hacia «{destino}», no una redirección permanente a https")

    return comprobar


def hsts(host: str) -> Callable[[], None]:
    def comprobar() -> None:
        valor = peticion(host).getheader("Strict-Transport-Security", "")
        edad = next((int(p.split("=")[1]) for p in valor.split(";") if p.strip().startswith("max-age")), 0)
        if edad < UN_ANIO:
            raise Fallo(f"HSTS «{valor or 'ausente'}»: se espera max-age de al menos un año")

    return comprobar


def redirige(host: str, destino: str) -> Callable[[], None]:
    def comprobar() -> None:
        r = peticion(host)
        llega = r.getheader("Location", "")
        if r.status not in (301, 308) or not llega.startswith(destino):
            raise Fallo(f"respondió {r.status} hacia «{llega}» y se esperaba {destino}")

    return comprobar


PRUEBAS: list[tuple[str, str, Callable[[], None]]] = [
    ("dns", "DNSSEC: la zona padre publica el registro DS", dnssec_ds),
    ("dns", "DNSSEC: Google valida la firma", dnssec_valida("Google")),
    ("dns", "DNSSEC: Cloudflare valida la firma", dnssec_valida("Cloudflare")),
    *(("dns", f"{h} resuelve hacia Vercel", resuelve(h)) for h in HOSTS),
    ("dns", "Sin AAAA en el dominio principal (Vercel no admite IPv6)", sin_aaaa),
    ("correo", "Un solo registro SPF", spf_unico),
    ("correo", "El SPF termina en ~all o -all", spf_cierra),
    ("correo", "DMARC publicado", dmarc_publicado),
    ("correo", "DMARC pide informes (rua)", dmarc_informa),
    ("correo", "MX apunta al reenvío de Spaceship", mx_reenvio),
    ("certificados", "CAA autoriza a Let's Encrypt", caa_letsencrypt),
    ("certificados", "CAA autoriza exactamente a las autoridades de Vercel", caa_igual_a_vercel),
    ("certificados", "CAA prohíbe certificados comodín", caa_sin_comodines),
    *(("certificados", f"{h}: certificado válido y con más de {DIAS_MINIMOS} días", certificado(h)) for h in HOSTS),
    *(("http", f"http://{h} redirige a https", http_a_https(h)) for h in HOSTS),
    *(("http", f"{h}: HSTS de al menos un año", hsts(h)) for h in HOSTS),
    ("http", "www redirige al dominio principal", redirige(f"www.{DOMINIO}", f"https://{DOMINIO}")),
    (
        "http",
        "El .vercel.app viejo del torneo redirige a torneo.davidameth.dev",
        redirige("torneo-volleyball-2026.vercel.app", "https://torneo.davidameth.dev"),
    ),
]


def main() -> None:
    inicio = time.monotonic()
    pruebas = []
    for archivo, titulo, comprobar in PRUEBAS:
        t0 = time.monotonic()
        error = None
        try:
            comprobar()
        except Fallo as e:
            error = str(e)
        except Exception as e:  # red caída, DNS que no responde: también es un fallo
            error = f"{type(e).__name__}: {e}"
        pruebas.append(
            {
                "archivo": archivo,
                "titulo": titulo,
                "proyecto": None,
                "estado": "falla" if error else "pasa",
                "ms": round((time.monotonic() - t0) * 1000),
                "error": error[:300] if error else None,
            }
        )
    fallidas = [p for p in pruebas if p["estado"] == "falla"]
    servidor = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo, corrida = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_RUN_ID")
    resumen = {
        "suite": "red-dns",
        "fecha": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "resultado": "falla" if fallidas else "pasa",
        "pasadas": len(pruebas) - len(fallidas),
        "fallidas": len(fallidas),
        "inestables": 0,
        "omitidas": 0,
        "duracion_s": round(time.monotonic() - inicio),
        "cobertura": None,
        "commit": os.environ.get("GITHUB_SHA", "")[:7] or None,
        "corrida": f"{servidor}/{repo}/actions/runs/{corrida}" if repo and corrida else None,
        "fallos": [f"{p['archivo']} › {p['titulo']}" for p in fallidas][:25],
        "detalle": True,
        "pruebas": pruebas,
    }
    json.dump(resumen, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
