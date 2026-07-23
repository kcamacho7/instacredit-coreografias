import { useState } from 'react'
import { KpiCatalogProvider } from '../../hooks/useKpiCatalog'
import { PaisPanel } from '../pais/PaisPanel'
import { CatalogoKpiTab } from './CatalogoKpiTab'
import { MisAcuerdosPanel } from '../acuerdos/MisAcuerdosPanel'

const REGIONAL_AREA_SUBTAB_KEY = 'instacredit_coreografias_regional_area_subtab'

interface RegionalAreaPanelProps {
  areaNegocio: string
  nombreAreaActiva: string
}

const SECCIONES = [
  { id: 'kpis', nombre: 'Mis KPI y acciones' },
  { id: 'catalogo', nombre: 'Catálogo KPI' },
  { id: 'acuerdos', nombre: 'Mis acuerdos' },
]

/** Espacio propio del usuario Regional: sus propios KPI, acciones y acuerdos — igual que un país, pero bajo el pseudo-código 'RG', con un catálogo de KPI exclusivo (no el mismo que usan los países). Para ver/gestionar lo de los 4 países reales, usa la pestaña de cada país. */
export function RegionalAreaPanel({ areaNegocio, nombreAreaActiva }: RegionalAreaPanelProps) {
  const [subTab, setSubTab] = useState<string>(() => sessionStorage.getItem(REGIONAL_AREA_SUBTAB_KEY) || SECCIONES[0].id)

  function seleccionar(id: string) {
    setSubTab(id)
    sessionStorage.setItem(REGIONAL_AREA_SUBTAB_KEY, id)
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
        <strong>Qué es:</strong> aquí documentas tus propios KPI, acciones y acuerdos como Riesgo Regional de {nombreAreaActiva} — no es un resumen de los 4 países (para eso, entra a la pestaña de cada país). El catálogo de KPI de este espacio es exclusivo tuyo, distinto al que usan los países.
      </div>

      <div className="filtro-bar">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" className={'filtro-btn' + (subTab === s.id ? ' active' : '')} onClick={() => seleccionar(s.id)}>
            {s.nombre}
          </button>
        ))}
      </div>

      <KpiCatalogProvider areaNegocio={areaNegocio} soloRegional>
        {subTab === 'kpis' && <PaisPanel paisCode="RG" areaNegocio={areaNegocio} />}
        {subTab === 'catalogo' && <CatalogoKpiTab areaNegocio={areaNegocio} soloRegional />}
      </KpiCatalogProvider>
      {subTab === 'acuerdos' && <MisAcuerdosPanel />}
    </div>
  )
}
