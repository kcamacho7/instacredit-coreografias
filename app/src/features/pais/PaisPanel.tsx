import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAreaData } from '../../hooks/useAreaData'
import { useToast } from '../../components/ui/ToastProvider'
import { useKpiCatalog } from '../../hooks/useKpiCatalog'
import type { CustomKpiState, KpiState, ProyectoState } from '../../lib/stateShape'
import { guardarPais, validarAntesDeGuardar } from '../../lib/paisSave'
import { KpiBlock } from './KpiBlock'
import { ProyectosSection } from './ProyectosSection'
import { AcuerdosDelResponsable } from '../acuerdos/AcuerdosDelResponsable'

const HOY = new Date().toISOString().slice(0, 10)

interface PaisPanelProps {
  paisCode: string
  areaNegocio: string
}

export function PaisPanel({ paisCode, areaNegocio }: PaisPanelProps) {
  const { user, profile } = useAuth()
  const { mostrarAlerta } = useToast()
  const isUnlocked = !!(profile && (profile.es_regional || profile.es_admin || profile.pais_code === paisCode))
  const { areas } = useKpiCatalog()

  const { loading, error, kpisPorAreaId, customKpisPorAreaId, proyectosEspeciales } = useAreaData(paisCode, areaNegocio, areas)
  const [kpis, setKpis] = useState<Record<string, Record<string, KpiState>>>({})
  const [customKpis, setCustomKpis] = useState<Record<string, CustomKpiState[]>>({})
  const [proyectos, setProyectos] = useState<ProyectoState[]>([])
  const [guardando, setGuardando] = useState(false)
  const seeded = useRef(false)

  useEffect(() => {
    if (!loading && !seeded.current) {
      setKpis(kpisPorAreaId)
      setCustomKpis(customKpisPorAreaId)
      setProyectos(proyectosEspeciales)
      seeded.current = true
    }
  }, [loading, kpisPorAreaId, customKpisPorAreaId, proyectosEspeciales])

  async function guardar() {
    if (!isUnlocked) {
      mostrarAlerta(`No tienes permiso para editar ${paisCode}. Inicia sesión con la cuenta asignada a ese país.`)
      return
    }
    const errorValidacion = validarAntesDeGuardar(areas, kpis, customKpis, proyectos)
    if (errorValidacion) { mostrarAlerta(errorValidacion); return }

    setGuardando(true)
    const resultado = await guardarPais({ paisCode, areaNegocio, areas, kpis, customKpis, proyectos })
    setGuardando(false)
    if (resultado.error) { mostrarAlerta(`Error al guardar ${paisCode}: ${resultado.error}`); return }
    setKpis(resultado.kpis)
    setProyectos(resultado.proyectos)
    setCustomKpis(resultado.customKpis)
    mostrarAlerta(`Los cambios de ${paisCode} se guardaron correctamente.`, 'success')
  }

  if (loading) return <div className="sin-proyectos">Cargando…</div>
  if (error) return <div className="sin-proyectos">Error: {error}</div>

  let pinBarMensaje: string
  if (isUnlocked) pinBarMensaje = `🔓 Sesión de ${user?.email} — los campos de ${paisCode} son editables.`
  else if (!user) pinBarMensaje = `🔒 Inicia sesión (arriba) con la cuenta asignada a ${paisCode} para editar. Mientras tanto, solo lectura.`
  else pinBarMensaje = `🔒 Tu cuenta no está asignada a ${paisCode} — lo gestiona otro usuario. Solo lectura.`

  return (
    <div>
      <div className={'pin-bar' + (isUnlocked ? ' unlocked' : '')}>
        <span>{pinBarMensaje}</span>
      </div>

      {areas.map((area) => (
        <KpiBlock
          key={area.id}
          area={area}
          paisCode={paisCode}
          areaNegocio={areaNegocio}
          isUnlocked={isUnlocked}
          hoy={HOY}
          kpisState={kpis[area.id] || {}}
          onKpiChange={(kpiId, k) => setKpis((prev) => ({ ...prev, [area.id]: { ...prev[area.id], [kpiId]: k } }))}
          customKpis={customKpis[area.id] || []}
          onCustomKpisChange={(lista) => setCustomKpis((prev) => ({ ...prev, [area.id]: lista }))}
        />
      ))}

      <ProyectosSection
        paisCode={paisCode}
        areaNegocio={areaNegocio}
        isUnlocked={isUnlocked}
        hoy={HOY}
        proyectos={proyectos}
        onChange={setProyectos}
      />

      {isUnlocked && <AcuerdosDelResponsable paisCode={paisCode} areaNegocio={areaNegocio} />}

      <button type="button" className="btn btn-primary" disabled={guardando} onClick={guardar} style={{ margin: '0 32px 32px 32px' }}>
        {guardando ? 'Guardando…' : 'Guardar cambios de este país'}
      </button>
    </div>
  )
}
