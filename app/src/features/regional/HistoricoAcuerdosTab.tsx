import { useState } from 'react'
import { useDiasBloqueoMinuta } from '../../hooks/useConfigSistema'
import { ReunionesList } from '../acuerdos/ReunionesList'

interface HistoricoAcuerdosTabProps {
  areaNegocio: string
}

/**
 * Vista de auditoría: todas las minutas del área, sin importar quién las creó.
 * La minuta (texto/PDF) queda fija una vez definitiva — un envío por correo es
 * una foto del momento — pero los acuerdos siguen siendo las mismas filas
 * vivas de `acuerdos_reunion`, así que aquí siempre se ve el estado y fecha
 * actuales, aunque el responsable los haya actualizado después del envío.
 */
export function HistoricoAcuerdosTab({ areaNegocio }: HistoricoAcuerdosTabProps) {
  const diasBloqueoMinuta = useDiasBloqueoMinuta()
  const [refrescarTrigger, setRefrescarTrigger] = useState(0)

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
        <strong>Qué es:</strong> todas las minutas de reuniones de esta área, de cualquier usuario. La minuta (texto y PDF enviado) queda fija una vez definitiva, pero aquí los acuerdos siempre muestran su fecha y estado actuales — aunque el responsable los haya actualizado después de enviada la minuta.
      </div>
      <ReunionesList
        areaNegocio={areaNegocio}
        diasBloqueoMinuta={diasBloqueoMinuta}
        refrescarTrigger={refrescarTrigger}
        onReload={() => setRefrescarTrigger((t) => t + 1)}
        forzarVerTodas
      />
    </div>
  )
}
