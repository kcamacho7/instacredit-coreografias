import { useEffect, useState } from 'react'
import { KpiCatalogProvider } from '../../hooks/useKpiCatalog'
import { PaisPanel } from './PaisPanel'
import { MisAcuerdosPanel } from '../acuerdos/MisAcuerdosPanel'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'

const MIS_ACUERDOS = '__mis_acuerdos__'

interface GerentePaisPanelProps {
  paisCode: string
  areasCatalogo: AreaNegocio[]
}

/**
 * Gerente de país: ve/edita TODAS las áreas de negocio activas para su único país —
 * una sub-pestaña por área (como los tabs de país de AppShell), cada una con su propio
 * PaisPanel y catálogo de KPI, más una pestaña "Mis acuerdos" que junta los acuerdos de
 * reunión asignados a su correo en cualquiera de sus áreas (si no, quedarían repartidos
 * entre las pestañas de área). Todas se montan a la vez y se muestran/ocultan por CSS
 * (mismo patrón que las pestañas de país arriba) para no perder ediciones sin guardar
 * al cambiar de área.
 */
export function GerentePaisPanel({ paisCode, areasCatalogo }: GerentePaisPanelProps) {
  const areasActivas = areasCatalogo.filter((a) => a.activo)
  const [areaActiva, setAreaActiva] = useState(areasActivas[0]?.codigo || '')

  useEffect(() => {
    if (areasActivas.length && areaActiva !== MIS_ACUERDOS && !areasActivas.some((a) => a.codigo === areaActiva)) {
      setAreaActiva(areasActivas[0].codigo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasActivas])

  if (areasActivas.length === 0) {
    return <div className="sin-proyectos">Todavía no hay áreas de negocio activas.</div>
  }

  return (
    <div>
      <div className="filtro-bar" style={{ marginTop: 20 }}>
        {areasActivas.map((area) => (
          <button key={area.codigo} type="button" className={'filtro-btn' + (areaActiva === area.codigo ? ' active' : '')} onClick={() => setAreaActiva(area.codigo)}>
            {area.nombre}
          </button>
        ))}
        <button type="button" className={'filtro-btn' + (areaActiva === MIS_ACUERDOS ? ' active' : '')} onClick={() => setAreaActiva(MIS_ACUERDOS)}>
          Mis acuerdos
        </button>
      </div>
      {areasActivas.map((area) => (
        <div key={area.codigo} className={'tab-panel' + (areaActiva === area.codigo ? ' active' : '')}>
          <KpiCatalogProvider areaNegocio={area.codigo}>
            <PaisPanel paisCode={paisCode} areaNegocio={area.codigo} />
          </KpiCatalogProvider>
        </div>
      ))}
      <div className={'tab-panel' + (areaActiva === MIS_ACUERDOS ? ' active' : '')}>
        <MisAcuerdosPanel />
      </div>
    </div>
  )
}
