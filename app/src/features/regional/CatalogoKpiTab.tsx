import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useKpiCatalog } from '../../hooks/useKpiCatalog'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/ToastProvider'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { CollapsibleCard } from '../../components/CollapsibleCard'

function slugId(nombre: string): string {
  const base = (nombre || 'x').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'
  return base + '_' + Math.random().toString(36).slice(2, 6)
}

interface DominioRow {
  id: string
  codigo: string
  nombre: string
  ejecuta: string | null
  controla: string | null
  orden: number
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

/** Cada área de negocio define sus propios dominios de KPI (ya no se comparte un esqueleto fijo entre áreas) y sus propios KPI dentro de cada dominio. */
export function CatalogoKpiTab({ areaNegocio }: CatalogoKpiTabProps) {
  const { refetch: refetchCatalogoActivo } = useKpiCatalog()
  const { mostrarAlerta } = useToast()
  const [dominios, setDominios] = useState<DominioRow[] | null>(null)
  const [filas, setFilas] = useState<CatalogoRow[]>([])

  async function cargar() {
    const [{ data: dominiosData, error: errDom }, { data: kpisData, error: errKpi }] = await Promise.all([
      sb.from('kpi_dominios').select('*').eq('area_negocio', areaNegocio).eq('activo', true).order('orden'),
      sb.from('kpis_catalogo').select('*').eq('area_negocio', areaNegocio).eq('activo', true).order('area_id').order('orden'),
    ])
    if (errDom) { mostrarAlerta('Error al cargar los dominios: ' + errDom.message); return }
    if (errKpi) { mostrarAlerta('Error al cargar el catálogo: ' + errKpi.message); return }
    setDominios(dominiosData || [])
    setFilas(kpisData || [])
  }
  useEffect(() => { cargar() }, [areaNegocio])

  async function recargarTodo() {
    await cargar()
    refetchCatalogoActivo()
  }

  if (dominios === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
        <strong>Qué es:</strong> los dominios y KPI de esta área son propios — no se comparten con las demás áreas de negocio. Crea aquí los dominios (agrupaciones de KPI) y, dentro de cada uno, los KPI que los países documentarán.
      </div>

      {dominios.length === 0 && (
        <div className="sin-proyectos" style={{ marginBottom: 16 }}>Esta área todavía no tiene dominios de KPI — agrega el primero abajo.</div>
      )}

      {dominios.map((dominio) => {
        const kpisDeEsteDominio = filas.filter((r) => r.area_id === dominio.codigo)
        return (
          <FilaDominio key={dominio.id} dominio={dominio} kpis={kpisDeEsteDominio} areaNegocio={areaNegocio} onCambio={recargarTodo} />
        )
      })}

      <AgregarDominio areaNegocio={areaNegocio} maxOrden={dominios.reduce((m, d) => Math.max(m, d.orden || 0), 0)} onAgregado={recargarTodo} />
    </div>
  )
}

function FilaDominio({ dominio, kpis, areaNegocio, onCambio }: { dominio: DominioRow; kpis: CatalogoRow[]; areaNegocio: string; onCambio: () => void }) {
  const { mostrarConfirm } = useDialog()
  const { mostrarAlerta } = useToast()
  const [nombre, setNombre] = useState(dominio.nombre)
  const [ejecuta, setEjecuta] = useState(dominio.ejecuta || '')
  const [controla, setControla] = useState(dominio.controla || '')
  const [editando, setEditando] = useState(false)

  async function guardar() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) { mostrarAlerta('El nombre del dominio no puede estar vacío.'); return }
    const { error } = await sb.from('kpi_dominios').update({ nombre: nombreLimpio, ejecuta: ejecuta.trim() || null, controla: controla.trim() || null }).eq('id', dominio.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    setEditando(false)
    onCambio()
  }

  async function eliminarDominio() {
    const detalle = kpis.length > 0 ? ` Sus ${kpis.length} KPI dejarán de verse (los datos ya registrados no se borran).` : ''
    const ok = await mostrarConfirm(`¿Quitar el dominio "${dominio.nombre}"?${detalle}`)
    if (!ok) return
    const { error } = await sb.from('kpi_dominios').update({ activo: false }).eq('id', dominio.id)
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    onCambio()
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ padding: '10px 20px', background: '#F0F3F7', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {editando ? (
          <>
            <input type="text" style={{ flex: '1 1 180px' }} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del dominio" />
            <input type="text" style={{ flex: '1 1 140px' }} value={ejecuta} onChange={(e) => setEjecuta(e.target.value)} placeholder="Ejecuta (ej. Comercial)" />
            <input type="text" style={{ flex: '1 1 140px' }} value={controla} onChange={(e) => setControla(e.target.value)} placeholder="Controla (ej. Riesgo)" />
            <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--verde)', color: 'var(--verde)' }} onClick={guardar}>Guardar</button>
            <button type="button" className="btn-eliminar-proyecto" onClick={() => setEditando(false)}>Cancelar</button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: 'var(--azul)', fontSize: 13, flex: 1 }}>
              {dominio.nombre}
              {(dominio.ejecuta || dominio.controla) && (
                <span style={{ fontWeight: 400, color: 'var(--azul-claro)', marginLeft: 8 }}>
                  {dominio.ejecuta && <>Ejecuta: {dominio.ejecuta} </>}{dominio.controla && <>| Controla: {dominio.controla}</>}
                </span>
              )}
            </span>
            <button type="button" className="btn-eliminar-proyecto" style={{ borderColor: 'var(--azul-claro)', color: 'var(--azul-claro)' }} onClick={() => setEditando(true)}>Editar dominio</button>
            <button type="button" className="btn-eliminar-proyecto" onClick={eliminarDominio}>Quitar dominio</button>
          </>
        )}
      </div>
      {kpis.map((row) => (
        <FilaCatalogo key={row.id} row={row} onGuardado={onCambio} />
      ))}
      <AgregarKpi areaId={dominio.codigo} areaNegocio={areaNegocio} maxOrden={kpis.reduce((m, r) => Math.max(m, r.orden || 0), 0)} onAgregado={onCambio} />
    </div>
  )
}

function AgregarDominio({ areaNegocio, maxOrden, onAgregado }: { areaNegocio: string; maxOrden: number; onAgregado: () => void }) {
  const { mostrarAlerta } = useToast()
  const [nombre, setNombre] = useState('')
  const [ejecuta, setEjecuta] = useState('')
  const [controla, setControla] = useState('')

  async function agregar() {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) { mostrarAlerta('Ponle un nombre al nuevo dominio.'); return }
    const { error } = await sb.from('kpi_dominios').insert([{
      area_negocio: areaNegocio, codigo: slugId(nombreLimpio), nombre: nombreLimpio, ejecuta: ejecuta.trim() || null, controla: controla.trim() || null, orden: maxOrden + 1, activo: true,
    }])
    if (error) { mostrarAlerta('Error: ' + error.message); return }
    setNombre(''); setEjecuta(''); setControla('')
    onAgregado()
  }

  return (
    <div style={{ background: '#F0F7EE', border: '1px dashed var(--verde)', borderRadius: 8, padding: '14px 20px', marginTop: 12 }}>
      <div className="field-grid" style={{ padding: '0 0 10px 0' }}>
        <div className="field">
          <label>Nombre del nuevo dominio</label>
          <input type="text" placeholder="Ej. Cobro Judicial" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label>Ejecuta (opcional)</label>
          <input type="text" placeholder="Ej. Comercial" value={ejecuta} onChange={(e) => setEjecuta(e.target.value)} />
        </div>
        <div className="field">
          <label>Controla (opcional)</label>
          <input type="text" placeholder="Ej. Riesgo" value={controla} onChange={(e) => setControla(e.target.value)} />
        </div>
      </div>
      <button type="button" className="add-proyecto-btn" style={{ margin: 0 }} onClick={agregar}>+ Agregar dominio</button>
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
      area_negocio: areaNegocio, area_id: areaId, kpi_id: slugId(nombreLimpio), nombre: nombreLimpio, definicion: definicion.trim(), orden: maxOrden + 1, activo: true,
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
