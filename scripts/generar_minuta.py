import json
import os
import unicodedata
from datetime import datetime, timezone, timedelta

import anthropic
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
REUNION_ID = os.environ.get("REUNION_ID", "").strip()

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
}

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

SCHEMA = {
    "type": "object",
    "properties": {
        "titulo": {
            "type": "string",
            "description": "Título corto (5-8 palabras) que describa el tema principal de la reunión, en español, basado en el contenido de la transcripción.",
        },
        "minuta": {
            "type": "string",
            "description": "Resumen ejecutivo de la reunión en español, 3-6 párrafos cortos.",
        },
        "acuerdos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "descripcion": {"type": "string", "description": "El acuerdo concreto tomado."},
                    "responsable_nombre": {"type": "string", "description": "Nombre de la persona responsable, tal como aparece en la transcripción."},
                    "responsable_email_tentativo": {"type": "string", "description": "Correo tentativo de la persona responsable si se menciona o se puede inferir del dominio @instacredit.com; texto vacío si no hay forma de saberlo."},
                    "fecha": {"type": "string", "description": "Fecha compromiso en formato YYYY-MM-DD si se menciona una fecha o plazo relativo (ej. 'la próxima semana'); texto vacío si no se definió fecha."},
                },
                "required": ["descripcion", "responsable_nombre", "responsable_email_tentativo", "fecha"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["titulo", "minuta", "acuerdos"],
    "additionalProperties": False,
}


def sb_get(tabla, params):
    r = requests.get(SUPABASE_URL + "/rest/v1/" + tabla, headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def sb_patch(tabla, row_id, body):
    r = requests.patch(SUPABASE_URL + "/rest/v1/" + tabla, headers=HEADERS, params={"id": "eq." + row_id}, json=body)
    r.raise_for_status()


def sb_insert(tabla, rows):
    if not rows:
        return
    r = requests.post(SUPABASE_URL + "/rest/v1/" + tabla, headers=HEADERS, json=rows)
    r.raise_for_status()


def hoy_cr():
    return datetime.now(timezone(timedelta(hours=-6))).date().isoformat()


def normalizar(s):
    s = (s or "").lower().strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def buscar_email_por_nombre(nombre_ia, perfiles):
    norm = normalizar(nombre_ia)
    if not norm:
        return ""
    for p in perfiles:
        if normalizar(p.get("nombre")) == norm:
            return (p.get("email") or "").lower()
    primer_token = norm.split(" ")[0]
    candidatos = [p for p in perfiles if normalizar(p.get("nombre")).split(" ")[0:1] == [primer_token]]
    if len(candidatos) == 1:
        return (candidatos[0].get("email") or "").lower()
    return ""


def procesar_reunion(reunion):
    print("Procesando reunión %s (%s)..." % (reunion["id"], reunion.get("titulo") or "sin título"))
    transcripcion = reunion.get("transcripcion") or ""
    if not transcripcion.strip():
        sb_patch("reuniones", reunion["id"], {"estado": "error"})
        print("  Sin transcripción, marcada como error.")
        return

    prompt = (
        "Eres un asistente que arma minutas de reuniones de Riesgo Regional de Instacredit "
        "(Costa Rica, Nicaragua, Panamá, El Salvador). Lee la siguiente transcripción y extrae:\n"
        "1. Un título corto que resuma el tema principal de la reunión.\n"
        "2. Una minuta ejecutiva breve.\n"
        "3. La lista de acuerdos/compromisos tomados, cada uno con su responsable y, si se mencionó, "
        "una fecha compromiso. Si un acuerdo no tiene responsable claro, usa el nombre de quien lo propuso "
        "o dejalo como 'Por asignar'. No inventes fechas ni correos que no estén en el texto.\n\n"
        "Fecha de hoy (para interpretar plazos relativos como 'la próxima semana'): " + hoy_cr() + "\n\n"
        "TRANSCRIPCIÓN:\n" + transcripcion
    )

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8000,
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )

    if response.stop_reason == "refusal":
        sb_patch("reuniones", reunion["id"], {"estado": "error"})
        print("  La IA rechazó procesar esta transcripción.")
        return

    texto = next(b.text for b in response.content if b.type == "text")
    data = json.loads(texto)

    perfiles = sb_get("perfiles_usuario", {"select": "email,nombre"})

    filas = []
    for a in data.get("acuerdos", []):
        nombre_ia = a.get("responsable_nombre") or ""
        email = buscar_email_por_nombre(nombre_ia, perfiles) or (a.get("responsable_email_tentativo") or "").strip().lower()
        filas.append({
            "reunion_id": reunion["id"],
            "descripcion": a.get("descripcion") or "",
            "responsable_nombre": nombre_ia,
            "responsable_email": email,
            "fecha": a.get("fecha") or None,
            "estado": "Pendiente",
        })
    sb_insert("acuerdos_reunion", filas)
    sb_patch("reuniones", reunion["id"], {
        "titulo": data.get("titulo") or reunion.get("titulo") or "Reunión sin título",
        "minuta": data.get("minuta") or "",
        "estado": "procesada",
    })
    print("  Minuta generada con %d acuerdo(s)." % len(filas))


def main():
    if REUNION_ID:
        reuniones = sb_get("reuniones", {"select": "*", "id": "eq." + REUNION_ID})
    else:
        reuniones = sb_get("reuniones", {"select": "*", "estado": "eq.pendiente_procesar"})

    if not reuniones:
        print("Sin reuniones pendientes de procesar.")
        return

    for reunion in reuniones:
        if REUNION_ID or reunion.get("estado") == "pendiente_procesar":
            procesar_reunion(reunion)


if __name__ == "__main__":
    main()
