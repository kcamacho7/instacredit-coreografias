import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useToast } from '../../components/ui/ToastProvider'
import { useDialog } from '../../components/ui/DialogProvider'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'

export function AreasNegocioTab() {
  const { mostrarAlerta } = useToast()
  const [areas, setAreas] = useState<AreaNegocio[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')

  async function cargar() {
    const { data, error } = await sb.from('areas_negocio').select('*').order('orden')
    if (error) { setError(error.message); return }
    setAreas(data || [])
  }
  useEffect(() => { cargar() }, [])

  async function agregar() {
    const codigo = nuevoCodigo.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    const nombre = nuevoNombre.trim()
    if (!codigo || !nombre) { mostrarAlerta('Completa código y nombre.'); return }
    const maxOrden = (areas || []).reduce((m, r) => Math.max(m, r.orden || 0), 0)
    const { error } = await sb.from('areas_negocio').insert([{ codigo, nombre, activo: true, orden: maxOrden + 1 }])
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    setNuevoCodigo(''); setNuevoNombre('')
    cargar()
  }

  if (error) return <div className="sin-proyectos">Error al cargar las áreas: {error}</div>
  if (areas === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div>
      {areas.map((area) => (
        <FilaArea key={area.codigo} area={area} onGuardado={cargar} />
      ))}

      <div style={{ background: '#F0F7EE', border: '1px dashed var(--verde)', borderTop: 'none', padding: '12px 20px' }}>
        <div className="field-grid" style={{ padding: '0 0 10px 0' }}>
          <div className="field">
            <label>Código (identificador único, ej. "cobro")</label>
            <input type="text" placeholder="cobro" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Nombre</label>
            <input type="text" placeholder="Cobro" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
          </div>
        </div>
        <button type="button" className="add-proyecto-btn" style={{ margin: 0 }} onClick={agregar}>+ Agregar área de negocio</button>
      </div>
    </div>
  )
}

function FilaArea({ area, onGuardado }: { area: AreaNegocio; onGuardado: () => void }) {
  const { mostrarAlerta } = useToast()
  const { mostrarConfirm } = useDialog()
  const [nombre, setNombre] = useState(area.nombre)
  const [orden, setOrden] = useState(area.orden)
  const [activo, setActivo] = useState(area.activo)

  async function guardar() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) { mostrarAlerta('El nombre no puede estar vacío.'); return }
    const { error } = await sb.from('areas_negocio').update({ nombre: nombreLimpio, orden, activo }).eq('codigo', area.codigo)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    onGuardado()
  }

  async function eliminar() {
    const ok = await mostrarConfirm(`¿Eliminar por completo el área "${area.nombre}" (${area.codigo})? Solo funciona si no tiene ningún dato asociado (coreografías, KPI adicionales, proyectos, usuarios, catálogo, reuniones) — si los tiene, la base de datos rechazará el borrado para no perder información. Si solo quieres dejar de usarla, desactívala en vez de borrarla.`)
    if (!ok) return
    const { error } = await sb.from('areas_negocio').delete().eq('codigo', area.codigo)
    if (error) {
      if (error.code === '23503') {
        mostrarAlerta(`No se puede eliminar "${area.nombre}": todavía tiene datos asociados (coreografías, usuarios, catálogo, etc.). Desactívala en vez de borrarla, o primero elimina/reasigna esos datos.`)
      } else {
        mostrarAlerta('Error: ' + error.message)
      }
      return
    }
    mostrarAlerta(`Área "${area.nombre}" eliminada.`, 'success')
    onGuardado()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--gris-borde)', borderTop: 'none', padding: '12px 20px' }}>
      <div className="field-grid" style={{ padding: '0 0 10px 0' }}>
        <div className="field">
          <label>Código</label>
          <input type="text" value={area.codigo} disabled />
        </div>
        <div className="field">
          <label>Nombre</label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label>Orden</label>
          <input type="number" style={{ width: '100%' }} value={orden} onChange={(e) => setOrden(parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activa
        </label>
        <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)' }} onClick={guardar}>Guardar</button>
        <button type="button" className="btn-eliminar-proyecto" onClick={eliminar}>Eliminar área</button>
      </div>
    </div>
  )
}
