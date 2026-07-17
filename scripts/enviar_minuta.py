import html as html_lib
import os
import smtplib
import ssl
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ["SMTP_PORT"])
SMTP_SECURE = os.environ.get("SMTP_SECURE", "starttls").lower()
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASS = os.environ["SMTP_PASS"]
REGIONAL_EMAIL = os.environ["REGIONAL_EMAIL"]

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
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


def sb_get(tabla, params):
    r = requests.get(SUPABASE_URL + "/rest/v1/" + tabla, headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def sb_patch(tabla, row_id, body):
    r = requests.patch(SUPABASE_URL + "/rest/v1/" + tabla, headers=HEADERS, params={"id": "eq." + row_id}, json=body)
    r.raise_for_status()


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


def tabla_acuerdos_html(acuerdos):
    filas = ""
    for a in acuerdos:
        filas += """
          <tr>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{texto};">{descripcion}</td>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{texto};white-space:nowrap;">{resp}</td>
            <td style="padding:9px 10px;border-bottom:1px solid {borde};font-size:12.5px;color:{azul};font-weight:700;white-space:nowrap;">{fecha}</td>
          </tr>""".format(
            borde=GRIS_BORDE, texto=GRIS_TEXTO, azul=AZUL,
            descripcion=esc(a.get("descripcion") or "(sin descripción)"),
            resp=esc(a.get("responsable_nombre") or a.get("responsable_email") or "—"),
            fecha=esc(a.get("fecha") or "—"),
        )
    return """
    <table style="width:100%;border-collapse:collapse;background:#fff;margin:14px 0;">
      <tr>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">Acuerdo</th>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">Responsable</th>
        <th style="padding:8px 10px;background:{azul};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.3px;">Fecha</th>
      </tr>
      {filas}
    </table>
    """.format(azul=AZUL, filas=filas)


def plantilla_html(titulo, intro, minuta, acuerdos):
    minuta_html = ("<div style=\"background:#fff;border-left:4px solid {verde};padding:14px 18px;margin:14px 0;font-size:13.5px;line-height:1.6;white-space:pre-wrap;\">{minuta}</div>"
                   .format(verde=VERDE, minuta=esc(minuta))) if minuta else ""
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
      {minuta_html}
      {tabla}
      <div style="margin-top:26px;">
        <a href="{link}" style="background:{verde};color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:11px 22px;border-radius:6px;display:inline-block;">Abrir el landing</a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid {borde};font-size:11.5px;color:#677C98;">
      ¡Apoyándote siempre! — Instacredit Riesgo Regional · Notificación automática, no responder a este correo.
    </div>
  </div>
</body></html>""".format(
        fondo=FONDO, azul=AZUL, verde=VERDE, verde_claro=VERDE_CLARO, texto=GRIS_TEXTO, borde=GRIS_BORDE,
        titulo=esc(titulo), intro=intro, minuta_html=minuta_html, tabla=tabla_acuerdos_html(acuerdos), link=LANDING_URL,
    )


def enviar_reunion(reunion):
    acuerdos = sb_get("acuerdos_reunion", {"select": "*", "reunion_id": "eq." + reunion["id"]})
    titulo = reunion.get("titulo") or "Reunión sin título"

    por_responsable = {}
    for a in acuerdos:
        email = (a.get("responsable_email") or "").strip().lower()
        if not email:
            continue
        por_responsable.setdefault(email, []).append(a)

    for email, sus_acuerdos in por_responsable.items():
        html_body = plantilla_html(
            "Minuta — " + titulo,
            "Se te asignaron acuerdos en esta reunión. Revisa el detalle y actualízalos desde el landing conforme avances.",
            reunion.get("minuta"),
            sus_acuerdos,
        )
        enviar_correo([email], "📋 Minuta — " + titulo, html_body)

    html_regional = plantilla_html(
        "Minuta consolidada — " + titulo,
        "Resumen de la reunión con todos los acuerdos y responsables asignados:",
        reunion.get("minuta"),
        acuerdos,
    )
    enviar_correo([REGIONAL_EMAIL], "📋 Minuta consolidada — " + titulo, html_regional)

    sb_patch("reuniones", reunion["id"], {
        "envio_pendiente": False,
        "envio_enviado_at": datetime.now(timezone.utc).isoformat(),
    })
    print("Minuta '%s' enviada a %d responsable(s) + regional." % (titulo, len(por_responsable)))


def main():
    reuniones = sb_get("reuniones", {"select": "*", "envio_pendiente": "eq.true"})
    if not reuniones:
        print("Sin minutas pendientes de envío.")
        return
    for reunion in reuniones:
        enviar_reunion(reunion)


if __name__ == "__main__":
    main()
