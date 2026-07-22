import type { Accion, HistorialFecha } from '../components/AccionesTable'
import { emptyAccion } from '../components/AccionesTable'
import type { Json, Tables } from '../types/database.types'

function parseAcciones(json: Json): Accion[] {
  const arr = json as unknown as Accion[] | null
  return arr && arr.length ? arr : [emptyAccion()]
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface KpiState {
  situacion: string
  objetivo: string
  responsable: string
  puntoControl: string
  fechaRevision: string
  horaRevision: string
  acciones: Accion[]
  /** Historial/ajustes de fechaRevision — solo de sesión, no se persiste en Supabase (igual que en el sitio legado). */
  historialFechaRevision?: HistorialFecha[]
  ajustesUsuarioFechaRevision?: number
}

export interface CustomKpiState extends KpiState {
  id: string
  nombre: string
  definicion: string
}

export interface ProyectoState {
  id: string
  nombre: string
  descripcion: string
  responsable: string
  estado: string
  fechaSeguimiento: string
  horaSeguimiento: string
  acciones: Accion[]
  historialFechaSeguimiento?: HistorialFecha[]
  ajustesUsuarioFechaSeguimiento?: number
}

export function emptyKpiState(): KpiState {
  return { situacion: '', objetivo: '', responsable: '', puntoControl: '', fechaRevision: '', horaRevision: '', acciones: [emptyAccion()] }
}

export function emptyCustomKpi(): CustomKpiState {
  return { id: uuid(), nombre: '', definicion: '', ...emptyKpiState() }
}

export function emptyProyecto(): ProyectoState {
  return {
    id: uuid(), nombre: '', descripcion: '', responsable: '', estado: 'Pendiente',
    fechaSeguimiento: '', horaSeguimiento: '', acciones: [emptyAccion()],
  }
}

export function kpiTieneContenido(k: KpiState): boolean {
  return !!(k.situacion || k.objetivo || k.responsable || k.puntoControl || k.fechaRevision || k.acciones.some((a) => a.accion || a.responsable))
}

export function proyectoTieneContenido(p: ProyectoState): boolean {
  return !!(p.nombre || p.descripcion || p.responsable || p.fechaSeguimiento || p.acciones.some((a) => a.accion || a.responsable))
}

export function filaCoreografiaAKpiState(row: Tables<'coreografias'>): KpiState {
  return {
    situacion: row.situacion || '',
    objetivo: row.objetivo || '',
    responsable: row.responsable || '',
    puntoControl: row.punto_control || '',
    fechaRevision: row.fecha_revision || '',
    horaRevision: row.hora_revision || '',
    acciones: parseAcciones(row.acciones),
  }
}

export function filaProyectoAProyectoState(row: Tables<'proyectos_especiales'>): ProyectoState {
  return {
    id: row.id,
    nombre: row.nombre || '',
    descripcion: row.descripcion || '',
    responsable: row.responsable || '',
    estado: row.estado || 'Pendiente',
    fechaSeguimiento: row.fecha_seguimiento || '',
    horaSeguimiento: row.hora_seguimiento || '',
    acciones: parseAcciones(row.acciones),
  }
}

export function filaCustomKpiAState(row: Tables<'kpis_adicionales'>): CustomKpiState {
  return {
    id: row.id,
    nombre: row.nombre || '',
    definicion: row.definicion || '',
    situacion: row.situacion || '',
    objetivo: row.objetivo || '',
    responsable: row.responsable || '',
    puntoControl: row.punto_control || '',
    fechaRevision: row.fecha_revision || '',
    horaRevision: row.hora_revision || '',
    acciones: parseAcciones(row.acciones),
  }
}
