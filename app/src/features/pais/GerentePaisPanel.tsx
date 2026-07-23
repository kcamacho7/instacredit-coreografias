import { KpiCatalogProvider } from '../../hooks/useKpiCatalog'
import { PaisPanel } from './PaisPanel'
import type { AreaNegocio } from '../../hooks/useAreaNegocio'

interface GerentePaisPanelProps {
  paisCode: string
  areasCatalogo: AreaNegocio[]
}

/** Gerente de país: ve/edita TODAS las áreas de negocio activas para su único país — un PaisPanel completo por área, cada uno con su propio catálogo de KPI. */
export function GerentePaisPanel({ paisCode, areasCatalogo }: GerentePaisPanelProps) {
  const areasActivas = areasCatalogo.filter((a) => a.activo)

  if (areasActivas.length === 0) {
    return <div className="sin-proyectos">Todavía no hay áreas de negocio activas.</div>
  }

  return (
    <div>
      {areasActivas.map((area) => (
        <section key={area.codigo} style={{ marginBottom: 40 }}>
          <h2 style={{ padding: '0 32px', color: 'var(--azul)' }}>{area.nombre}</h2>
          <KpiCatalogProvider areaNegocio={area.codigo}>
            <PaisPanel paisCode={paisCode} areaNegocio={area.codigo} />
          </KpiCatalogProvider>
        </section>
      ))}
    </div>
  )
}
