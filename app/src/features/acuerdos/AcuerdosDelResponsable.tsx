import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { CollapsibleCard } from '../../components/CollapsibleCard'
import type { AcuerdoReunion } from './AcuerdosTable'

interface ReunionRel { id: string; titulo: string; fecha: string | null }

interface AcuerdosDelResponsableProps {
  paisCode: string
  areaNegocio: string
}

/** Acuerdos de reuniones asignados a los usuarios de este país (vista Regional/Admin) o a mí directamente (vista de país). */
export function AcuerdosDelResponsable({ paisCode, areaNegocio }: AcuerdosDelResponsableProps) {
  const { user, profile } = useAuth()
  const esVistaRegional = !!(profile && (profile.es_regional || profile.es_admin))
  const [grupos, setGrupos] = useState<{ reunion: ReunionRel | null; acuerdos: AcuerdoReunion[] }[] | null>(null)

  useEffect(() => {
    let activo = true
    ;(async () => {
      let data: AcuerdoReunion[] | null = null
      if (esVistaRegional) {
        const { data: usuariosPais } = await sb.from('perfiles_usuario').select('email,es_regional').eq('pais_code', paisCode).eq('area_negocio', areaNegocio)
        let candidatos = usuariosPais || []
        if (paisCode !== 'RG') candidatos = candidatos.filter((u) => !u.es_regional)
        const emails = candidatos.map((u) => (u.email || '').toLowerCase()).filter(Boolean)
        if (emails.length === 0) { if (activo) setGrupos([]); return }
        const res = await sb.from('acuerdos_reunion').select('*').eq('area_negocio', areaNegocio).in('responsable_email', emails).order('creado_at', { ascending: true })
        data = res.data
      } else {
        const email = (user?.email || '').toLowerCase()
        const res = await sb.from('acuerdos_reunion').select('*').eq('area_negocio', areaNegocio).eq('responsable_email', email).order('creado_at', { ascending: true })
        data = res.data
      }
      if (!activo) return
      if (!data || data.length === 0) { setGrupos([]); return }

      const reunionIds = [...new Set(data.map((a) => a.reunion_id).filter(Boolean))] as string[]
      const { data: reunionesRel } = await sb.from('reuniones').select('id,titulo,fecha').eq('area_negocio', areaNegocio).in('id', reunionIds)
      const reunionesPorId = new Map((reunionesRel || []).map((r) => [r.id, r]))

      const mapaGrupos = new Map<string, AcuerdoReunion[]>()
      data.forEach((ac) => {
        const key = ac.reunion_id || '__sin_reunion__'
        if (!mapaGrupos.has(key)) mapaGrupos.set(key, [])
        mapaGrupos.get(key)!.push(ac)
      })
      const listaGrupos = [...mapaGrupos.entries()]
        .map(([reunionId, acuerdos]) => ({ reunion: reunionesPorId.get(reunionId) || null, acuerdos }))
        .sort((a, b) => (b.reunion?.fecha || '').localeCompare(a.reunion?.fecha || ''))
      setGrupos(listaGrupos)
    })()
    return () => { activo = false }
  }, [paisCode, areaNegocio, esVistaRegional, user])

  if (grupos === null) return null
  if (grupos.length === 0) return null

  return (
    <CollapsibleSection
      titulo="Acuerdos de reunión"
      etiqueta={esVistaRegional ? (paisCode === 'RG' ? 'Acuerdos asignados a Riesgo Regional' : 'Acuerdos asignados a los usuarios de este país') : 'Acuerdos personales asignados a ti'}
      queEs={`compromisos que salieron de minutas de reuniones${esVistaRegional ? (paisCode === 'RG' ? ', asignados a usuarios de Riesgo Regional' : ', asignados a cualquier usuario de este país') : ' y te fueron asignados a ti directamente'}, agrupados por reunión.`}
    >
      {grupos.map((g, i) => (
        <GrupoReunion key={g.reunion?.id || i} reunion={g.reunion} acuerdosIniciales={g.acuerdos} esVistaRegional={esVistaRegional} />
      ))}
    </CollapsibleSection>
  )
}

function GrupoReunion({ reunion, acuerdosIniciales, esVistaRegional }: { reunion: ReunionRel | null; acuerdosIniciales: AcuerdoReunion[]; esVistaRegional: boolean }) {
  const [acuerdos, setAcuerdos] = useState(acuerdosIniciales)

  return (
    <CollapsibleCard
      titulo={reunion ? (reunion.titulo || '(sin título)') : '(reunión eliminada)'}
      variant="reunion"
      metaRight={<span style={{ fontSize: 12, color: 'var(--azul-claro)', whiteSpace: 'nowrap' }}>{reunion?.fecha || ''}</span>}
    >
      <table className="coreo">
        <tbody>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: esVistaRegional ? '30%' : '36%' }}>Acuerdo</th>
            <th style={{ width: '18%' }}>Responsable</th>
            {esVistaRegional && <th style={{ width: '18%' }}>Correo</th>}
            <th style={{ width: '16%' }}>Fecha compromiso</th>
            <th style={{ width: '16%' }}>Estado</th>
          </tr>
          {acuerdos.map((ac, i) => (
            <FilaAcuerdoResponsable key={ac.id} ac={ac} indice={i} esVistaRegional={esVistaRegional} onChange={(nuevo) => setAcuerdos((prev) => prev.map((a) => (a.id === nuevo.id ? nuevo : a)))} />
          ))}
        </tbody>
      </table>
    </CollapsibleCard>
  )
}

function FilaAcuerdoResponsable({ ac, indice, esVistaRegional, onChange }: { ac: AcuerdoReunion; indice: number; esVistaRegional: boolean; onChange: (ac: AcuerdoReunion) => void }) {
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
      {esVistaRegional && <td style={{ fontSize: 12, color: 'var(--azul-claro)' }}>{ac.responsable_email}</td>}
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
