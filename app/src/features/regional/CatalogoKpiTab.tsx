import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useKpiCatalog } from '../../hooks/useKpiCatalog'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { CollapsibleCard } from '../../components/CollapsibleCard'

function slugKpiId(nombre: string): string {
  const base = (nombre || 'kpi').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'kpi'
  return base + '_' + Math.random().toString(36).slice(2, 6)
}

interface CatalogoRow {
  id: string
  area_id: string
  kpi_id: string
  nombre: string
  definicion: string | null
  orden: number
}

interface CatalogoKpiTabProps {
  areaNegocio: string
}

export function CatalogoKpiTab({ areaNegocio }: CatalogoKpiTabProps) {
  const { areas, refetch: refetchCatalogoActivo } = useKpiCatalog()
  const { mostrarAlerta } = useToast()
  const [filas, setFilas] = useState<CatalogoRow[] | null>(null)

  async function cargar() {
    const { data, error } = await sb.from('kpis_catalogo').select('*').eq('area_negocio', areaNegocio).eq('activo', true).order('area_id').order('orden')
    if (error) { mostrarAlerta('Error al cargar el catálogo: ' + error.message); return }
    setFilas(data || [])
  }
  useEffect(() => { cargar() }, [areaNegocio])

  async function recargarTodo() {
    await cargar()
    refetchCatalogoActivo()
  }

  if (filas === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div style={{ paddingTop: 20 }}>
      {areas.map((area) => {
        const kpisDeEstaArea = filas.filter((r) => r.area_id === area.id)
        return (
          <div key={area.id} style={{ marginBottom: 18 }}>
            <div style={{ padding: '10px 20px', background: '#F0F3F7', fontWeight: 700, color: 'var(--azul)', fontSize: 13 }}>
              {area.nombre} (Dominio {area.id})
            </div>
            {kpisDeEstaArea.map((row) => (
              <FilaCatalogo key={row.id} row={row} onGuardado={recargarTodo} />
            ))}
            <AgregarKpi areaId={area.id} areaNegocio={areaNegocio} maxOrden={kpisDeEstaArea.reduce((m, r) => Math.max(m, r.orden || 0), 0)} onAgregado={recargarTodo} />
          </div>
        )
      })}
    </div>
  )
}

function FilaCatalogo({ row, onGuardado }: { row: CatalogoRow; onGuardado: () => void }) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const [nombre, setNombre] = useState(row.nombre)
  const [definicion, setDefinicion] = useState(row.definicion || '')
  const [abierta, setAbierta] = useState(false)
  const defRef = useAutoGrowTextarea(definicion)

  async function guardar() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) { mostrarAlerta('El nombre no puede estar vacío.'); return }
    const { error } = await sb.from('kpis_catalogo').update({ nombre: nombreLimpio, definicion: definicion.trim(), updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    onGuardado()
  }

  async function eliminar() {
    const ok = await mostrarConfirm(`¿Quitar "${row.nombre}" del catálogo de los 4 países? La información que los gerentes ya hayan registrado en este KPI NO se borra, solo deja de ser visible.`)
    if (!ok) return
    const { error } = await sb.from('kpis_catalogo').update({ activo: false }).eq('id', row.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    onGuardado()
  }

  return (
    <CollapsibleCard titulo={row.nombre} variant="proyecto" open={abierta} onToggle={setAbierta}>
      <div className="field-grid" style={{ padding: '0 0 10px 0' }}>
        <div className="field">
          <label>Nombre del KPI</label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label>Definición</label>
          <textarea ref={defRef} value={definicion} onChange={(e) => setDefinicion(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 14px 20px' }}>
        <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)' }} onClick={guardar}>Guardar</button>
        <button type="button" className="btn-eliminar-proyecto" onClick={eliminar}>Eliminar del catálogo</button>
      </div>
    </CollapsibleCard>
  )
}

function AgregarKpi({ areaId, areaNegocio, maxOrden, onAgregado }: { areaId: string; areaNegocio: string; maxOrden: number; onAgregado: () => void }) {
  const { mostrarAlerta } = useToast()
  const [nombre, setNombre] = useState('')
  const [definicion, setDefinicion] = useState('')
  const defRef = useAutoGrowTextarea(definicion)

  async function agregar() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) { mostrarAlerta('Ponle un nombre al nuevo KPI.'); return }
    const { error } = await sb.from('kpis_catalogo').insert([{
      area_negocio: areaNegocio, area_id: areaId, kpi_id: slugKpiId(nombreLimpio), nombre: nombreLimpio, definicion: definicion.trim(), orden: maxOrden + 1, activo: true,
    }])
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    setNombre(''); setDefinicion('')
    onAgregado()
  }

  return (
    <div style={{ background: '#F0F7EE', border: '1px dashed var(--verde)', borderTop: 'none', padding: '12px 20px' }}>
      <div className="field-grid" style={{ padding: '0 0 10px 0' }}>
        <div className="field">
          <label>Nombre del nuevo KPI</label>
          <input type="text" placeholder="Nombre del KPI" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label>Definición</label>
          <textarea ref={defRef} placeholder="Qué mide este KPI" value={definicion} onChange={(e) => setDefinicion(e.target.value)} />
        </div>
      </div>
      <button type="button" className="add-proyecto-btn" style={{ margin: 0 }} onClick={agregar}>+ Agregar KPI a este dominio</button>
    </div>
  )
}
