import { PaisPanel } from '../pais/PaisPanel'

interface RegionalAreaPanelProps {
  areaNegocio: string
  nombreAreaActiva: string
}

/** Espacio propio del usuario Regional: sus propios KPI, acciones y acuerdos — igual que un país, pero bajo el pseudo-código 'RG'. Para ver/gestionar lo de los 4 países reales, usa la pestaña de cada país. */
export function RegionalAreaPanel({ areaNegocio, nombreAreaActiva }: RegionalAreaPanelProps) {
  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
        <strong>Qué es:</strong> aquí documentas tus propios KPI, acciones y acuerdos como Riesgo Regional de {nombreAreaActiva} — no es un resumen de los 4 países (para eso, entra a la pestaña de cada país).
      </div>
      <PaisPanel paisCode="RG" areaNegocio={areaNegocio} />
    </div>
  )
}
