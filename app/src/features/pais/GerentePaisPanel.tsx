import { useEffect, useState } from 'react'
import { KpiCatalogProvider } from '../../hooks/useKpiCatalog'
import { PaisPanel } from './PaisPanel'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'

interface GerentePaisPanelProps {
  paisCode: string
  areasCatalogo: AreaNegocio[]
}

/**
 * Gerente de país: ve/edita TODAS las áreas de negocio activas para su único país —
 * una sub-pestaña por área (como los tabs de país de AppShell), cada una con su propio
 * PaisPanel y catálogo de KPI. Todas se montan a la vez y se muestran/ocultan por CSS
 * (mismo patrón que las pestañas de país arriba) para no perder ediciones sin guardar
 * al cambiar de área.
 */
export function GerentePaisPanel({ paisCode, areasCatalogo }: GerentePaisPanelProps) {
  const areasActivas = areasCatalogo.filter((a) => a.activo)
  const [areaActiva, setAreaActiva] = useState(areasActivas[0]?.codigo || '')

  useEffect(() => {
    if (areasActivas.length && !areasActivas.some((a) => a.codigo === areaActiva)) {
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
      </div>
      {areasActivas.map((area) => (
        <div key={area.codigo} className={'tab-panel' + (areaActiva === area.codigo ? ' active' : '')}>
          <KpiCatalogProvider areaNegocio={area.codigo}>
            <PaisPanel paisCode={paisCode} areaNegocio={area.codigo} />
          </KpiCatalogProvider>
        </div>
      ))}
    </div>
  )
}
