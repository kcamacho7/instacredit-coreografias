import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ReunionCard, type Reunion } from './ReunionCard'
import type { AcuerdoReunion, PerfilAcuerdo } from './AcuerdosTable'

interface ReunionesListProps {
  areaNegocio: string
  diasBloqueoMinuta: number
  refrescarTrigger: number
  onReload: () => void
}

export function ReunionesList({ areaNegocio, diasBloqueoMinuta, refrescarTrigger, onReload }: ReunionesListProps) {
  const { user, profile } = useAuth()
  const [reuniones, setReuniones] = useState<Reunion[] | null>(null)
  const [acuerdosPorReunion, setAcuerdosPorReunion] = useState<Record<string, AcuerdoReunion[]>>({})
  const [perfiles, setPerfiles] = useState<PerfilAcuerdo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())

  useEffect(() => {
    let activo = true
    ;(async () => {
      const puedeVerTodas = !!(profile && (profile.es_regional || profile.es_admin))
      let query = sb.from('reuniones').select('*').eq('area_negocio', areaNegocio).order('creado_at', { ascending: false })
      if (!puedeVerTodas && user?.email) query = query.eq('creado_por_email', user.email.toLowerCase())
      const { data: reunionesData, error: err } = await query
      if (!activo) return
      if (err) { setError(err.message); return }

      const { data: perfilesData } = await sb.from('perfiles_usuario').select('email,nombre,user_id,pais_code,es_regional,es_lider').eq('area_negocio', areaNegocio)
      if (!activo) return
      setPerfiles(perfilesData || [])

      const mapaAcuerdos: Record<string, AcuerdoReunion[]> = {}
      for (const reunion of reunionesData || []) {
        const { data: acuerdosData } = await sb.from('acuerdos_reunion').select('*').eq('reunion_id', reunion.id).order('creado_at', { ascending: true })
        mapaAcuerdos[reunion.id] = acuerdosData || []
      }
      if (!activo) return
      setAcuerdosPorReunion(mapaAcuerdos)
      setReuniones(reunionesData || [])
    })()
    return () => { activo = false }
  }, [areaNegocio, profile, user, refrescarTrigger])

  if (error) return <div className="sin-proyectos">Error: {error}</div>
  if (reuniones === null) return <div className="sin-proyectos">Cargando reuniones…</div>
  if (reuniones.length === 0) return <div className="sin-proyectos">Sin reuniones registradas todavía.</div>

  return (
    <div>
      {reuniones.map((reunion) => (
        <ReunionCard
          key={reunion.id}
          reunion={reunion}
          acuerdosIniciales={acuerdosPorReunion[reunion.id] || []}
          perfiles={perfiles}
          diasBloqueoMinuta={diasBloqueoMinuta}
          abierta={abiertas.has(reunion.id)}
          onToggleAbierta={(abierta) => setAbiertas((prev) => {
            const next = new Set(prev)
            if (abierta) next.add(reunion.id); else next.delete(reunion.id)
            return next
          })}
          onReload={onReload}
        />
      ))}
    </div>
  )
}
