import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { PAISES } from '../../lib/catalogs'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useKpiNombrePorId } from '../../hooks/useKpiNombrePorId'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { toJson } from '../../lib/json'
import { leerRetencion, guardarRetencion, type Accion, type RetencionDias } from '../../components/AccionesTable'

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
  const [retencion, setRetencion] = useState<RetencionDias>(() => leerRetencion())
  const [cumplidasAbierta, setCumplidasAbierta] = useState(false)

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

  // Purga automática de cumplidas vencidas — agrupada por fila (tabla+id) para
  // no pisar el borrado de otra acción cumplida en la misma fila con un update
  // concurrente basado en el snapshot viejo del arreglo.
  useEffect(() => {
    if (!items || !retencion) return
    const corte = Date.now() - retencion * 86400000
    const porFila = new Map<string, { tabla: Tabla; id: string; acciones: Accion[]; idxs: Set<number> }>()
    for (const item of items) {
      const a = item.acciones[item.idx]
      if (a.estado === 'Cumplida' && a.cumplidaEn && new Date(a.cumplidaEn).getTime() < corte) {
        const key = item.tabla + ':' + item.id
        if (!porFila.has(key)) porFila.set(key, { tabla: item.tabla, id: item.id, acciones: item.acciones, idxs: new Set() })
        porFila.get(key)!.idxs.add(item.idx)
      }
    }
    if (porFila.size === 0) return
    ;(async () => {
      await Promise.all([...porFila.values()].map(({ tabla, id, acciones, idxs }) =>
        sb.from(tabla).update({ acciones: toJson(acciones.filter((_, i) => !idxs.has(i))) }).eq('id', id)
      ))
      cargar()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [items, retencion])

  function cambiarRetencion(v: RetencionDias) {
    guardarRetencion(v)
    setRetencion(v)
  }

  async function marcarCumplida(item: AccionItem) {
    const nuevas = item.acciones.map((a, i) => (i === item.idx ? { ...a, estado: 'Cumplida', cumplidaEn: new Date().toISOString() } : a))
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

  const activos = items.filter((item) => item.acciones[item.idx].estado !== 'Cumplida')
  const cumplidos = items.filter((item) => item.acciones[item.idx].estado === 'Cumplida')

  return (
    <CollapsibleSection
      titulo="Gestión de acciones"
      etiqueta="Solo Regional/Admin"
      queEs="todas las acciones activas registradas por los 4 países (coreografías, KPI adicionales y proyectos especiales). Puedes marcar cualquiera como cumplida o eliminarla directamente, sin esperar a que el gerente lo haga. Las cumplidas se acumulan aparte, al final."
    >
      {activos.length === 0 ? (
        <div className="sin-proyectos">No hay acciones activas registradas.</div>
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
            {activos.map((item, i) => {
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

      {cumplidos.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid var(--gris-borde)', borderRadius: 8, overflow: 'hidden' }}>
          <div
            onClick={() => setCumplidasAbierta((v) => !v)}
            style={{ background: '#F0F7EE', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={{ fontWeight: 700, color: 'var(--azul)', fontSize: 13 }}>
              {cumplidasAbierta ? '▾' : '▸'} ✅ Acciones cumplidas ({cumplidos.length})
            </span>
            <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--azul-claro)' }}>
              Eliminar automáticamente después de:
              <select value={retencion} onChange={(e) => cambiarRetencion(Number(e.target.value) as RetencionDias)} style={{ fontSize: 11.5, padding: '2px 4px' }}>
                <option value={0}>Nunca</option>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </select>
            </span>
          </div>
          {cumplidasAbierta && (
            <table className="coreo">
              <tbody>
                <tr>
                  <th style={{ width: '10%' }}>País</th>
                  <th style={{ width: '18%' }}>Origen</th>
                  <th style={{ width: '22%' }}>Acción</th>
                  <th style={{ width: '13%' }}>Responsable</th>
                  <th style={{ width: '11%' }}>Cumplida el</th>
                  <th style={{ width: '14%' }}>&nbsp;</th>
                </tr>
                {cumplidos.map((item, i) => {
                  const accion = item.acciones[item.idx]
                  const paisNombre = PAISES.find((p) => p.code === item.pais)?.nombre || item.pais
                  return (
                    <tr key={item.tabla + item.id + '-' + item.idx + '-' + i}>
                      <td>{paisNombre}</td>
                      <td>{item.origen}</td>
                      <td>{accion.accion}</td>
                      <td>{accion.responsable}</td>
                      <td>{accion.cumplidaEn ? new Date(accion.cumplidaEn).toLocaleDateString('es-CR') : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn-eliminar-proyecto" onClick={() => eliminar(item)}>Eliminar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}
