import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { PAISES } from '../../lib/catalogs'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useKpiNombrePorId } from '../../hooks/useKpiNombrePorId'
import { CollapsibleSection } from '../../components/CollapsibleSection'

type Tabla = 'coreografias' | 'kpis_adicionales' | 'proyectos_especiales'

interface FechaItem {
  tabla: Tabla
  id: string
  pais: string
  origen: string
  fecha: string
  hora: string
  campoFecha: string
  campoHora: string
}

interface FechasReunionTabProps {
  areaNegocio: string
}

export function FechasReunionTab({ areaNegocio }: FechasReunionTabProps) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const kpiNombrePorId = useKpiNombrePorId(areaNegocio)
  const [items, setItems] = useState<FechaItem[] | null>(null)

  async function cargar() {
    const [{ data: coreoData }, { data: proyData }, { data: customData }] = await Promise.all([
      sb.from('coreografias').select('*').eq('area_negocio', areaNegocio),
      sb.from('proyectos_especiales').select('*').eq('area_negocio', areaNegocio),
      sb.from('kpis_adicionales').select('*').eq('area_negocio', areaNegocio),
    ])
    const lista: FechaItem[] = []
    ;(coreoData || []).forEach((r) => {
      if (!r.fecha_revision) return
      lista.push({ tabla: 'coreografias', id: r.id, pais: r.pais_code, origen: kpiNombrePorId[r.kpi_id] || r.kpi_id, fecha: r.fecha_revision, hora: r.hora_revision || '', campoFecha: 'fecha_revision', campoHora: 'hora_revision' })
    })
    ;(customData || []).forEach((r) => {
      if (!r.fecha_revision) return
      lista.push({ tabla: 'kpis_adicionales', id: r.id, pais: r.pais_code, origen: r.nombre || 'KPI adicional', fecha: r.fecha_revision, hora: r.hora_revision || '', campoFecha: 'fecha_revision', campoHora: 'hora_revision' })
    })
    ;(proyData || []).forEach((r) => {
      if (!r.fecha_seguimiento) return
      lista.push({ tabla: 'proyectos_especiales', id: r.id, pais: r.pais_code, origen: r.nombre || 'Proyecto especial', fecha: r.fecha_seguimiento, hora: r.hora_seguimiento || '', campoFecha: 'fecha_seguimiento', campoHora: 'hora_seguimiento' })
    })
    lista.sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
    setItems(lista)
  }

  useEffect(() => { cargar() }, [areaNegocio, kpiNombrePorId])

  if (!items) return <div className="sin-proyectos">Cargando…</div>

  return (
    <CollapsibleSection
      titulo="Gestión de fechas y horas de reunión"
      etiqueta="Solo Regional/Admin"
      queEs='aquí puedes ajustar la fecha/hora de cualquier reunión ya definida por un gerente (por ejemplo, si pide un cambio o si choca con otra sesión tuya). Estos campos no tienen candado para ti — se guardan al instante al presionar "Guardar".'
    >
      {items.length === 0 ? (
        <div className="sin-proyectos">No hay fechas de reunión definidas todavía.</div>
      ) : (
        <table className="coreo">
          <tbody>
            <tr>
              <th style={{ width: '11%' }}>País</th>
              <th style={{ width: '29%' }}>Origen</th>
              <th style={{ width: '18%' }}>Fecha</th>
              <th style={{ width: '13%' }}>Hora</th>
              <th style={{ width: '29%' }}>&nbsp;</th>
            </tr>
            {items.map((item) => (
              <FilaFecha
                key={item.tabla + item.id}
                item={item}
                onGuardado={cargar}
                onLimpiar={async () => {
                  const paisNombre = PAISES.find((p) => p.code === item.pais)?.nombre || item.pais
                  const ok = await mostrarConfirm(`¿Limpiar esta fecha/hora de reunión (${item.origen}, ${paisNombre})? El país podrá definir una nueva fecha desde su pestaña. El evento en el calendario se elimina en la próxima corrida diaria.`)
                  if (!ok) return
                  const { error } = await sb.from(item.tabla).update({ [item.campoFecha]: null, [item.campoHora]: null } as never).eq('id', item.id)
                  if (error) { mostrarAlerta('Error: ' + error.message); return }
                  cargar()
                }}
              />
            ))}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  )
}

function FilaFecha({ item, onGuardado, onLimpiar }: { item: FechaItem; onGuardado: () => void; onLimpiar: () => void }) {
  const { mostrarAlerta } = useToast()
  const [fecha, setFecha] = useState(item.fecha)
  const [hora, setHora] = useState(item.hora)
  const paisNombre = PAISES.find((p) => p.code === item.pais)?.nombre || item.pais

  async function guardar() {
    const { error } = await sb.from(item.tabla).update({ [item.campoFecha]: fecha || null, [item.campoHora]: hora || null } as never).eq('id', item.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    mostrarAlerta('Fecha/hora actualizada. El calendario se sincroniza automáticamente en la próxima corrida diaria.')
    onGuardado()
  }

  return (
    <tr>
      <td>{paisNombre}</td>
      <td>{item.origen}</td>
      <td><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></td>
      <td><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)', marginRight: 6 }} onClick={guardar}>Guardar</button>
        <button type="button" className="btn-eliminar-proyecto" onClick={onLimpiar}>Limpiar</button>
      </td>
    </tr>
  )
}
