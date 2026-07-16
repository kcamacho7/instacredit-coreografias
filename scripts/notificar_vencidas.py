import os
import smtplib
import ssl
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_ANON_KEY"]
SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ["SMTP_PORT"])
SMTP_SECURE = os.environ.get("SMTP_SECURE", "starttls").lower()
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASS = os.environ["SMTP_PASS"]
REGIONAL_EMAIL = os.environ["REGIONAL_EMAIL"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
}

PAISES = {"CR": "Costa Rica", "NI": "Nicaragua", "PA": "Panamá", "SV": "El Salvador"}
AREA_NOMBRE = {"A": "Dominio A — Originación", "B": "Dominio B — Comercial", "C": "Dominio C — Cobro"}

KPI_NOMBRE = {
    "1pd_4pd": "1PD / 2PD / 3PD / 4PD",
    "coincident60": "Coincident 60 MOB",
    "coincident90": "Coincident 90 MOB",
    "castigo": "Castigo MOB",
    "auditaje_expedientes": "Auditaje de expedientes",
    "compromisos_colocacion": "Compromisos en estrategia de colocación",
    "aprobados_sin_formalizar": "Créditos aprobados sin formalizar",
    "conversion_preaprobados": "Conversión de preaprobados",
    "prospectacion": "Prospectación",
    "pilotos_segmentos": "Pilotos de nuevos segmentos",
    "aprovechamiento_monto": "% aprovechamiento de monto aprobado",
    "contactos_por_cuenta": "contactos_por_cuenta",
    "tasa_contacto_efectivo": "tasa_contacto_efectivo",
    "contacto_bruto": "% de contacto (bruto)",
    "tasa_promesa_pago": "tasa_promesa_pago",
    "tasa_cumplimiento_ptp": "tasa_cumplimiento_ptp",
    "incumplimiento_promesas": "% incumplimiento de promesas",
    "dias_primer_contacto": "dias_primer_contacto",
    "llamada_bienvenida": "Llamada de bienvenida",
    "visitas_cobertura": "Visitas de campo — cobertura",
    "visitas_efectividad": "Visitas de campo — efectividad",
}


def hoy_cr():
    return datetime.now(timezone(timedelta(hours=-6))).date()


def sb_get(tabla, params=None):
    r = requests.get(SUPABASE_URL + "/rest/v1/" + tabla, headers=HEADERS, params=params or {"select": "*"})
    r.raise_for_status()
    return r.json()


def sb_patch(tabla, row_id, body):
    r = requests.patch(
        SUPABASE_URL + "/rest/v1/" + tabla,
        headers=HEADERS,
        params={"id": "eq." + row_id},
        json=body,
    )
    r.raise_for_status()


def kpi_catalogo_nombre(kpi_id, catalogo_cache):
    if kpi_id in KPI_NOMBRE:
        return KPI_NOMBRE[kpi_id]
    return catalogo_cache.get(kpi_id, kpi_id)


def cargar_catalogo():
    try:
        rows = sb_get("kpis_catalogo", {"select": "kpi_id,nombre"})
        return {r["kpi_id"]: r["nombre"] for r in rows}
    except Exception:
        return {}


def cargar_items(catalogo_cache):
    """Devuelve lista de dicts: tabla, row_id, idx, pais, origen, accion(dict)"""
    items = []

    for row in sb_get("coreografias"):
        origen = kpi_catalogo_nombre(row["kpi_id"], catalogo_cache)
        for idx, a in enumerate(row.get("acciones") or []):
            items.append({"tabla": "coreografias", "row_id": row["id"], "idx": idx,
                          "pais": row["pais_code"], "origen": origen, "accion": a,
                          "acciones_full": row.get("acciones") or []})

    for row in sb_get("kpis_adicionales"):
        origen = row.get("nombre") or "KPI adicional"
        for idx, a in enumerate(row.get("acciones") or []):
            items.append({"tabla": "kpis_adicionales", "row_id": row["id"], "idx": idx,
                          "pais": row["pais_code"], "origen": origen, "accion": a,
                          "acciones_full": row.get("acciones") or []})

    for row in sb_get("proyectos_especiales"):
        origen = row.get("nombre") or "Proyecto especial"
        for idx, a in enumerate(row.get("acciones") or []):
            items.append({"tabla": "proyectos_especiales", "row_id": row["id"], "idx": idx,
                          "pais": row["pais_code"], "origen": origen, "accion": a,
                          "acciones_full": row.get("acciones") or []})

    return items


def cargar_usuarios_por_pais():
    usuarios = sb_get("perfiles_usuario", {"select": "email,pais_code,user_id"})
    por_pais = {}
    for u in usuarios:
        if u.get("user_id") and u.get("pais_code"):
            por_pais.setdefault(u["pais_code"], []).append(u["email"])
    return por_pais


def enviar_correo(destinatarios, asunto, cuerpo_texto):
    if not destinatarios:
        return
    msg = MIMEText(cuerpo_texto, "plain", "utf-8")
    msg["Subject"] = asunto
    msg["From"] = SMTP_USER
    msg["To"] = ", ".join(destinatarios)

    if SMTP_SECURE == "ssl":
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context()) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, destinatarios, msg.as_string())
    elif SMTP_SECURE == "starttls":
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, destinatarios, msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, destinatarios, msg.as_string())


def texto_items(items):
    lineas = []
    for it in items:
        a = it["accion"]
        lineas.append(
            "- [%s] %s\n    Acción: %s\n    Responsable: %s\n    Fecha compromiso: %s"
            % (PAISES.get(it["pais"], it["pais"]), it["origen"], a.get("accion") or "(sin descripción)",
               a.get("responsable") or "—", a.get("fecha") or "—")
        )
    return "\n".join(lineas)


def marcar_notificadas(items):
    por_fila = {}
    for it in items:
        key = (it["tabla"], it["row_id"])
        por_fila.setdefault(key, it["acciones_full"])
        por_fila[key][it["idx"]]["notificada"] = True
    for (tabla, row_id), acciones in por_fila.items():
        sb_patch(tabla, row_id, {"acciones": acciones})


def paso_diario(items, usuarios_por_pais):
    nuevas = [it for it in items if it["accion"].get("estado") == "Vencida" and not it["accion"].get("notificada")]
    if not nuevas:
        print("Sin acciones nuevas vencidas hoy.")
        return

    por_pais = {}
    for it in nuevas:
        por_pais.setdefault(it["pais"], []).append(it)

    for pais, its in por_pais.items():
        destinatarios = usuarios_por_pais.get(pais, [])
        if destinatarios:
            enviar_correo(
                destinatarios,
                "Acciones vencidas hoy — " + PAISES.get(pais, pais),
                "Estas acciones de tu país pasaron su fecha de compromiso y siguen pendientes:\n\n"
                + texto_items(its) + "\n\nActualízalas en el landing cuanto antes.",
            )

    enviar_correo(
        [REGIONAL_EMAIL],
        "Nuevas acciones vencidas hoy — todos los países",
        "Se marcaron como vencidas hoy:\n\n" + texto_items(nuevas),
    )

    marcar_notificadas(nuevas)
    print("Notificadas %d acciones nuevas vencidas." % len(nuevas))


def paso_semanal(items, usuarios_por_pais):
    vencidas = [it for it in items if it["accion"].get("estado") == "Vencida"]
    if not vencidas:
        print("Sin acciones vencidas para el resumen semanal.")
        return

    por_pais = {}
    for it in vencidas:
        por_pais.setdefault(it["pais"], []).append(it)

    for pais, its in por_pais.items():
        destinatarios = usuarios_por_pais.get(pais, [])
        if destinatarios:
            enviar_correo(
                destinatarios,
                "Resumen semanal — acciones vencidas de " + PAISES.get(pais, pais),
                "Todas las acciones vencidas de tu país al día de hoy:\n\n" + texto_items(its),
            )

    cuerpo_regional = ""
    for pais, its in por_pais.items():
        cuerpo_regional += "\n== %s (%d) ==\n%s\n" % (PAISES.get(pais, pais), len(its), texto_items(its))

    enviar_correo(
        [REGIONAL_EMAIL],
        "Resumen semanal consolidado — acciones vencidas (todos los países)",
        "Total de acciones vencidas: %d\n%s" % (len(vencidas), cuerpo_regional),
    )
    print("Resumen semanal enviado con %d acciones vencidas." % len(vencidas))


def main():
    catalogo_cache = cargar_catalogo()
    items = cargar_items(catalogo_cache)
    usuarios_por_pais = cargar_usuarios_por_pais()

    paso_diario(items, usuarios_por_pais)

    if hoy_cr().weekday() == 2:  # 0=lunes ... 2=miércoles
        items_frescos = cargar_items(catalogo_cache)
        paso_semanal(items_frescos, usuarios_por_pais)
    else:
        print("Hoy no es miércoles, se omite el resumen semanal.")


if __name__ == "__main__":
    main()
