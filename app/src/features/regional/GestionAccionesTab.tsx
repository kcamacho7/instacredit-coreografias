import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { PAISES } from '../../lib/catalogs'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useKpiNombrePorId } from '../../hooks/useKpiNombrePorId'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { toJson } from '../../lib/json'
import type { Accion } from '../../components/AccionesTable'

type Tabla = 'coreografias' | 'kpis_adicionales' | 'proyectos_especiales'

interface AccionItem {
  tabla: Tabla
  id: string
  idx: number
  pais: string
  origen: string
  acciones: Accion[]
}

interface GestionAccionesTabProps {
  areaNegocio: string
}

export function GestionAccionesTab({ areaNegocio }: GestionAccionesTabProps) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const kpiNombrePorId = useKpiNombrePorId(areaNegocio)
  const [items, setItems] = useState<AccionItem[] | null>(null)

  async function cargar() {
    const [{ data: coreoData }, { data: proyData }, { data: customData }] = await Promise.all([
      sb.from('coreografias').select('*').eq('area_negocio', areaNegocio),
      sb.from('proyectos_especiales').select('*').eq('area_negocio', areaNegocio),
      sb.from('kpis_adicionales').select('*').eq('area_negocio', areaNegocio),
    ])
    const lista: AccionItem[] = []
    function pushAcciones(rows: { id: string; pais_code: string; acciones: unknown }[] | null, tabla: Tabla, origenFn: (r: { id: string; pais_code: string; acciones: unknown }) => string) {
      ;(rows || []).forEach((r) => {
        const acciones = (r.acciones as Accion[] | null) || []
        acciones.forEach((accion, idx) => {
          if (!accion.accion && !accion.responsable) return
          lista.push({ tabla, id: r.id, idx, pais: r.pais_code, origen: origenFn(r), acciones })
        })
      })
    }
    pushAcciones(coreoData as never, 'coreografias', (r) => kpiNombrePorId[(r as never as { kpi_id: string }).kpi_id] || (r as never as { kpi_id: string }).kpi_id)
    pushAcciones(customData as never, 'kpis_adicionales', (r) => (r as never as { nombre: string }).nombre || 'KPI adicional')
    pushAcciones(proyData as never, 'proyectos_especiales', (r) => (r as never as { nombre: string }).nombre || 'Proyecto especial')
    setItems(lista)
  }

  useEffect(() => { cargar() }, [areaNegocio, kpiNombrePorId])

  async function marcarCumplida(item: AccionItem) {
    const nuevas = item.acciones.map((a, i) => (i === item.idx ? { ...a, estado: 'Cumplida' } : a))
    const { error } = await sb.from(item.tabla).update({ acciones: toJson(nuevas) }).eq('id', item.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    cargar()
  }

  async function eliminar(item: AccionItem) {
    const ok = await mostrarConfirm('¿Eliminar esta acción de forma permanente?')
    if (!ok) return
    const nuevas = item.acciones.filter((_, i) => i !== item.idx)
    const { error } = await sb.from(item.tabla).update({ acciones: toJson(nuevas) }).eq('id', item.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    cargar()
  }

  if (!items) return <div className="sin-proyectos">Cargando…</div>

  return (
    <CollapsibleSection
      titulo="Gestión de acciones"
      etiqueta="Solo Regional/Admin"
      queEs="todas las acciones registradas por los 4 países (coreografías, KPI adicionales y proyectos especiales). Puedes marcar cualquiera como cumplida o eliminarla directamente, sin esperar a que el gerente lo haga."
    >
      {items.length === 0 ? (
        <div className="sin-proyectos">No hay acciones registradas todavía.</div>
      ) : (
        <table className="coreo">
          <tbody>
            <tr>
              <th style={{ width: '10%' }}>País</th>
              <th style={{ width: '20%' }}>Origen</th>
              <th style={{ width: '22%' }}>Acción</th>
              <th style={{ width: '13%' }}>Responsable</th>
              <th style={{ width: '11%' }}>Fecha</th>
              <th style={{ width: '10%' }}>Estado</th>
              <th style={{ width: '14%' }}>&nbsp;</th>
            </tr>
            {items.map((item, i) => {
              const accion = item.acciones[item.idx]
              const paisNombre = PAISES.find((p) => p.code === item.pais)?.nombre || item.pais
              return (
                <tr key={item.tabla + item.id + '-' + item.idx + '-' + i}>
                  <td>{paisNombre}</td>
                  <td>{item.origen}</td>
                  <td>{accion.accion}</td>
                  <td>{accion.responsable}</td>
                  <td>{accion.fecha || '—'}</td>
                  <td>{accion.estado}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)', marginRight: 6 }} onClick={() => marcarCumplida(item)}>Cumplida</button>
                    <button type="button" className="btn-eliminar-proyecto" onClick={() => eliminar(item)}>Eliminar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  )
}
