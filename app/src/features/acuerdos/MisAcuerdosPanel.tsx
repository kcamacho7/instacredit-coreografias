import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { CollapsibleCard } from '../../components/CollapsibleCard'
import type { AcuerdoReunion } from './AcuerdosTable'

interface ReunionRel { id: string; titulo: string; fecha: string | null; area_negocio: string }

interface Grupo {
  reunion: ReunionRel | null
  areaNombre: string
  acuerdos: AcuerdoReunion[]
}

/** Todos los acuerdos de reunión asignados a mí (el usuario logueado), sin importar el área de negocio — para un Gerente de País que opera en varias áreas, evita tener que revisar cada pestaña de área por separado. */
export function MisAcuerdosPanel() {
  const { user } = useAuth()
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)

  async function cargar() {
    const email = (user?.email || '').toLowerCase()
    if (!email) { setGrupos([]); return }
    const { data } = await sb.from('acuerdos_reunion').select('*').eq('responsable_email', email).order('creado_at', { ascending: true })
    if (!data || data.length === 0) { setGrupos([]); return }

    const reunionIds = [...new Set(data.map((a) => a.reunion_id).filter(Boolean))] as string[]
    const [{ data: reunionesRel }, { data: areasData }] = await Promise.all([
      sb.from('reuniones').select('id,titulo,fecha,area_negocio').in('id', reunionIds),
      sb.from('areas_negocio').select('codigo,nombre'),
    ])
    const reunionesPorId = new Map((reunionesRel || []).map((r) => [r.id, r]))
    const areaNombrePorCodigo = new Map((areasData || []).map((a) => [a.codigo, a.nombre]))

    const mapaGrupos = new Map<string, AcuerdoReunion[]>()
    data.forEach((ac) => {
      const key = ac.reunion_id || '__sin_reunion__'
      if (!mapaGrupos.has(key)) mapaGrupos.set(key, [])
      mapaGrupos.get(key)!.push(ac)
    })
    const listaGrupos: Grupo[] = [...mapaGrupos.entries()].map(([reunionId, acuerdos]) => {
      const reunion = reunionesPorId.get(reunionId) || null
      return { reunion, areaNombre: reunion ? (areaNombrePorCodigo.get(reunion.area_negocio) || reunion.area_negocio) : '', acuerdos }
    }).sort((a, b) => (b.reunion?.fecha || '').localeCompare(a.reunion?.fecha || ''))
    setGrupos(listaGrupos)
  }
  useEffect(() => { cargar() }, [user])

  if (grupos === null) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
        <strong>Qué es:</strong> los compromisos que salieron de minutas de reuniones y te fueron asignados a ti directamente, de cualquiera de tus áreas, agrupados por reunión.
      </div>
      {grupos.length === 0 ? (
        <div className="sin-proyectos">No tienes acuerdos asignados todavía.</div>
      ) : (
        grupos.map((g, i) => <GrupoReunion key={g.reunion?.id || i} grupo={g} />)
      )}
    </div>
  )
}

function GrupoReunion({ grupo }: { grupo: Grupo }) {
  const { reunion, areaNombre, acuerdos: acuerdosIniciales } = grupo
  const [acuerdos, setAcuerdos] = useState(acuerdosIniciales)

  return (
    <CollapsibleCard
      titulo={reunion ? (reunion.titulo || '(sin título)') : '(reunión eliminada)'}
      variant="reunion"
      metaRight={<span style={{ fontSize: 12, color: 'var(--azul-claro)', whiteSpace: 'nowrap' }}>{areaNombre} {reunion?.fecha ? '· ' + reunion.fecha : ''}</span>}
    >
      <table className="coreo">
        <tbody>
          <tr>
            <th style={{ width: '6%' }}>#</th>
            <th style={{ width: '40%' }}>Acuerdo</th>
            <th style={{ width: '18%' }}>Responsable</th>
            <th style={{ width: '18%' }}>Fecha compromiso</th>
            <th style={{ width: '18%' }}>Estado</th>
          </tr>
          {acuerdos.map((ac, i) => (
            <FilaAcuerdo key={ac.id} ac={ac} indice={i} onChange={(nuevo) => setAcuerdos((prev) => prev.map((a) => (a.id === nuevo.id ? nuevo : a)))} />
          ))}
        </tbody>
      </table>
    </CollapsibleCard>
  )
}

function FilaAcuerdo({ ac, indice, onChange }: { ac: AcuerdoReunion; indice: number; onChange: (ac: AcuerdoReunion) => void }) {
  const descripcionRef = useAutoGrowTextarea(ac.descripcion)
  const responsableRef = useAutoGrowTextarea(ac.responsable_nombre || '')

  async function guardarCampo(campo: keyof AcuerdoReunion, valor: string) {
    await sb.from('acuerdos_reunion').update({ [campo]: valor } as never).eq('id', ac.id)
  }

  return (
    <tr>
      <td>{indice + 1}</td>
      <td><textarea ref={descripcionRef} rows={1} value={ac.descripcion} onChange={(e) => onChange({ ...ac, descripcion: e.target.value })} onBlur={(e) => guardarCampo('descripcion', e.target.value)} /></td>
      <td><textarea ref={responsableRef} rows={1} value={ac.responsable_nombre || ''} onChange={(e) => onChange({ ...ac, responsable_nombre: e.target.value })} onBlur={(e) => guardarCampo('responsable_nombre', e.target.value)} /></td>
      <td><input type="date" value={ac.fecha || ''} onChange={(e) => { onChange({ ...ac, fecha: e.target.value }); guardarCampo('fecha', e.target.value) }} /></td>
      <td>
        <select value={ac.estado} onChange={(e) => { onChange({ ...ac, estado: e.target.value }); guardarCampo('estado', e.target.value) }}>
          <option value="Pendiente">Pendiente</option>
          <option value="En curso">En curso</option>
          <option value="Cumplida">Cumplida</option>
          <option value="Vencida">Vencida</option>
        </select>
      </td>
    </tr>
  )
}
