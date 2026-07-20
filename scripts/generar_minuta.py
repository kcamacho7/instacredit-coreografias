import json
import os
import re
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

# Transcripciones más largas que esto se procesan por fragmentos (map-reduce) en vez de en una
# sola llamada: así el modelo nunca tiene que "sostener" una sesión entera en un solo pase, lo
# que es cuando empieza a omitir participantes/acuerdos secundarios, y cada llamada individual
# se mantiene barata (fragmentos pequeños, salidas pequeñas).
UMBRAL_FRAGMENTAR = 15000
TAMANO_FRAGMENTO = 12000

ACUERDO_PROPS = {
    "descripcion": {"type": "string", "description": "El acuerdo concreto tomado."},
    "responsable_nombre": {"type": "string", "description": "Nombre de la persona responsable, tal como aparece en la transcripción."},
    "responsable_email_tentativo": {"type": "string", "description": "Correo tentativo de la persona responsable si se menciona o se puede inferir del dominio @instacredit.com; texto vacío si no hay forma de saberlo."},
    "fecha": {"type": "string", "description": "Fecha compromiso en formato YYYY-MM-DD, calculada tomando la fecha de la reunión como referencia si se mencionó un plazo relativo (ej. 'la próxima semana'); texto vacío si no se definió fecha."},
}
PARTICIPANTE_PROPS = {
    "nombre": {"type": "string", "description": "Nombre completo del participante, tal como quedó identificado (idealmente ya emparejado con la lista de usuarios registrados)."},
    "email_tentativo": {"type": "string", "description": "Correo tentativo si se menciona explícitamente en el texto o se puede inferir del dominio @instacredit.com; texto vacío si no hay forma de saberlo."},
}
MINUTA_DESC = (
    "Minuta en español, estructurada en secciones separadas por una línea en blanco, cada una "
    "con su encabezado en MAYÚSCULAS seguido de dos puntos, sin markdown ni emojis, en este "
    "orden exacto: OBJETIVO (1-2 frases con el propósito principal de la reunión), AGENDA "
    "(temas tratados, uno por línea precedido de un guion), DESARROLLO (resumen de la discusión "
    "por tema, 2-5 párrafos cortos, sin transcribir literalmente), RIESGOS O PENDIENTES "
    "(problemas identificados o temas que requieren seguimiento; si no hubo ninguno, escribe "
    "'Ninguno identificado.'), PROXIMOS PASOS (fecha tentativa de la próxima reunión si se "
    "mencionó, y acciones a revisar). No repitas aquí la lista de acuerdos ni de participantes: "
    "esos ya se documentan aparte."
)

SCHEMA_COMPLETO = {
    "type": "object",
    "properties": {
        "titulo": {"type": "string", "description": "Título corto (5-8 palabras) que describa el tema principal de la reunión, en español, basado en el contenido de la transcripción."},
        "minuta": {"type": "string", "description": MINUTA_DESC},
        "acuerdos": {"type": "array", "items": {"type": "object", "properties": ACUERDO_PROPS, "required": ["descripcion", "responsable_nombre", "responsable_email_tentativo", "fecha"], "additionalProperties": False}},
        "participantes": {
            "type": "array",
            "description": "Todos los participantes identificados en la transcripción, tengan o no un acuerdo asignado. El sistema filtra automáticamente a quienes ya aparecen como responsables de un acuerdo.",
            "items": {"type": "object", "properties": PARTICIPANTE_PROPS, "required": ["nombre", "email_tentativo"], "additionalProperties": False},
        },
    },
    "required": ["titulo", "minuta", "acuerdos", "participantes"],
    "additionalProperties": False,
}

# Esquema del pase MAP (por fragmento): solo extrae, no redacta la minuta todavía — así cada
# llamada por fragmento es barata y no necesita "ver" el resto de la reunión.
SCHEMA_FRAGMENTO = {
    "type": "object",
    "properties": {
        "resumen": {"type": "string", "description": "Resumen breve (2-5 frases) de los temas discutidos y avances mencionados en ESTE fragmento de la transcripción, en español. No es la minuta final, solo insumo para armarla después."},
        "acuerdos": {"type": "array", "items": {"type": "object", "properties": ACUERDO_PROPS, "required": ["descripcion", "responsable_nombre", "responsable_email_tentativo", "fecha"], "additionalProperties": False}},
        "participantes": {
            "type": "array",
            "description": "Todos los participantes identificados en ESTE fragmento, tengan o no un acuerdo asignado.",
            "items": {"type": "object", "properties": PARTICIPANTE_PROPS, "required": ["nombre", "email_tentativo"], "additionalProperties": False},
        },
    },
    "required": ["resumen", "acuerdos", "participantes"],
    "additionalProperties": False,
}

# Esquema del pase REDUCE: recibe los resúmenes ya condensados de cada fragmento (mucho más
# cortos que la transcripción original), no el texto crudo — arma solo el título y la minuta.
SCHEMA_REDUCE = {
    "type": "object",
    "properties": {
        "titulo": {"type": "string", "description": "Título corto (5-8 palabras) que describa el tema principal de la reunión, en español."},
        "minuta": {"type": "string", "description": MINUTA_DESC},
    },
    "required": ["titulo", "minuta"],
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


RE_NOMBRE_MEET = re.compile(r"([A-ZÁÉÍÓÚÑ][a-zñáéíóúü]+(?: [A-ZÁÉÍÓÚÑ][a-zñáéíóúü]+){1,4})\s{2,}\d{1,2}:\d{2}")
RE_NOMBRE_DOSPUNTOS = re.compile(r"^([A-ZÁÉÍÓÚÑ][\wñáéíóúü]+(?: [A-ZÁÉÍÓÚÑ][\wñáéíóúü]+){0,4}):", re.MULTILINE)


def extraer_nombres_de_transcripcion(texto):
    """Respaldo determinístico: la IA a veces omite hablantes minoritarios en transcripciones
    muy largas, así que además se extraen los nombres directamente de las marcas de hablante
    del texto (exportación de Google Meet "Nombre   H:MM" o formato manual "Nombre:")."""
    nombres = set(RE_NOMBRE_MEET.findall(texto or ""))
    nombres.update(RE_NOMBRE_DOSPUNTOS.findall(texto or ""))
    return nombres


def partir_en_fragmentos(texto, tamano_max):
    """Parte la transcripción en fragmentos por límites de línea (nunca corta una intervención
    a la mitad), cada uno de hasta tamano_max caracteres."""
    lineas = texto.split("\n")
    partes = []
    actual = ""
    for linea in lineas:
        candidato = (actual + "\n" + linea) if actual else linea
        if len(candidato) > tamano_max and actual:
            partes.append(actual)
            actual = linea
        else:
            actual = candidato
    if actual:
        partes.append(actual)
    return partes


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


def resolver_acuerdos(acuerdos, perfiles):
    filas = []
    for a in acuerdos:
        nombre_ia = a.get("responsable_nombre") or ""
        email = buscar_email_por_nombre(nombre_ia, perfiles) or (a.get("responsable_email_tentativo") or "").strip().lower()
        filas.append({
            "descripcion": a.get("descripcion") or "",
            "responsable_nombre": nombre_ia,
            "responsable_email": email,
            "fecha": a.get("fecha") or None,
        })
    return filas


def llamar_claude(prompt, schema):
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8000,
        output_config={"format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": prompt}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("La IA rechazó procesar esta transcripción.")
    texto = next(b.text for b in response.content if b.type == "text")
    return json.loads(texto)


def prompt_base(roster_texto, fecha_reunion):
    return (
        "Eres un asistente que prepara minutas de reuniones de Instacredit "
        "(Costa Rica, Nicaragua, Panamá, El Salvador) para cargarlas en un sistema de seguimiento de "
        "acuerdos. Tu trabajo tiene dos pasos: primero reconstruir mentalmente la reunión de forma "
        "estructurada (participantes, temas, acuerdos), y luego devolver solo el JSON final. No resumas "
        "de más, no omitas acuerdos ni participantes, y no inventes información que no esté en el texto original.\n\n"
        "PASO 1 — Identifica a TODOS los PARTICIPANTES que hablaron en el texto, con su nombre completo "
        "tal como se identifican (ej. 'Kenneth Camacho', no 'Kenneth' ni 'KC'). Compara cada nombre contra "
        "esta lista de usuarios ya registrados en el sistema y, si hay una coincidencia clara (aunque el "
        "texto solo diga el primer nombre o tenga errores de transcripción fonéticos), usa el "
        "nombre completo EXACTO tal como aparece en esta lista — así el sistema puede enlazar el acuerdo o la "
        "invitación a la minuta automáticamente a la cuenta correcta:\n" + roster_texto + "\n\n"
        "PASO 2 — Identifica cada ACUERDO o compromiso concreto que se haya tomado. Reglas estrictas:\n"
        "- Un acuerdo = una persona responsable. Si el mismo compromiso involucra a dos personas, sepáralo "
        "en dos acuerdos independientes, uno por responsable — nunca agrupes varios compromisos bajo una "
        "sola persona ni se los atribuyas a quien más habló.\n"
        "- El responsable_nombre debe ser el nombre completo de la persona tal como quedó en PARTICIPANTES "
        "(idealmente ya emparejado con la lista de usuarios registrados de arriba).\n"
        "- Si el responsable_nombre coincide con alguien de la lista de usuarios, usa su correo real en "
        "responsable_email_tentativo. Si no coincide con nadie de la lista pero el correo se menciona "
        "explícitamente en el texto, úsalo. Si no hay forma confiable de saberlo, deja el campo "
        "vacío — no inventes correos.\n"
        "- Si no quedó claro quién es el responsable, usa 'Por asignar' — no le asignes el "
        "acuerdo a quien más participó ni adivines.\n"
        "- Usa la fecha de la reunión como punto de referencia para calcular cualquier plazo relativo que "
        "se mencione (ej. 'el viernes', 'la próxima semana', 'en 15 días', 'a fin de mes') y conviértelo a "
        "una fecha exacta YYYY-MM-DD posterior a la fecha de la reunión. Si de verdad no se mencionó ningún "
        "plazo ni referencia de tiempo para un acuerdo, deja la fecha vacía — no inventes una fecha sin "
        "ninguna pista en el texto.\n\n"
        "Fecha de la reunión (usa esta fecha, no la de hoy, como referencia para calcular plazos relativos): "
        + fecha_reunion + "\n\n"
    )


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
    base = prompt_base(roster_texto, fecha_reunion)

    try:
        if len(transcripcion) <= UMBRAL_FRAGMENTAR:
            # Transcripción corta/mediana: un solo pase (más barato para el caso común).
            prompt = base + (
                "PASO 3 — Con base en lo anterior, arma:\n"
                "1. Un título corto (5-8 palabras) que resuma el tema principal de la reunión.\n"
                "2. La minuta, siguiendo exactamente la estructura de secciones descrita en el esquema de salida "
                "(OBJETIVO, AGENDA, DESARROLLO, RIESGOS O PENDIENTES, PROXIMOS PASOS) — sin repetir ahí la lista de "
                "acuerdos ni de participantes, que ya van aparte.\n"
                "3. La lista final de acuerdos según las reglas del PASO 2.\n"
                "4. La lista completa de PARTICIPANTES del PASO 1 (todos, tengan o no un acuerdo asignado), con su "
                "nombre y correo tentativo — el sistema se encarga de filtrar automáticamente a quienes ya quedaron "
                "como responsables de un acuerdo, así que no los excluyas tú.\n\n"
                "TRANSCRIPCIÓN:\n" + transcripcion
            )
            data = llamar_claude(prompt, SCHEMA_COMPLETO)
            titulo = data.get("titulo")
            minuta_texto = data.get("minuta")
            acuerdos_resueltos = resolver_acuerdos(data.get("acuerdos", []), perfiles)
            participantes_ia = data.get("participantes", [])
        else:
            # Transcripción larga: map-reduce. Cada fragmento se procesa por separado (barato, sin
            # necesitar ver el resto de la reunión) y al final una sola llamada pequeña, con los
            # resúmenes ya condensados (no el texto crudo), arma el título y la minuta.
            fragmentos = partir_en_fragmentos(transcripcion, TAMANO_FRAGMENTO)
            resumenes = []
            acuerdos_crudos = []
            participantes_ia = []
            for i, fragmento in enumerate(fragmentos):
                prompt_fragmento = base + (
                    "IMPORTANTE: lo que sigue es el FRAGMENTO %d de %d de una transcripción más larga — no es la "
                    "reunión completa. Analiza solo lo que aparece en este fragmento, no asumas contexto de "
                    "fragmentos anteriores o posteriores. Devuelve:\n"
                    "1. Un resumen breve (2-5 frases) de los temas y avances mencionados en este fragmento.\n"
                    "2. Los acuerdos identificados en este fragmento según las reglas del PASO 2.\n"
                    "3. Todos los participantes identificados en este fragmento (PASO 1), tengan o no un acuerdo asignado.\n\n"
                    "FRAGMENTO %d DE %d:\n" % (i + 1, len(fragmentos), i + 1, len(fragmentos))
                ) + fragmento
                data_fragmento = llamar_claude(prompt_fragmento, SCHEMA_FRAGMENTO)
                resumenes.append("Fragmento %d: %s" % (i + 1, data_fragmento.get("resumen") or ""))
                acuerdos_crudos.extend(data_fragmento.get("acuerdos", []))
                participantes_ia.extend(data_fragmento.get("participantes", []))
            acuerdos_resueltos = resolver_acuerdos(acuerdos_crudos, perfiles)

            prompt_reduce = (
                "Eres un asistente que redacta la minuta final de una reunión larga de Instacredit, a partir "
                "de resúmenes ya preparados de cada fragmento de la transcripción (no tienes el texto crudo completo). "
                "Con base en estos resúmenes, en el orden en que ocurrieron, y en la lista de acuerdos ya identificados, "
                "arma:\n"
                "1. Un título corto (5-8 palabras) que resuma el tema principal de la reunión.\n"
                "2. La minuta, siguiendo exactamente la estructura de secciones descrita en el esquema de salida "
                "(OBJETIVO, AGENDA, DESARROLLO, RIESGOS O PENDIENTES, PROXIMOS PASOS) — sin repetir ahí la lista de "
                "acuerdos ni de participantes, que ya se documentan aparte.\n\n"
                "RESÚMENES POR FRAGMENTO:\n" + "\n\n".join(resumenes) + "\n\n"
                "ACUERDOS YA IDENTIFICADOS (%d):\n" % len(acuerdos_resueltos)
                + "\n".join(
                    "%d. %s — responsable: %s" % (i + 1, a["descripcion"], a["responsable_nombre"] or "Por asignar")
                    for i, a in enumerate(acuerdos_resueltos)
                )
            )
            data_reduce = llamar_claude(prompt_reduce, SCHEMA_REDUCE)
            titulo = data_reduce.get("titulo")
            minuta_texto = data_reduce.get("minuta")
    except RuntimeError as e:
        sb_patch("reuniones", reunion["id"], {"estado": "error"})
        print("  " + str(e))
        return

    filas = [{
        "reunion_id": reunion["id"],
        "area_negocio": area_reunion,
        "descripcion": a["descripcion"],
        "responsable_nombre": a["responsable_nombre"],
        "responsable_email": a["responsable_email"],
        "fecha": a["fecha"],
        "estado": "Pendiente",
    } for a in acuerdos_resueltos]
    sb_insert("acuerdos_reunion", filas)

    # Sugiere como "participantes adicionales" (reciben la minuta, sin acuerdo propio) a quien
    # la IA identificó en la reunión pero no quedó como responsable de ningún acuerdo, más los
    # hablantes detectados por el respaldo determinístico que la IA no haya mencionado. El
    # organizador confirma o ajusta la lista sugerida desde la tarjeta de la reunión.
    nombres_con_acuerdo = {normalizar(f["responsable_nombre"]) for f in filas if f["responsable_nombre"]}
    existentes = reunion.get("participantes") or []
    emails_existentes = {(p.get("email") or "").lower() for p in existentes if p.get("email")}

    nombres_ia = {normalizar(p.get("nombre") or "") for p in participantes_ia}
    participantes_combinados = list(participantes_ia)
    for nombre in extraer_nombres_de_transcripcion(transcripcion):
        if normalizar(nombre) not in nombres_ia:
            participantes_combinados.append({"nombre": nombre, "email_tentativo": ""})

    vistos = set()
    sugeridos = []
    for p in participantes_combinados:
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
        "titulo": titulo or reunion.get("titulo") or "Reunión sin título",
        "minuta": minuta_texto or "",
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
