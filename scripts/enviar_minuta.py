import html as html_lib
import io
import os
import re
import smtplib
import ssl
from datetime import datetime, timezone, timedelta
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

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


def fecha_hora_reunion(reunion):
    fecha_texto = reunion.get("fecha") or ""
    hora_texto = ""
    creado_at = reunion.get("creado_at")
    if creado_at:
        try:
            dt = datetime.fromisoformat(creado_at.replace("Z", "+00:00"))
            dt_cr = dt.astimezone(timezone(timedelta(hours=-6)))
            hora_texto = dt_cr.strftime("%I:%M %p").lstrip("0")
        except Exception:
            pass
    return fecha_texto, hora_texto


def resumen_corto(minuta):
    texto = (minuta or "").strip()
    if not texto:
        return ""
    primer_parrafo = re.split(r"\n\s*\n", texto)[0]
    return (primer_parrafo[:377] + "…") if len(primer_parrafo) > 380 else primer_parrafo


def generar_pdf(titulo, fecha_texto, hora_texto, minuta, acuerdos):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm)

    style_titulo = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=17, textColor=colors.HexColor(AZUL), spaceAfter=4)
    style_meta = ParagraphStyle("meta", fontName="Helvetica", fontSize=10, textColor=colors.HexColor(VERDE), spaceAfter=14)
    style_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor(AZUL), spaceBefore=10, spaceAfter=6)
    style_body = ParagraphStyle("body", fontName="Helvetica", fontSize=10, textColor=colors.HexColor(GRIS_TEXTO), leading=14, spaceAfter=8)
    style_acuerdo_desc = ParagraphStyle("acdesc", fontName="Helvetica-Bold", fontSize=10.5, textColor=colors.HexColor(GRIS_TEXTO), leading=14)
    style_acuerdo_meta = ParagraphStyle("acmeta", fontName="Helvetica", fontSize=9.5, textColor=colors.HexColor(AZUL), leading=13, leftIndent=10, spaceAfter=8)

    story = [
        Paragraph(esc(titulo or "Reunión sin título"), style_titulo),
        Paragraph(esc(" · ".join(filter(None, [fecha_texto, hora_texto]))), style_meta),
    ]

    if minuta and minuta.strip():
        story.append(Paragraph("MINUTA", style_h2))
        for parrafo in re.split(r"\n\s*\n", minuta.strip()):
            story.append(Paragraph(esc(parrafo).replace("\n", "<br/>"), style_body))

    story.append(Paragraph("ACUERDOS (%d)" % len(acuerdos), style_h2))
    if not acuerdos:
        story.append(Paragraph("Sin acuerdos registrados.", style_body))
    for i, a in enumerate(acuerdos):
        story.append(Paragraph(esc(str(i + 1) + ". " + (a.get("descripcion") or "(sin descripción)")), style_acuerdo_desc))
        meta = "Responsable: %s   ·   Fecha: %s   ·   Estado: %s" % (
            a.get("responsable_nombre") or a.get("responsable_email") or "—",
            a.get("fecha") or "—",
            a.get("estado") or "Pendiente",
        )
        story.append(Paragraph(esc(meta), style_acuerdo_meta))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor(GRIS_BORDE), spaceAfter=8))

    doc.build(story)
    return buffer.getvalue()


def enviar_correo(destinatarios, asunto, cuerpo_html, pdf_bytes, nombre_archivo):
    if not destinatarios:
        return
    msg = MIMEMultipart("mixed")
    msg["Subject"] = asunto
    msg["From"] = "Riesgo Regional Instacredit <" + SMTP_USER + ">"
    msg["To"] = ", ".join(destinatarios)

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText("Este correo requiere un cliente compatible con HTML. Entra a " + LANDING_URL, "plain", "utf-8"))
    alt.attach(MIMEText(cuerpo_html, "html", "utf-8"))
    msg.attach(alt)

    adjunto = MIMEApplication(pdf_bytes, _subtype="pdf")
    adjunto.add_header("Content-Disposition", "attachment", filename=nombre_archivo)
    msg.attach(adjunto)

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


def plantilla_html(titulo, fecha_texto, hora_texto, intro, resumen):
    cuando_texto = " · ".join(filter(None, [fecha_texto, hora_texto]))
    resumen_html = ("<div style=\"background:#fff;border-left:4px solid {verde};padding:14px 18px;margin:14px 0;font-size:13.5px;line-height:1.6;white-space:pre-wrap;\">{resumen}</div>"
                     .format(verde=VERDE, resumen=esc(resumen))) if resumen else ""
    return """<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:{fondo};font-family:Arial,'Segoe UI',sans-serif;color:{texto};">
  <div style="max-width:680px;margin:0 auto;background:{fondo};">
    <div style="background:{azul};padding:26px 28px;">
      <div style="color:{verde_claro};font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Riesgo Regional · Instacredit</div>
      <div style="color:#fff;font-size:22px;font-weight:800;">{titulo}</div>
      {cuando_html}
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:14px;line-height:1.6;">{intro}</p>
      {resumen_html}
      <p style="font-size:13.5px;line-height:1.6;background:#fff;border:1px dashed {borde};border-radius:6px;padding:12px 16px;">
        📎 En el archivo adjunto va el detalle completo de la sesión, con la minuta y todos los acuerdos asignados.
      </p>
      <div style="margin-top:22px;">
        <a href="{link}" style="background:{verde};color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:11px 22px;border-radius:6px;display:inline-block;">Abrir el landing</a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid {borde};font-size:11.5px;color:#677C98;">
      ¡Apoyándote siempre! — Instacredit Riesgo Regional · Notificación automática, no responder a este correo.
    </div>
  </div>
</body></html>""".format(
        fondo=FONDO, azul=AZUL, verde=VERDE, verde_claro=VERDE_CLARO, texto=GRIS_TEXTO, borde=GRIS_BORDE,
        titulo=esc(titulo), intro=intro, resumen_html=resumen_html, link=LANDING_URL,
        cuando_html=('<div style="color:{vc};font-size:13px;margin-top:6px;">{c}</div>'.format(vc=VERDE_CLARO, c=esc(cuando_texto)) if cuando_texto else ""),
    )


def enviar_reunion(reunion):
    acuerdos = sb_get("acuerdos_reunion", {"select": "*", "reunion_id": "eq." + reunion["id"]})
    titulo = reunion.get("titulo") or "Reunión sin título"
    fecha_texto, hora_texto = fecha_hora_reunion(reunion)
    resumen = resumen_corto(reunion.get("minuta"))
    nombre_archivo = "Minuta - " + re.sub(r'[\\/:*?"<>|]', "", titulo)[:60] + ".pdf"

    por_responsable = {}
    for a in acuerdos:
        email = (a.get("responsable_email") or "").strip().lower()
        if not email:
            continue
        por_responsable.setdefault(email, []).append(a)

    for email, sus_acuerdos in por_responsable.items():
        html_body = plantilla_html(titulo, fecha_texto, hora_texto, "Se te asignaron acuerdos en esta reunión.", resumen)
        pdf_bytes = generar_pdf(titulo, fecha_texto, hora_texto, reunion.get("minuta"), sus_acuerdos)
        enviar_correo([email], "📋 Minuta — " + titulo, html_body, pdf_bytes, nombre_archivo)

    html_regional = plantilla_html(titulo, fecha_texto, hora_texto, "Resumen consolidado de la reunión con todos los acuerdos y responsables asignados.", resumen)
    pdf_regional = generar_pdf(titulo, fecha_texto, hora_texto, reunion.get("minuta"), acuerdos)
    enviar_correo([REGIONAL_EMAIL], "📋 Minuta consolidada — " + titulo, html_regional, pdf_regional, nombre_archivo)

    participantes = reunion.get("participantes") or []
    enviados_participantes = 0
    for p in participantes:
        email = (p.get("email") or "").strip().lower()
        if not email or email in por_responsable:
            continue
        html_participante = plantilla_html(
            titulo, fecha_texto, hora_texto,
            "Participaste en esta reunión. No se te asignó ningún acuerdo directamente, pero aquí tienes el resumen completo.",
            resumen,
        )
        enviar_correo([email], "📋 Minuta — " + titulo, html_participante, pdf_regional, nombre_archivo)
        enviados_participantes += 1

    sb_patch("reuniones", reunion["id"], {
        "envio_pendiente": False,
        "envio_enviado_at": datetime.now(timezone.utc).isoformat(),
    })
    print("Minuta '%s' enviada a %d responsable(s) + regional + %d participante(s)." % (titulo, len(por_responsable), enviados_participantes))


def main():
    reuniones = sb_get("reuniones", {"select": "*", "envio_pendiente": "eq.true"})
    if not reuniones:
        print("Sin minutas pendientes de envío.")
        return
    for reunion in reuniones:
        enviar_reunion(reunion)


if __name__ == "__main__":
    main()
