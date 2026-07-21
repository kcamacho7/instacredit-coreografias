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
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle, Image

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ["SMTP_PORT"])
SMTP_SECURE = (os.environ.get("SMTP_SECURE") or "starttls").strip().lower()
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASS = os.environ["SMTP_PASS"]
REGIONAL_EMAIL = os.environ["REGIONAL_EMAIL"]

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
}

LANDING_URL = "https://kcamacho7.github.io/instacredit-coreografias/"
LOGO_URL = LANDING_URL + "assets/logo_claro.png"
PRESTAMITO_URL = LANDING_URL + "assets/prestamito_senalando.png"

VERDE = "#4C9C2E"
AZUL = "#002554"
VERDE_CLARO = "#CEF0C4"
AZUL_CLARO = "#677C98"
GRIS_TEXTO = "#333333"
GRIS_BORDE = "#D2D2D2"
FONDO = "#F5FCF3"
ROJO = "#EE212E"

ESTADO_COLORES = {"Pendiente": AZUL_CLARO, "En curso": VERDE, "Cumplida": AZUL, "Vencida": ROJO}


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


def _logo_flowable():
    try:
        resp = requests.get(LOGO_URL, timeout=8)
        resp.raise_for_status()
        ancho = 34 * mm
        alto = ancho * (248 / 1000)
        return Image(io.BytesIO(resp.content), width=ancho, height=alto)
    except Exception:
        return None


def generar_pdf(titulo, fecha_texto, hora_texto, minuta, acuerdos):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=16 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm)
    ancho_util = A4[0] - 36 * mm

    style_eyebrow = ParagraphStyle("eyebrow", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor(VERDE_CLARO), leading=11, spaceAfter=4)
    style_titulo_header = ParagraphStyle("titulohdr", fontName="Helvetica-Bold", fontSize=16, textColor=colors.white, leading=19)
    style_meta_header = ParagraphStyle("metahdr", fontName="Helvetica", fontSize=10, textColor=colors.HexColor(VERDE_CLARO), leading=13, spaceBefore=4)
    style_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor(AZUL), spaceBefore=14, spaceAfter=8)
    style_body = ParagraphStyle("body", fontName="Helvetica", fontSize=10, textColor=colors.HexColor(GRIS_TEXTO), leading=14, spaceAfter=8)
    style_cell_head = ParagraphStyle("cellhead", fontName="Helvetica-Bold", fontSize=8.5, textColor=colors.white, leading=11)
    style_cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=9, textColor=colors.HexColor(GRIS_TEXTO), leading=12)
    style_cell_num = ParagraphStyle("cellnum", parent=style_cell, alignment=TA_CENTER)

    story = []

    logo_img = _logo_flowable()
    celda_header = [logo_img] if logo_img else []
    celda_header += [
        Paragraph("RIESGO REGIONAL &middot; INSTACREDIT", style_eyebrow),
        Paragraph(esc(titulo or "Reunión sin título"), style_titulo_header),
        Paragraph(esc(" · ".join(filter(None, [fecha_texto, hora_texto])) or "Por definir"), style_meta_header),
    ]
    tabla_header = Table([[celda_header]], colWidths=[ancho_util])
    tabla_header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(AZUL)),
        ("LEFTPADDING", (0, 0), (-1, -1), 14 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 12 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12 * mm),
    ]))
    story.append(tabla_header)
    barra_verde = Table([[""]], colWidths=[ancho_util], rowHeights=[3])
    barra_verde.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(VERDE))]))
    story.append(barra_verde)
    story.append(Spacer(1, 18))

    if minuta and minuta.strip():
        story.append(Paragraph("MINUTA", style_h2))
        for parrafo in re.split(r"\n\s*\n", minuta.strip()):
            if not parrafo.strip():
                continue
            story.append(Paragraph(esc(parrafo).replace("\n", "<br/>"), style_body))

    acuerdos_con_contenido = [a for a in acuerdos if (a.get("descripcion") or "").strip() or (a.get("responsable_nombre") or "").strip()]
    story.append(Paragraph("ACUERDOS (%d)" % len(acuerdos_con_contenido), style_h2))
    if not acuerdos_con_contenido:
        story.append(Paragraph("Sin acuerdos registrados.", style_body))
    else:
        filas = [[
            Paragraph("#", style_cell_head),
            Paragraph("ACUERDO", style_cell_head),
            Paragraph("RESPONSABLE", style_cell_head),
            Paragraph("FECHA", style_cell_head),
            Paragraph("ESTADO", style_cell_head),
        ]]
        for i, a in enumerate(acuerdos_con_contenido):
            estado = a.get("estado") or "Pendiente"
            style_estado = ParagraphStyle("estado%d" % i, parent=style_cell, fontName="Helvetica-Bold", textColor=colors.HexColor(ESTADO_COLORES.get(estado, GRIS_TEXTO)))
            filas.append([
                Paragraph(str(i + 1), style_cell_num),
                Paragraph(esc(a.get("descripcion") or "(sin descripción)"), style_cell),
                Paragraph(esc(a.get("responsable_nombre") or a.get("responsable_email") or "—"), style_cell),
                Paragraph(esc(a.get("fecha") or "Por definir"), style_cell),
                Paragraph(esc(estado), style_estado),
            ])
        anchos = [8 * mm, 0.36 * ancho_util, 0.22 * ancho_util, 0.16 * ancho_util, 0.18 * ancho_util]
        tabla_acuerdos = Table(filas, colWidths=anchos, repeatRows=1)
        estilo = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(AZUL)),
            ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor(GRIS_BORDE)),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]
        for fila_idx in range(1, len(filas)):
            if fila_idx % 2 == 0:
                estilo.append(("BACKGROUND", (0, fila_idx), (-1, fila_idx), colors.HexColor(FONDO)))
        tabla_acuerdos.setStyle(TableStyle(estilo))
        story.append(tabla_acuerdos)

    doc.build(story)
    return buffer.getvalue()


def enviar_correo(destinatarios, asunto, cuerpo_html, pdf_bytes, nombre_archivo, nombre_area):
    if not destinatarios:
        return
    msg = MIMEMultipart("mixed")
    msg["Subject"] = asunto
    msg["From"] = nombre_area + " Regional Instacredit <" + SMTP_USER + ">"
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


def plantilla_html(nombre_area, titulo, fecha_texto, hora_texto, intro, resumen, nota_final=None):
    cuando_texto = " · ".join(filter(None, [fecha_texto, hora_texto]))
    label_style = "display:block;font-size:10.5px;font-weight:700;color:{azul};text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;".format(azul=AZUL)
    resumen_html = ("""<div style="background:{vc}22;border:1px solid {vc};border-left:4px solid {verde};border-radius:0 8px 8px 0;padding:14px 18px;margin:18px 0 0 0;font-size:13.5px;line-height:1.6;color:{texto};white-space:pre-wrap;">"""
                     """<span style="{label_style}">Resumen de la minuta</span>{resumen}</div>"""
                     .format(vc=VERDE_CLARO, verde=VERDE, texto=GRIS_TEXTO, label_style=label_style, resumen=esc(resumen))) if resumen and resumen.strip() else ""
    nota_html = ("""<div style="margin-top:16px;padding:13px 16px;background:#fff;border:1px solid {borde};border-radius:8px;font-size:12.5px;line-height:1.55;color:{texto};">"""
                 """<span style="{label_style}">💬 Nota importante</span>{nota}</div>"""
                 .format(borde=GRIS_BORDE, texto=GRIS_TEXTO, label_style=label_style, nota=esc(nota_final))) if nota_final and nota_final.strip() else ""
    cuando_html = ('<div style="color:{vc};font-size:13px;margin-top:6px;">{c}</div>'.format(vc=VERDE_CLARO, c=esc(cuando_texto)) if cuando_texto else "")
    intro_html = ('<p style="font-size:14px;line-height:1.6;margin:0;">{intro}</p>'.format(intro=intro) if intro and intro.strip() else "")
    return """<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:{fondo};font-family:Arial,'Segoe UI',sans-serif;color:{texto};">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,37,84,.12);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{azul};border-collapse:collapse;border-radius:16px 16px 0 0;overflow:hidden;">
      <tr>
        <td style="padding:26px 8px 26px 28px;vertical-align:middle;border-radius:16px 0 0 0;">
          <img src="{logo}" alt="Instacredit" height="22" style="display:block;margin-bottom:14px;border:0;">
          <div style="color:{verde_claro};font-weight:700;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">{nombre_area} Regional · Instacredit</div>
          <div style="color:#fff;font-size:21px;font-weight:800;line-height:1.3;">{titulo}</div>
          {cuando_html}
        </td>
        <td style="width:76px;padding:0 22px 0 0;text-align:right;vertical-align:bottom;border-radius:0 16px 0 0;">
          <img src="{prestamito}" alt="Prestamito" width="70" style="display:block;border:0;">
        </td>
      </tr>
    </table>
    <div style="height:4px;background:{verde};"></div>
    <div style="padding:26px 28px 6px 28px;">
      {intro_html}
      {resumen_html}
      <div style="font-size:13px;line-height:1.6;background:{fondo};border:1px dashed {borde};border-radius:8px;padding:12px 16px;margin:16px 0 0 0;">
        <span style="{label_style}">📎 Archivo adjunto</span>El detalle completo de la sesión va en el PDF adjunto, con la minuta y todos los acuerdos asignados.
      </div>
      {nota_html}
    </div>
    <div style="padding:20px 28px 26px 28px;">
      <a href="{link}" style="background:{verde};color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:11px 24px;border-radius:8px;display:inline-block;">Abrir el landing</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid {borde};background:{fondo};font-size:11.5px;color:{azul_claro};border-radius:0 0 16px 16px;">
      ¡Apoyándote siempre! — Instacredit {nombre_area} Regional · Notificación automática, no responder a este correo.
    </div>
  </div>
</body></html>""".format(
        fondo=FONDO, azul=AZUL, verde=VERDE, verde_claro=VERDE_CLARO, azul_claro=AZUL_CLARO,
        texto=GRIS_TEXTO, borde=GRIS_BORDE, logo=LOGO_URL, prestamito=PRESTAMITO_URL,
        titulo=esc(titulo), intro_html=intro_html, resumen_html=resumen_html, nota_html=nota_html,
        link=LANDING_URL, cuando_html=cuando_html, nombre_area=esc(nombre_area), label_style=label_style,
    )


def enviar_reunion(reunion):
    area_reunion = reunion.get("area_negocio") or "riesgo"
    areas = sb_get("areas_negocio", {"select": "nombre", "codigo": "eq." + area_reunion})
    nombre_area = areas[0]["nombre"] if areas else "Riesgo"

    acuerdos = sb_get("acuerdos_reunion", {"select": "*", "reunion_id": "eq." + reunion["id"]})
    titulo = reunion.get("titulo") or "Reunión sin título"
    fecha_texto, hora_texto = fecha_hora_reunion(reunion)
    resumen = resumen_corto(reunion.get("minuta"))
    nombre_archivo = "Minuta - " + re.sub(r'[\\/:*?"<>|]', "", titulo)[:60] + ".pdf"

    nota_organizador = (
        "En caso de considerar que debe ajustarse algo de la minuta favor contactarse con el organizador de la sesión. "
        "Si no se notifican cambios en los próximos 2 días, la minuta será definitiva."
    )

    por_responsable = {}
    for a in acuerdos:
        email = (a.get("responsable_email") or "").strip().lower()
        if not email:
            continue
        por_responsable.setdefault(email, []).append(a)

    for email, sus_acuerdos in por_responsable.items():
        html_body = plantilla_html(nombre_area, titulo, fecha_texto, hora_texto, "Se te asignaron acuerdos en esta reunión.", resumen, nota_organizador)
        pdf_bytes = generar_pdf(titulo, fecha_texto, hora_texto, reunion.get("minuta"), sus_acuerdos)
        enviar_correo([email], "📋 Minuta — " + titulo, html_body, pdf_bytes, nombre_archivo, nombre_area)

    html_regional = plantilla_html(nombre_area, titulo, fecha_texto, hora_texto, "Resumen consolidado de la reunión con todos los acuerdos y responsables asignados.", resumen, nota_organizador)
    pdf_regional = generar_pdf(titulo, fecha_texto, hora_texto, reunion.get("minuta"), acuerdos)
    enviar_correo([REGIONAL_EMAIL], "📋 Minuta consolidada — " + titulo, html_regional, pdf_regional, nombre_archivo, nombre_area)

    participantes = reunion.get("participantes") or []
    enviados_participantes = 0
    for p in participantes:
        email = (p.get("email") or "").strip().lower()
        if not email or email in por_responsable:
            continue
        html_participante = plantilla_html(
            nombre_area, titulo, fecha_texto, hora_texto,
            "Participaste en esta reunión. No se te asignó ningún acuerdo directamente, pero aquí tienes el resumen completo.",
            resumen,
            nota_organizador,
        )
        enviar_correo([email], "📋 Minuta — " + titulo, html_participante, pdf_regional, nombre_archivo, nombre_area)
        enviados_participantes += 1

    sb_patch("reuniones", reunion["id"], {
        "envio_pendiente": False,
        "envio_enviado_at": datetime.now(timezone.utc).isoformat(),
    })
    print("Minuta '%s' enviada a %d responsable(s) + regional + %d participante(s)." % (titulo, len(por_responsable), enviados_participantes))


def enviar_prueba(correo):
    """Envía un correo de ejemplo con datos ficticios, sin tocar la base de datos, para confirmar el formato."""
    titulo = "🧪 Ejemplo — Reunión de seguimiento semanal"
    fecha_texto, hora_texto = "2026-07-21", "10:00 AM"
    minuta = (
        "Se discutieron los avances del mes de julio en materia de cobranza y colocación.\n\n"
        "Se acordó reforzar el seguimiento diario de las cuentas en mora temprana.\n\n"
        "Adicionalmente se revisó el estado de los proyectos especiales de la región, destacando avances en el Agente RiskIA."
    )
    resumen = resumen_corto(minuta)
    acuerdos = [
        {"descripcion": "Enviar listado de cuentas vencidas a cobro", "responsable_nombre": "Walter Chavarría", "responsable_email": "", "fecha": "2026-07-25", "estado": "Pendiente"},
        {"descripcion": "Actualizar dashboard de KPIs con corte a julio", "responsable_nombre": "Marco Valverde", "responsable_email": "", "fecha": "", "estado": "En curso"},
    ]
    nota = ("Este es un correo de EJEMPLO para confirmar el formato — no corresponde a una reunión real. "
            "En caso de considerar que debe ajustarse algo de la minuta favor contactarse con el organizador de la sesión.")
    html_body = plantilla_html("Riesgo", titulo, fecha_texto, hora_texto,
                                "Se generó la minuta de esta reunión con IA. Revisa el resumen abajo y el detalle completo en el PDF adjunto.",
                                resumen, nota)
    pdf_bytes = generar_pdf(titulo, fecha_texto, hora_texto, minuta, acuerdos)
    enviar_correo([correo], "🧪 Prueba de formato — Minuta", html_body, pdf_bytes, "Minuta - Ejemplo.pdf", "Riesgo")
    print("Correo de prueba enviado a %s." % correo)


def main():
    correo_prueba = (os.environ.get("CORREO_PRUEBA") or "").strip()
    if correo_prueba:
        enviar_prueba(correo_prueba)
        return
    reuniones = sb_get("reuniones", {"select": "*", "envio_pendiente": "eq.true"})
    if not reuniones:
        print("Sin minutas pendientes de envío.")
        return
    for reunion in reuniones:
        enviar_reunion(reunion)


if __name__ == "__main__":
    main()
