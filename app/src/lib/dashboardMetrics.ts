import { AREAS_FALLBACK } from './catalogs'
import type { Accion } from '../components/AccionesTable'

export interface AccionAgregada {
  dominio: string
  pais: string
  kpi: string
  estado: string
  accionTexto: string
  responsable: string
  fecha: string
}

const AREA_NOMBRE: Record<string, string> = { A: 'Dominio A — Originación', B: 'Dominio B — Comercial', C: 'Dominio C — Cobro' }
const KPI_NOMBRE_POR_ID: Record<string, string> = Object.fromEntries(AREAS_FALLBACK.flatMap((a) => a.kpis).map((k) => [k.id, k.nombre]))

interface FilaConAcciones {
  acciones: unknown
  pais_code?: string | null
  area_id?: string
  kpi_id?: string
  nombre?: string | null
}

function collect(rows: FilaConAcciones[] | null, dominioFn: (r: FilaConAcciones) => string, kpiFn: (r: FilaConAcciones) => string): AccionAgregada[] {
  const salida: AccionAgregada[] = []
  ;(rows || []).forEach((r) => {
    const acciones = (r.acciones as Accion[] | null) || []
    acciones.forEach((a) => {
      if (!a.accion && !a.responsable) return
      salida.push({
        dominio: dominioFn(r), pais: r.pais_code || '', kpi: kpiFn(r),
        estado: a.estado || 'Pendiente', accionTexto: a.accion || '', responsable: a.responsable || '', fecha: a.fecha || '',
      })
    })
  })
  return salida
}

interface AcuerdoRow {
  reunion_id: string | null
  descripcion: string
  responsable_nombre: string | null
  estado: string
  fecha: string | null
}

export function construirTodas(
  coreoData: FilaConAcciones[] | null,
  proyData: FilaConAcciones[] | null,
  customData: FilaConAcciones[] | null,
  reunionesData: { id: string; titulo: string }[] | null,
  acuerdosData: AcuerdoRow[] | null,
): AccionAgregada[] {
  const todas: AccionAgregada[] = [
    ...collect(coreoData, (r) => AREA_NOMBRE[r.area_id || ''] || r.area_id || '', (r) => KPI_NOMBRE_POR_ID[r.kpi_id || ''] || r.kpi_id || ''),
    ...collect(customData, (r) => (AREA_NOMBRE[r.area_id || ''] || r.area_id || '') + ' (adicional)', (r) => r.nombre || 'KPI adicional'),
    ...collect(proyData, () => 'Proyectos especiales', (r) => r.nombre || 'Proyecto especial'),
  ]

  const tituloPorReunion = new Map((reunionesData || []).map((r) => [r.id, r.titulo || 'Reunión sin título']))
  ;(acuerdosData || []).forEach((a) => {
    if (!a.descripcion && !a.responsable_nombre) return
    todas.push({
      dominio: 'Acuerdos de reuniones', pais: 'ALL', kpi: tituloPorReunion.get(a.reunion_id || '') || 'Reunión sin título',
      estado: a.estado || 'Pendiente', accionTexto: a.descripcion || '', responsable: a.responsable_nombre || '', fecha: a.fecha || '',
    })
  })
  return todas
}

export function lunesDeLaSemana(fechaStr: string): Date {
  const d = new Date(fechaStr + 'T00:00:00')
  const dia = d.getDay()
  const offset = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + offset)
  return d
}

export function etiquetaSemana(key: string): string {
  const inicio = new Date(key + 'T00:00:00')
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })
  return `${fmt(inicio)} – ${fmt(fin)}`
}

export type OrdenVencidas = { campo: 'pais' | 'fecha'; dir: 'asc' | 'desc' }

export function ordenarVencidas(acciones: AccionAgregada[], orden: OrdenVencidas, nombrePais: (code: string) => string): AccionAgregada[] {
  const dirMul = orden.dir === 'asc' ? 1 : -1
  return acciones
    .filter((a) => a.estado === 'Vencida')
    .sort((a, b) => {
      if (orden.campo === 'fecha') {
        const cmp = (a.fecha || '').localeCompare(b.fecha || '')
        return cmp !== 0 ? cmp * dirMul : nombrePais(a.pais).localeCompare(nombrePais(b.pais))
      }
      const cmp = nombrePais(a.pais).localeCompare(nombrePais(b.pais))
      return cmp !== 0 ? cmp * dirMul : (b.fecha || '').localeCompare(a.fecha || '')
    })
}
