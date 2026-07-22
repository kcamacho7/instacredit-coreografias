import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { PAISES, AREAS_FALLBACK } from '../../lib/catalogs'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import type { Tables } from '../../types/database.types'
import type { Accion } from '../../components/AccionesTable'

type KpiLogRow = Tables<'kpis_adicionales_log'>
type ProyectoLogRow = Tables<'proyectos_especiales_log'>

function accionesTexto(acciones: unknown): string {
  const lista = (acciones as Accion[] | null) || []
  if (!lista.length) return '—'
  return lista.map((a, i) => `${i + 1}. ${a.accion || '(sin descripción)'} — ${a.responsable || '—'} — ${a.fecha || 'sin fecha'} — ${a.estado || ''}`).join(' · ')
}

interface BitacoraTabProps {
  areaNegocio: string
}

export function BitacoraTab({ areaNegocio }: BitacoraTabProps) {
  return (
    <>
      <BitacoraKpisAdicionales areaNegocio={areaNegocio} />
      <BitacoraProyectos areaNegocio={areaNegocio} />
    </>
  )
}

function BitacoraKpisAdicionales({ areaNegocio }: { areaNegocio: string }) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const [data, setData] = useState<KpiLogRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const { data, error } = await sb.from('kpis_adicionales_log').select('*').eq('area_negocio', areaNegocio).order('deleted_at', { ascending: false })
    if (error) { setError(error.message); return }
    setData(data)
  }
  useEffect(() => { cargar() }, [areaNegocio])

  async function vaciarTodo() {
    if (!data) return
    const ok = await mostrarConfirm(`¿Eliminar los ${data.length} registros de la bitácora? Esta acción no se puede deshacer.`)
    if (!ok) return
    const { error } = await sb.from('kpis_adicionales_log').delete().eq('area_negocio', areaNegocio)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    cargar()
  }

  async function eliminarUno(id: string) {
    const { error } = await sb.from('kpis_adicionales_log').delete().eq('id', id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    cargar()
  }

  return (
    <CollapsibleSection
      titulo="Bitácora de KPI adicionales eliminados"
      etiqueta="Solo Regional/Admin"
      queEs="cada vez que un gerente elimina un KPI adicional que había creado, queda registrado aquí con los últimos datos que tenía antes de borrarlo. Riesgo Regional puede eliminar estos registros cuando ya no los necesite."
    >
      {error && <div className="sin-proyectos">Error al cargar la bitácora: {error}</div>}
      {!error && data && data.length === 0 && <div className="sin-proyectos">Sin KPI eliminados registrados todavía.</div>}
      {!error && data && data.length > 0 && (
        <>
          <button type="button" className="add-proyecto-btn" style={{ background: 'var(--rojo)' }} onClick={vaciarTodo}>
            Vaciar toda la bitácora ({data.length})
          </button>
          {data.map((row) => {
            const paisNombre = PAISES.find((p) => p.code === row.pais_code)?.nombre || row.pais_code
            const areaNombre = AREAS_FALLBACK.find((a) => a.id === row.area_id)?.nombre || row.area_id
            return (
              <div key={row.id} className="proyecto-card">
                <div className="proyecto-card-header">
                  <span style={{ fontWeight: 800, color: 'var(--azul)' }}>{row.nombre || '(sin nombre)'} — {paisNombre} · {areaNombre}</span>
                  <button type="button" className="btn-eliminar-proyecto" onClick={() => eliminarUno(row.id)}>Eliminar registro</button>
                </div>
                <div style={{ padding: '12px 20px', fontSize: 13 }}>
                  <div style={{ marginBottom: 6 }}><strong>Eliminado:</strong> {new Date(row.deleted_at).toLocaleString('es-CR')}</div>
                  <div style={{ marginBottom: 6 }}><strong>Definición:</strong> {row.definicion || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Situación (último dato):</strong> {row.situacion || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Objetivo:</strong> {row.objetivo || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Responsable:</strong> {row.responsable || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Punto de control:</strong> {row.punto_control || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Fecha de revisión:</strong> {row.fecha_revision || '—'}</div>
                  <div><strong>Acciones registradas:</strong> {accionesTexto(row.acciones)}</div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </CollapsibleSection>
  )
}

function BitacoraProyectos({ areaNegocio }: { areaNegocio: string }) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const [data, setData] = useState<ProyectoLogRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const { data, error } = await sb.from('proyectos_especiales_log').select('*').eq('area_negocio', areaNegocio).order('deleted_at', { ascending: false })
    if (error) { setError(error.message); return }
    setData(data)
  }
  useEffect(() => { cargar() }, [areaNegocio])

  async function vaciarTodo() {
    if (!data) return
    const ok = await mostrarConfirm(`¿Eliminar los ${data.length} registros de la bitácora? Esta acción no se puede deshacer.`)
    if (!ok) return
    const { error } = await sb.from('proyectos_especiales_log').delete().eq('area_negocio', areaNegocio)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    cargar()
  }

  async function eliminarUno(id: string) {
    const { error } = await sb.from('proyectos_especiales_log').delete().eq('id', id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    cargar()
  }

  return (
    <CollapsibleSection
      titulo="Bitácora de proyectos especiales eliminados"
      etiqueta="Solo Regional/Admin"
      queEs="cada vez que un gerente (o Riesgo Regional) elimina un proyecto especial, queda registrado aquí con los últimos datos que tenía antes de borrarlo."
    >
      {error && <div className="sin-proyectos">Error al cargar la bitácora: {error}</div>}
      {!error && data && data.length === 0 && <div className="sin-proyectos">Sin proyectos especiales eliminados registrados todavía.</div>}
      {!error && data && data.length > 0 && (
        <>
          <button type="button" className="add-proyecto-btn" style={{ background: 'var(--rojo)' }} onClick={vaciarTodo}>
            Vaciar toda la bitácora ({data.length})
          </button>
          {data.map((row) => {
            const paisNombre = PAISES.find((p) => p.code === row.pais_code)?.nombre || row.pais_code
            return (
              <div key={row.id} className="proyecto-card">
                <div className="proyecto-card-header">
                  <span style={{ fontWeight: 800, color: 'var(--azul)' }}>{row.nombre || '(sin nombre)'} — {paisNombre}</span>
                  <button type="button" className="btn-eliminar-proyecto" onClick={() => eliminarUno(row.id)}>Eliminar registro</button>
                </div>
                <div style={{ padding: '12px 20px', fontSize: 13 }}>
                  <div style={{ marginBottom: 6 }}><strong>Eliminado:</strong> {new Date(row.deleted_at).toLocaleString('es-CR')}</div>
                  <div style={{ marginBottom: 6 }}><strong>Descripción:</strong> {row.descripcion || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Responsable:</strong> {row.responsable || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Estado:</strong> {row.estado || '—'}</div>
                  <div style={{ marginBottom: 6 }}><strong>Fecha de seguimiento:</strong> {row.fecha_seguimiento || '—'} {row.hora_seguimiento || ''}</div>
                  <div><strong>Acciones registradas:</strong> {accionesTexto(row.acciones)}</div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </CollapsibleSection>
  )
}
