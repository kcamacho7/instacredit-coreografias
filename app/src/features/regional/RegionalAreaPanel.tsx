import { useState } from 'react'
import { BitacoraTab } from './BitacoraTab'
import { FechasReunionTab } from './FechasReunionTab'
import { GestionAccionesTab } from './GestionAccionesTab'
import { CatalogoKpiTab } from './CatalogoKpiTab'
import { AcuerdosModule } from '../acuerdos/AcuerdosModule'

const REGIONAL_AREA_SUBTAB_KEY = 'instacredit_coreografias_regional_area_subtab'

interface Seccion {
  id: string
  nombre: string
}

interface RegionalAreaPanelProps {
  areaNegocio: string
  nombreAreaActiva: string
}

const SECCIONES: Seccion[] = [
  { id: 'acciones', nombre: 'Acciones' },
  { id: 'fechas', nombre: 'Fechas y horas' },
  { id: 'acuerdos', nombre: 'Acuerdos de reuniones' },
  { id: 'bitacora', nombre: 'Bitácora' },
  { id: 'catalogo', nombre: 'Catálogo KPI' },
]

/** Vista consolidada de gestión para un usuario Regional: los 4 países de su área, en un solo lugar. No edita situación/objetivo de un KPI puntual — eso sigue en el tab de cada país. */
export function RegionalAreaPanel({ areaNegocio, nombreAreaActiva }: RegionalAreaPanelProps) {
  const [subTab, setSubTab] = useState<string>(() => {
    const guardada = sessionStorage.getItem(REGIONAL_AREA_SUBTAB_KEY)
    return guardada && SECCIONES.some((s) => s.id === guardada) ? guardada : 'acciones'
  })

  function seleccionar(id: string) {
    setSubTab(id)
    sessionStorage.setItem(REGIONAL_AREA_SUBTAB_KEY, id)
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="pin-bar unlocked">
        <span>🔓 Vista consolidada de {nombreAreaActiva} — los 4 países. Aquí gestionas acciones, fechas y acuerdos; para editar la situación/objetivo de un KPI puntual entra a la pestaña del país correspondiente.</span>
      </div>
      <div className="filtro-bar">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" className={'filtro-btn' + (subTab === s.id ? ' active' : '')} onClick={() => seleccionar(s.id)}>
            {s.nombre}
          </button>
        ))}
      </div>
      {subTab === 'acciones' && <GestionAccionesTab areaNegocio={areaNegocio} />}
      {subTab === 'fechas' && <FechasReunionTab areaNegocio={areaNegocio} />}
      {subTab === 'acuerdos' && <AcuerdosModule areaNegocio={areaNegocio} />}
      {subTab === 'bitacora' && <BitacoraTab areaNegocio={areaNegocio} />}
      {subTab === 'catalogo' && <CatalogoKpiTab areaNegocio={areaNegocio} />}
    </div>
  )
}
