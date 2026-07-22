import { sb } from './supabase'
import type { AreaCatalogo } from './catalogs'
import type { Accion } from '../components/AccionesTable'
import type { CustomKpiState, KpiState, ProyectoState } from './stateShape'

function revisarAcciones(acciones: Accion[], origen: string): string | null {
  for (const accion of acciones) {
    if (accion.accion?.trim() && !accion.responsable?.trim()) {
      return `La acción "${accion.accion}" en ${origen} necesita un Responsable antes de guardar.`
    }
  }
  return null
}

function revisarPuntoControl(k: { puntoControl: string; fechaRevision: string; horaRevision: string }, origen: string): string | null {
  if (k.puntoControl?.trim() && !(k.fechaRevision && k.horaRevision)) {
    return `El KPI "${origen}" tiene texto en Punto de control, así que la Fecha de revisión con Riesgo Regional y la Hora sugerida son obligatorias antes de guardar.`
  }
  return null
}

export function validarAntesDeGuardar(
  areas: AreaCatalogo[],
  kpis: Record<string, Record<string, KpiState>>,
  customKpis: Record<string, CustomKpiState[]>,
  proyectos: ProyectoState[],
): string | null {
  for (const area of areas) {
    for (const kpi of area.kpis) {
      const k = kpis[area.id]?.[kpi.id]
      if (!k) continue
      const err = revisarAcciones(k.acciones, kpi.nombre) || revisarPuntoControl(k, kpi.nombre)
      if (err) return err
    }
    for (const c of customKpis[area.id] || []) {
      const err = revisarAcciones(c.acciones, c.nombre || 'un KPI adicional') || revisarPuntoControl(c, c.nombre || 'un KPI adicional')
      if (err) return err
    }
  }
  for (const proy of proyectos) {
    const err = revisarAcciones(proy.acciones, proy.nombre || 'un proyecto especial')
    if (err) return err
  }
  return null
}

interface GuardarProyectosResultado {
  error?: string
  proyectos: ProyectoState[]
}

/** Guarda solo proyectos especiales de un país (o del pseudo-país 'RG') — usado también desde "KPI y tareas Regional". */
export async function guardarProyectos(paisCode: string, areaNegocio: string, proyectos: ProyectoState[]): Promise<GuardarProyectosResultado> {
  const { data: freshProy } = await sb.from('proyectos_especiales').select('id,fecha_seguimiento,hora_seguimiento').eq('pais_code', paisCode).eq('area_negocio', areaNegocio)
  const freshProyMap = new Map((freshProy || []).map((r) => [r.id, r]))

  const proyectosFinal: ProyectoState[] = proyectos.map((p) => {
    const fresh = freshProyMap.get(p.id)
    const usarFresh = !!p.fechaSeguimiento && !!fresh
    const fechaSeguimiento = usarFresh ? fresh!.fecha_seguimiento || '' : p.fechaSeguimiento
    const horaSeguimiento = usarFresh ? fresh!.hora_seguimiento || '' : p.horaSeguimiento
    return { ...p, fechaSeguimiento, horaSeguimiento }
  })
  const proyectoRows = proyectosFinal.map((p, i) => ({
    id: p.id, pais_code: paisCode, area_negocio: areaNegocio, nombre: p.nombre, descripcion: p.descripcion,
    responsable: p.responsable, estado: p.estado, fecha_seguimiento: p.fechaSeguimiento || null,
    hora_seguimiento: p.horaSeguimiento || null, acciones: p.acciones, orden: i, updated_at: new Date().toISOString(),
  }))

  let error: string | undefined
  const { error: delErr } = await sb.from('proyectos_especiales').delete().eq('pais_code', paisCode).eq('area_negocio', areaNegocio)
  if (delErr) error = delErr.message
  if (!delErr && proyectoRows.length) {
    const { error: err } = await sb.from('proyectos_especiales').insert(proyectoRows as never)
    if (err) error = err.message
  }
  return { error, proyectos: proyectosFinal }
}

interface GuardarParams {
  paisCode: string
  areaNegocio: string
  areas: AreaCatalogo[]
  kpis: Record<string, Record<string, KpiState>>
  customKpis: Record<string, CustomKpiState[]>
  proyectos: ProyectoState[]
}

interface GuardarResultado {
  error?: string
  kpis: Record<string, Record<string, KpiState>>
  proyectos: ProyectoState[]
  customKpis: Record<string, CustomKpiState[]>
}

/**
 * Guarda coreografías + proyectos especiales + KPI adicionales de un país.
 * Antes de escribir, refresca desde la nube los campos de fecha/hora ya
 * bloqueados (comprometidos), para no pisar un ajuste que Riesgo Regional
 * haya hecho por su cuenta (p.ej. desde "Fechas y horas") mientras esta
 * sesión tenía un valor viejo en memoria — mismo comportamiento que
 * `saveActiveCountry()` del sitio legado.
 */
export async function guardarPais({ paisCode, areaNegocio, areas, kpis, customKpis, proyectos }: GuardarParams): Promise<GuardarResultado> {
  const [{ data: freshCoreo }, { data: freshCustom }] = await Promise.all([
    sb.from('coreografias').select('area_id,kpi_id,fecha_revision,hora_revision').eq('pais_code', paisCode).eq('area_negocio', areaNegocio),
    sb.from('kpis_adicionales').select('id,fecha_revision,hora_revision').eq('pais_code', paisCode).eq('area_negocio', areaNegocio),
  ])
  const freshCoreoMap = new Map((freshCoreo || []).map((r) => [r.area_id + '|' + r.kpi_id, r]))
  const freshCustomMap = new Map((freshCustom || []).map((r) => [r.id, r]))

  const kpisFinal: Record<string, Record<string, KpiState>> = {}
  const rows: Record<string, unknown>[] = []
  areas.forEach((area) => {
    kpisFinal[area.id] = {}
    area.kpis.forEach((kpi) => {
      const k = kpis[area.id]?.[kpi.id]
      if (!k) return
      const fresh = freshCoreoMap.get(area.id + '|' + kpi.id)
      const usarFresh = !!k.fechaRevision && !!fresh
      const fechaRevision = usarFresh ? fresh!.fecha_revision || '' : k.fechaRevision
      const horaRevision = usarFresh ? fresh!.hora_revision || '' : k.horaRevision
      kpisFinal[area.id][kpi.id] = { ...k, fechaRevision, horaRevision }
      rows.push({
        pais_code: paisCode, area_negocio: areaNegocio, area_id: area.id, kpi_id: kpi.id,
        situacion: k.situacion, objetivo: k.objetivo, responsable: k.responsable, punto_control: k.puntoControl,
        fecha_revision: fechaRevision || null, hora_revision: horaRevision || null, acciones: k.acciones,
        updated_at: new Date().toISOString(),
      })
    })
  })

  const customKpisFinal: Record<string, CustomKpiState[]> = {}
  const customKpiRows: Record<string, unknown>[] = []
  areas.forEach((area) => {
    customKpisFinal[area.id] = (customKpis[area.id] || []).map((c, i) => {
      const fresh = freshCustomMap.get(c.id)
      const usarFresh = !!c.fechaRevision && !!fresh
      const fechaRevision = usarFresh ? fresh!.fecha_revision || '' : c.fechaRevision
      const horaRevision = usarFresh ? fresh!.hora_revision || '' : c.horaRevision
      customKpiRows.push({
        id: c.id, pais_code: paisCode, area_negocio: areaNegocio, area_id: area.id, nombre: c.nombre, definicion: c.definicion,
        situacion: c.situacion, objetivo: c.objetivo, responsable: c.responsable, punto_control: c.puntoControl,
        fecha_revision: fechaRevision || null, hora_revision: horaRevision || null, acciones: c.acciones, orden: i,
        updated_at: new Date().toISOString(),
      })
      return { ...c, fechaRevision, horaRevision }
    })
  })

  let error: string | undefined

  if (rows.length) {
    const { error: err } = await sb.from('coreografias').upsert(rows as never, { onConflict: 'pais_code,area_negocio,area_id,kpi_id' })
    if (err) error = err.message
  }

  const proyResultado = await guardarProyectos(paisCode, areaNegocio, proyectos)
  if (proyResultado.error) error = error || proyResultado.error

  const { error: delCustomErr } = await sb.from('kpis_adicionales').delete().eq('pais_code', paisCode).eq('area_negocio', areaNegocio)
  if (delCustomErr) error = error || delCustomErr.message
  if (!delCustomErr && customKpiRows.length) {
    const { error: err } = await sb.from('kpis_adicionales').insert(customKpiRows as never)
    if (err) error = error || err.message
  }

  return { error, kpis: kpisFinal, proyectos: proyResultado.proyectos, customKpis: customKpisFinal }
}
