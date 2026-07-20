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
            "description": (
                "Minuta en español, estructurada en secciones separadas por una línea en blanco, cada una "
                "con su encabezado en MAYÚSCULAS seguido de dos puntos, sin markdown ni emojis, en este "
                "orden exacto: OBJETIVO (1-2 frases con el propósito principal de la reunión), AGENDA "
                "(temas tratados, uno por línea precedido de un guion), DESARROLLO (resumen de la discusión "
                "por tema, 2-5 párrafos cortos, sin transcribir literalmente), RIESGOS O PENDIENTES "
                "(problemas identificados o temas que requieren seguimiento; si no hubo ninguno, escribe "
                "'Ninguno identificado.'), PROXIMOS PASOS (fecha tentativa de la próxima reunión si se "
                "mencionó, y acciones a revisar). No repitas aquí la lista de acuerdos ni de participantes: "
                "esos ya se documentan aparte."
            ),
        },
        "acuerdos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "descripcion": {"type": "string", "description": "El acuerdo concreto tomado."},
                    "responsable_nombre": {"type": "string", "description": "Nombre de la persona responsable, tal como aparece en la transcripción."},
                    "responsable_email_tentativo": {"type": "string", "description": "Correo tentativo de la persona responsable si se menciona o se puede inferir del dominio @instacredit.com; texto vacío si no hay forma de saberlo."},
                    "fecha": {"type": "string", "description": "Fecha compromiso en formato YYYY-MM-DD, calculada tomando la fecha de la reunión como referencia si se mencionó un plazo relativo (ej. 'la próxima semana'); texto vacío si no se definió fecha."},
                },
                "required": ["descripcion", "responsable_nombre", "responsable_email_tentativo", "fecha"],
                "additionalProperties": False,
            },
        },
        "participantes": {
            "type": "array",
            "description": "Todos los participantes identificados en la transcripción (PASO 1), tengan o no un acuerdo asignado. El sistema filtra automáticamente a quienes ya aparecen como responsables de un acuerdo.",
            "items": {
                "type": "object",
                "properties": {
                    "nombre": {"type": "string", "description": "Nombre completo del participante, tal como quedó identificado en PASO 1 (idealmente ya emparejado con la lista de usuarios registrados)."},
                    "email_tentativo": {"type": "string", "description": "Correo tentativo si se menciona explícitamente en la transcripción o se puede inferir del dominio @instacredit.com; texto vacío si no hay forma de saberlo."},
                },
                "required": ["nombre", "email_tentativo"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["titulo", "minuta", "acuerdos", "participantes"],
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

    area_reunion = reunion.get("area_negocio") or "riesgo"
    perfiles = sb_get("perfiles_usuario", {"select": "email,nombre", "area_negocio": "eq." + area_reunion})
    roster = sorted({(p.get("nombre") or "").strip() for p in perfiles if (p.get("nombre") or "").strip()})
    roster_texto = "\n".join("- " + n for n in roster) if roster else "(sin usuarios registrados todavía)"

    fecha_reunion = reunion.get("fecha") or hoy_cr()
    prompt = (
        "Eres un asistente que prepara minutas de reuniones de Riesgo Regional de Instacredit "
        "(Costa Rica, Nicaragua, Panamá, El Salvador) para cargarlas en un sistema de seguimiento de "
        "acuerdos. Tu trabajo tiene dos pasos: primero reconstruir mentalmente la reunión de forma "
        "estructurada (participantes, temas, acuerdos), y luego devolver solo el JSON final. No resumas "
        "de más, no omitas acuerdos y no inventes información que no esté en el texto original.\n\n"
        "PASO 1 — Identifica a TODOS los PARTICIPANTES que hablaron en la transcripción, con su nombre completo "
        "tal como se identifican (ej. 'Kenneth Camacho', no 'Kenneth' ni 'KC'). Compara cada nombre contra "
        "esta lista de usuarios ya registrados en el sistema y, si hay una coincidencia clara (aunque la "
        "transcripción solo diga el primer nombre o tenga errores de transcripción fonéticos), usa el "
        "nombre completo EXACTO tal como aparece en esta lista — así el sistema puede enlazar el acuerdo "
        "automáticamente a la cuenta correcta:\n" + roster_texto + "\n\n"
        "PASO 2 — Identifica cada ACUERDO o compromiso concreto que se haya tomado. Reglas estrictas:\n"
        "- Un acuerdo = una persona responsable. Si el mismo compromiso involucra a dos personas, sepáralo "
        "en dos acuerdos independientes, uno por responsable — nunca agrupes varios compromisos bajo una "
        "sola persona ni se los atribuyas a quien más habló.\n"
        "- El responsable_nombre debe ser el nombre completo de la persona tal como quedó en PARTICIPANTES "
        "(idealmente ya emparejado con la lista de usuarios registrados de arriba).\n"
        "- Si el responsable_nombre coincide con alguien de la lista de usuarios, usa su correo real en "
        "responsable_email_tentativo. Si no coincide con nadie de la lista pero el correo se menciona "
        "explícitamente en la transcripción, úsalo. Si no hay forma confiable de saberlo, deja el campo "
        "vacío — no inventes correos.\n"
        "- Si en la reunión no quedó claro quién es el responsable, usa 'Por asignar' — no le asignes el "
        "acuerdo a quien más participó ni adivines.\n"
        "- Usa la fecha de la reunión como punto de referencia para calcular cualquier plazo relativo que "
        "se mencione (ej. 'el viernes', 'la próxima semana', 'en 15 días', 'a fin de mes') y conviértelo a "
        "una fecha exacta YYYY-MM-DD posterior a la fecha de la reunión. Si de verdad no se mencionó ningún "
        "plazo ni referencia de tiempo para un acuerdo, deja la fecha vacía — no inventes una fecha sin "
        "ninguna pista en el texto.\n\n"
        "PASO 3 — Con base en lo anterior, arma:\n"
        "1. Un título corto (5-8 palabras) que resuma el tema principal de la reunión.\n"
        "2. La minuta, siguiendo exactamente la estructura de secciones descrita en el esquema de salida "
        "(OBJETIVO, AGENDA, DESARROLLO, RIESGOS O PENDIENTES, PROXIMOS PASOS) — sin repetir ahí la lista de "
        "acuerdos ni de participantes, que ya van aparte.\n"
        "3. La lista final de acuerdos según las reglas del PASO 2.\n"
        "4. La lista completa de PARTICIPANTES del PASO 1 (todos, tengan o no un acuerdo asignado), con su "
        "nombre y correo tentativo — el sistema se encarga de filtrar automáticamente a quienes ya quedaron "
        "como responsables de un acuerdo, así que no los excluyas tú.\n\n"
        "Fecha de la reunión (usa esta fecha, no la de hoy, como referencia para calcular plazos relativos): "
        + fecha_reunion + "\n\n"
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

    filas = []
    for a in data.get("acuerdos", []):
        nombre_ia = a.get("responsable_nombre") or ""
        email = buscar_email_por_nombre(nombre_ia, perfiles) or (a.get("responsable_email_tentativo") or "").strip().lower()
        filas.append({
            "reunion_id": reunion["id"],
            "area_negocio": area_reunion,
            "descripcion": a.get("descripcion") or "",
            "responsable_nombre": nombre_ia,
            "responsable_email": email,
            "fecha": a.get("fecha") or None,
            "estado": "Pendiente",
        })
    sb_insert("acuerdos_reunion", filas)

    # Sugiere como "participantes adicionales" (reciben la minuta, sin acuerdo propio) a quien
    # la IA identificó en la reunión pero no quedó como responsable de ningún acuerdo. El
    # organizador confirma o ajusta la lista sugerida desde la tarjeta de la reunión.
    nombres_con_acuerdo = {normalizar(f["responsable_nombre"]) for f in filas if f["responsable_nombre"]}
    existentes = reunion.get("participantes") or []
    emails_existentes = {(p.get("email") or "").lower() for p in existentes if p.get("email")}
    vistos = set()
    sugeridos = []
    for p in data.get("participantes", []):
        nombre = (p.get("nombre") or "").strip()
        if not nombre or normalizar(nombre) in nombres_con_acuerdo:
            continue
        email = buscar_email_por_nombre(nombre, perfiles) or (p.get("email_tentativo") or "").strip().lower()
        if not email or email in emails_existentes or email in vistos:
            continue
        vistos.add(email)
        sugeridos.append({"email": email, "nombre": nombre})
    participantes_final = existentes + sugeridos

    sb_patch("reuniones", reunion["id"], {
        "titulo": data.get("titulo") or reunion.get("titulo") or "Reunión sin título",
        "minuta": data.get("minuta") or "",
        "participantes": participantes_final,
        "estado": "procesada",
    })
    print("  Minuta generada con %d acuerdo(s) y %d participante(s) sugerido(s)." % (len(filas), len(sugeridos)))


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
