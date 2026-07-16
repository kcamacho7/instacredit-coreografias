import os
import smtplib
import ssl
import html as html_lib
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
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

LANDING_URL = "https://kcamacho7.github.io/instacredit-coreografias/"

VERDE = "#46A139"
AZUL = "#1D2953"
ROJO = "#EE232E"
VERDE_CLARO = "#7CC36A"
GRIS_TEXTO = "#333740"
GRIS_BORDE = "#D2D2D2"
FONDO = "#F2F4F7"


def esc(v):
    return html_lib.escape(str(v or ""), quote=True)


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


def tabla_html(items):
    filas = ""
    for it in items:
        a = it["accion"]
        filas += """
          <tr>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{azul};font-weight:700;white-space:nowrap;">{pais}</td>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{texto};">{origen}</td>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{texto};">{accion}</td>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{texto};white-space:nowrap;">{resp}</td>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{rojo};font-weight:700;white-space:nowrap;">{fecha}</td>
          </tr>""".format(
            borde=GRIS_BORDE, azul=AZUL, texto=GRIS_TEXTO, rojo=ROJO,
            pais=esc(PAISES.get(it["pais"], it["pais"])),
            origen=esc(it["origen"]),
            accion=esc(a.get("accion") or "(sin descripción)"),
            resp=esc(a.get("responsable") or "—"),
            fecha=esc(a.get("fecha") or "—"),
        )
    return """
    <table style="width:100%;border-collapse:collapse;background:#fff;margin:14px 0;">
      <tr>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">País</th>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">KPI / Proyecto</th>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">Acción</th>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">Responsable</th>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">Fecha</th>
      </tr>
      {filas}
    </table>
    """.format(azul=AZUL, filas=filas)


def plantilla_html(eyebrow, titulo, intro, secciones, boton_texto="Abrir el landing"):
    """secciones: lista de (subtitulo, tabla_html) o solo tabla_html si no hay subtitulo"""
    bloques = ""
    for sub, tabla in secciones:
        if sub:
            bloques += '<h3 style="color:{azul};font-size:15px;margin:22px 0 4px 0;">{sub}</h3>'.format(azul=AZUL, sub=esc(sub))
        bloques += tabla

    return """<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:{fondo};font-family:Arial,'Segoe UI',sans-serif;color:{texto};">
  <div style="max-width:680px;margin:0 auto;background:{fondo};">
    <div style="background:{azul};padding:26px 28px;">
      <div style="color:{verde_claro};font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Riesgo Regional · Instacredit</div>
      <div style="color:#fff;font-size:22px;font-weight:800;">{titulo}</div>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:14px;line-height:1.6;">{intro}</p>
      {bloques}
      <div style="margin-top:26px;">
        <a href="{link}" style="background:{verde};color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:11px 22px;border-radius:6px;display:inline-block;">{boton_texto}</a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid {borde};font-size:11.5px;color:#677C98;">
      ¡Apoyándote siempre! — Instacredit Riesgo Regional · Notificación automática, no responder a este correo.
    </div>
  </div>
</body></html>""".format(
        fondo=FONDO, azul=AZUL, verde=VERDE, verde_claro=VERDE_CLARO, texto=GRIS_TEXTO, borde=GRIS_BORDE,
        titulo=esc(titulo), intro=intro, bloques=bloques, link=LANDING_URL, boton_texto=esc(boton_texto),
    )


def enviar_correo(destinatarios, asunto, cuerpo_html):
    if not destinatarios:
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"] = "Riesgo Regional Instacredit <" + SMTP_USER + ">"
    msg["To"] = ", ".join(destinatarios)
    msg.attach(MIMEText("Este correo requiere un cliente compatible con HTML. Entra a " + LANDING_URL, "plain", "utf-8"))
    msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))

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


def marcar_flag(items, flag):
    por_fila = {}
    for it in items:
        key = (it["tabla"], it["row_id"])
        por_fila.setdefault(key, it["acciones_full"])
        por_fila[key][it["idx"]][flag] = True
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
            html_body = plantilla_html(
                "Alerta diaria",
                "Acciones vencidas hoy — " + PAISES.get(pais, pais),
                "Estas acciones de tu país pasaron su fecha de compromiso y siguen sin cumplirse. Actualízalas cuanto antes desde el landing.",
                [(None, tabla_html(its))],
            )
            enviar_correo(destinatarios, "⚠ Acciones vencidas hoy — " + PAISES.get(pais, pais), html_body)

    html_regional = plantilla_html(
        "Alerta diaria",
        "Nuevas acciones vencidas hoy — todos los países",
        "Se marcaron como vencidas hoy en el sistema:",
        [(None, tabla_html(nuevas))],
    )
    enviar_correo([REGIONAL_EMAIL], "⚠ Nuevas acciones vencidas hoy (%d)" % len(nuevas), html_regional)

    marcar_flag(nuevas, "notificada")
    print("Notificadas %d acciones nuevas vencidas." % len(nuevas))


def paso_recordatorio(items, usuarios_por_pais):
    manana = (hoy_cr() + timedelta(days=1)).isoformat()
    por_vencer = [
        it for it in items
        if it["accion"].get("fecha") == manana
        and it["accion"].get("estado") in ("Pendiente", "En curso")
        and not it["accion"].get("recordada")
    ]
    if not por_vencer:
        print("Sin acciones que venzan mañana.")
        return

    por_pais = {}
    for it in por_vencer:
        por_pais.setdefault(it["pais"], []).append(it)

    for pais, its in por_pais.items():
        destinatarios = usuarios_por_pais.get(pais, [])
        if destinatarios:
            html_body = plantilla_html(
                "Recordatorio",
                "Acciones que vencen mañana — " + PAISES.get(pais, pais),
                "Estas acciones de tu país tienen fecha de compromiso mañana. Actualiza su estado o resultado antes de que venzan.",
                [(None, tabla_html(its))],
            )
            enviar_correo(destinatarios, "⏰ Recordatorio — acciones que vencen mañana en " + PAISES.get(pais, pais), html_body)

    html_regional = plantilla_html(
        "Recordatorio",
        "Acciones que vencen mañana — todos los países",
        "Se les recordó hoy a los gerentes correspondientes:",
        [(None, tabla_html(por_vencer))],
    )
    enviar_correo([REGIONAL_EMAIL], "⏰ Recordatorio — acciones que vencen mañana (%d)" % len(por_vencer), html_regional)

    marcar_flag(por_vencer, "recordada")
    print("Recordadas %d acciones que vencen mañana." % len(por_vencer))


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
            html_body = plantilla_html(
                "Resumen semanal",
                "Resumen semanal — acciones vencidas de " + PAISES.get(pais, pais),
                "Todas las acciones vencidas de tu país al día de hoy (%d en total):" % len(its),
                [(None, tabla_html(its))],
            )
            enviar_correo(destinatarios, "📋 Resumen semanal — " + PAISES.get(pais, pais), html_body)

    secciones = [(PAISES.get(pais, pais) + " (" + str(len(its)) + ")", tabla_html(its)) for pais, its in por_pais.items()]
    html_regional = plantilla_html(
        "Resumen semanal",
        "Resumen semanal consolidado — todos los países",
        "Total de acciones vencidas en la región: <strong>%d</strong>" % len(vencidas),
        secciones,
    )
    enviar_correo([REGIONAL_EMAIL], "📋 Resumen semanal consolidado (%d vencidas)" % len(vencidas), html_regional)
    print("Resumen semanal enviado con %d acciones vencidas." % len(vencidas))


def paso_prueba(items, correo, pais_code):
    vencidas = [it for it in items if it["pais"] == pais_code and it["accion"].get("estado") == "Vencida"]
    html_body = plantilla_html(
        "Prueba",
        "Prueba — acciones vencidas de " + PAISES.get(pais_code, pais_code),
        "Este es un envío de prueba manual (no afecta el estado de notificación real). Acciones vencidas actuales de tu país (%d):" % len(vencidas),
        [(None, tabla_html(vencidas))],
    )
    enviar_correo([correo], "🧪 Prueba — acciones vencidas de " + PAISES.get(pais_code, pais_code), html_body)
    print("Prueba enviada a %s con %d acciones vencidas." % (correo, len(vencidas)))


def main():
    catalogo_cache = cargar_catalogo()
    items = cargar_items(catalogo_cache)
    usuarios_por_pais = cargar_usuarios_por_pais()

    correo_prueba = os.environ.get("CORREO_PRUEBA", "").strip()
    pais_prueba = os.environ.get("PAIS_PRUEBA", "").strip().upper()
    if correo_prueba and pais_prueba:
        paso_prueba(items, correo_prueba, pais_prueba)
        return

    paso_diario(items, usuarios_por_pais)

    items_para_recordatorio = cargar_items(catalogo_cache)
    paso_recordatorio(items_para_recordatorio, usuarios_por_pais)

    forzar_semanal = os.environ.get("FORZAR_SEMANAL", "").lower() == "true"
    if hoy_cr().weekday() == 2 or forzar_semanal:  # 0=lunes ... 2=miércoles
        items_frescos = cargar_items(catalogo_cache)
        paso_semanal(items_frescos, usuarios_por_pais)
    else:
        print("Hoy no es miércoles, se omite el resumen semanal.")


if __name__ == "__main__":
    main()
