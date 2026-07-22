import { useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import './lib/chartSetup'
import { CHART_COLORS, ESTADOS } from './lib/chartSetup'
import { FieldGrid, FieldRow } from './components/form/FieldGrid'
import { EstadoBadge } from './components/EstadoBadge'
import { CollapsibleCard } from './components/CollapsibleCard'
import { AccionesTable, type Accion } from './components/AccionesTable'

/** Ruta temporal de verificación visual de la Fase 4 — se elimina antes del corte a producción. */
export function DevSandbox() {
  const [acciones, setAcciones] = useState<Accion[]>([
    { accion: 'Enviar listado de cuentas vencidas', responsable: 'Walter Chavarría', fecha: '2026-08-01', estado: 'Pendiente' },
    { accion: 'Revisión de política de mora temprana', responsable: 'Kenneth Camacho', fecha: '2026-07-10', estado: 'Cumplida', resultado: 'Se actualizó la política, queda pendiente comunicarla.' },
  ])
  const [tituloProyecto, setTituloProyecto] = useState('Proyecto de ejemplo')
  const [abierto, setAbierto] = useState(true)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2 style={{ color: 'var(--azul)' }}>Dev Sandbox — Fase 4</h2>

      <h3>FieldGrid / FieldRow</h3>
      <FieldGrid>
        <FieldRow label="Nombre">
          <input type="text" defaultValue="Ejemplo" />
        </FieldRow>
        <FieldRow label="Definición" span={2}>
          <textarea defaultValue="Texto de ejemplo para probar el textarea." />
        </FieldRow>
      </FieldGrid>

      <h3>EstadoBadge</h3>
      <p>
        Sin datos: <EstadoBadge acciones={[]} />{' '}
        Con cumplida: <EstadoBadge acciones={[{ estado: 'Cumplida' }]} />{' '}
        Con vencida: <EstadoBadge acciones={[{ estado: 'Vencida' }]} />
      </p>

      <h3>CollapsibleCard (editable, desbloqueada)</h3>
      <CollapsibleCard
        titulo={tituloProyecto}
        onTituloChange={setTituloProyecto}
        placeholder="(sin nombre)"
        badge={<EstadoBadge acciones={acciones} />}
        onEliminar={() => alert('eliminar (mock)')}
        eliminarLabel="Eliminar"
        open={abierto}
        onToggle={setAbierto}
      >
        <AccionesTable acciones={acciones} onChange={setAcciones} hoy="2026-07-22" />
      </CollapsibleCard>

      <h3 style={{ marginTop: 24 }}>CollapsibleCard (bloqueada)</h3>
      <CollapsibleCard
        titulo="Proyecto bloqueado (solo lectura)"
        onTituloChange={() => {}}
        badge={<EstadoBadge acciones={acciones} />}
        onEliminar={() => {}}
        locked
        defaultOpen
      >
        <AccionesTable acciones={acciones} onChange={() => {}} hoy="2026-07-22" />
      </CollapsibleCard>

      <h3 style={{ marginTop: 24 }}>Fase 7 — Chart.js</h3>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h4>Estado general</h4>
          <Doughnut data={{ labels: [...ESTADOS], datasets: [{ data: [3, 2, 5, 1], backgroundColor: ESTADOS.map((e) => CHART_COLORS[e]) }] }} />
        </div>
        <div className="dashboard-card">
          <h4>Avance por país</h4>
          <Bar data={{ labels: ['Costa Rica', 'Nicaragua', 'Panamá', 'El Salvador'], datasets: [{ label: '% cumplidas', data: [80, 45, 60, 30], backgroundColor: ['#002554', '#4C9C2E', '#4C9C2E', '#4C9C2E'], borderRadius: 4 }] }} options={{ scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }} />
        </div>
      </div>
    </div>
  )
}
