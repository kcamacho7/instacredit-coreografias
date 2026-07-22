import { useEffect, useRef, useState } from 'react'
import { useAreaData } from '../../hooks/useAreaData'
import { useKpiCatalog } from '../../hooks/useKpiCatalog'
import type { ProyectoState } from '../../lib/stateShape'
import { guardarProyectos } from '../../lib/paisSave'
import { useToast } from '../../components/ui/ToastProvider'
import { ProyectosSection } from '../pais/ProyectosSection'
import { AcuerdosDelResponsable } from '../acuerdos/AcuerdosDelResponsable'

interface RegionalTareasPanelProps {
  areaNegocio: string
  nombreAreaActiva: string
}

/** Pestaña "KPI y tareas Regional": espacio privado de proyectos especiales del pseudo-país 'RG'. */
export function RegionalTareasPanel({ areaNegocio, nombreAreaActiva }: RegionalTareasPanelProps) {
  const { mostrarAlerta } = useToast()
  const { areas } = useKpiCatalog()
  const { loading, proyectosEspeciales } = useAreaData('RG', areaNegocio, areas)
  const [proyectos, setProyectos] = useState<ProyectoState[]>([])
  const [guardando, setGuardando] = useState(false)
  const seeded = useRef(false)

  useEffect(() => {
    if (!loading && !seeded.current) {
      setProyectos(proyectosEspeciales)
      seeded.current = true
    }
  }, [loading, proyectosEspeciales])

  async function guardar() {
    setGuardando(true)
    const resultado = await guardarProyectos('RG', areaNegocio, proyectos)
    setGuardando(false)
    if (resultado.error) { mostrarAlerta('Error al guardar: ' + resultado.error); return }
    setProyectos(resultado.proyectos)
    mostrarAlerta('Los cambios se guardaron correctamente.', 'success')
  }

  if (loading) return <div className="sin-proyectos">Cargando…</div>

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="pin-bar unlocked">
        <span>🔒 Sección privada de {nombreAreaActiva} Regional — solo tu usuario la ve, los gerentes de país no tienen acceso. Úsala para documentar tus propios proyectos y tareas de seguimiento.</span>
      </div>
      <ProyectosSection paisCode="RG" areaNegocio={areaNegocio} isUnlocked hoy={new Date().toISOString().slice(0, 10)} proyectos={proyectos} onChange={setProyectos} />
      <AcuerdosDelResponsable paisCode="RG" areaNegocio={areaNegocio} />
      <button type="button" className="btn btn-primary" disabled={guardando} onClick={guardar} style={{ margin: '0 32px 32px 32px' }}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
