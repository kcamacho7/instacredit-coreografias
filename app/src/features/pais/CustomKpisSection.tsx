import { useState } from 'react'
import type { AreaCatalogo } from '../../lib/catalogs'
import type { CustomKpiState } from '../../lib/stateShape'
import { emptyCustomKpi, kpiTieneContenido } from '../../lib/stateShape'
import { sb } from '../../lib/supabase'
import { toJson } from '../../lib/json'
import { EstadoBadge } from '../../components/EstadoBadge'
import { AccionesTable } from '../../components/AccionesTable'
import { FieldGrid, FieldRow } from '../../components/form/FieldGrid'
import { FechaHoraDefinitiva } from '../../components/FechaHoraDefinitiva'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { useDialog } from '../../components/ui/DialogProvider'

interface CustomKpisSectionProps {
  paisCode: string
  areaNegocio: string
  area: AreaCatalogo
  isUnlocked: boolean
  hoy: string
  customKpis: CustomKpiState[]
  onChange: (custom: CustomKpiState[]) => void
}

async function marcarCumplidaInmediato(kpiId: string, acciones: CustomKpiState['acciones'], idx: number) {
  const nuevasAcciones = acciones.map((a, i) => (i === idx ? { ...a, estado: 'Cumplida' } : a))
  await sb.from('kpis_adicionales').update({ acciones: toJson(nuevasAcciones) }).eq('id', kpiId)
}

export function CustomKpisSection({ paisCode, areaNegocio, area, isUnlocked, hoy, customKpis, onChange }: CustomKpisSectionProps) {
  const { mostrarConfirm } = useDialog()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  function actualizar(id: string, nuevo: CustomKpiState) {
    onChange(customKpis.map((c) => (c.id === id ? nuevo : c)))
  }

  function agregar() {
    onChange([...customKpis, emptyCustomKpi()])
  }

  async function eliminar(c: CustomKpiState) {
    const ok = await mostrarConfirm(`¿Eliminar el KPI adicional "${c.nombre || '(sin nombre)'}"? Quedará registrado en la bitácora de Riesgo Regional con los últimos datos.`)
    if (!ok) return
    await sb.from('kpis_adicionales_log').insert([{
      original_id: c.id, pais_code: paisCode, area_negocio: areaNegocio, area_id: area.id,
      nombre: c.nombre, definicion: c.definicion, situacion: c.situacion, objetivo: c.objetivo,
      responsable: c.responsable, punto_control: c.puntoControl, fecha_revision: c.fechaRevision || null, acciones: toJson(c.acciones),
    }])
    await sb.from('kpis_adicionales').delete().eq('id', c.id)
    onChange(customKpis.filter((x) => x.id !== c.id))
  }

  return (
    <div className="custom-kpis-section">
      {customKpis.map((c) => (
        <CustomKpiAccordionItem
          key={c.id}
          kpi={c}
          isUnlocked={isUnlocked}
          hoy={hoy}
          open={abiertos.has(c.id)}
          onToggle={() => setAbiertos((prev) => {
            const next = new Set(prev)
            if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
            return next
          })}
          onChange={(nuevo) => actualizar(c.id, nuevo)}
          onEliminar={() => eliminar(c)}
          onMarcarCumplidaInmediato={(idx) => marcarCumplidaInmediato(c.id, c.acciones, idx)}
        />
      ))}
      <button type="button" className="add-proyecto-btn" disabled={!isUnlocked} style={!isUnlocked ? { opacity: 0.55 } : undefined} onClick={agregar}>
        + Agregar KPI adicional
      </button>
    </div>
  )
}

interface CustomKpiAccordionItemProps {
  kpi: CustomKpiState
  isUnlocked: boolean
  hoy: string
  open: boolean
  onToggle: () => void
  onChange: (kpi: CustomKpiState) => void
  onEliminar: () => void
  onMarcarCumplidaInmediato: (idx: number) => void | Promise<void>
}

// Mismo markup que KpiAccordionItem (los KPI predefinidos) — círculo de estado,
// posición del chevron y fondo del encabezado idénticos — solo que aquí el
// nombre es editable (input en vez de texto fijo) y hay botón de eliminar,
// porque a diferencia de los predefinidos este KPI lo creó el usuario.
function CustomKpiAccordionItem({ kpi, isUnlocked, hoy, open, onToggle, onChange, onEliminar, onMarcarCumplidaInmediato }: CustomKpiAccordionItemProps) {
  const situacionRef = useAutoGrowTextarea(kpi.situacion)
  const objetivoRef = useAutoGrowTextarea(kpi.objetivo)
  const puntoControlRef = useAutoGrowTextarea(kpi.puntoControl)
  const tieneContenido = kpiTieneContenido(kpi)

  return (
    <div className={'kpi-accordion-item' + (open ? ' open' : '')}>
      <div className="kpi-row-header" onClick={onToggle}>
        <span className="titulo-wrap">
          {tieneContenido && <EstadoBadge acciones={kpi.acciones} />}
          <input
            type="text"
            className="nombre-input"
            placeholder="Nombre del KPI adicional"
            value={kpi.nombre}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ ...kpi, nombre: e.target.value })}
          />
        </span>
        <span className="kpi-row-controles">
          <button type="button" className="btn-eliminar-proyecto" disabled={!isUnlocked} onClick={(e) => { e.stopPropagation(); onEliminar() }}>
            Eliminar KPI
          </button>
          <span className="chevron">▶</span>
        </span>
      </div>
      <div className="kpi-accordion-body">
        <div className="field" style={{ padding: '10px 20px 0 20px' }}>
          <label>Definición del KPI</label>
          <input type="text" value={kpi.definicion} onChange={(e) => onChange({ ...kpi, definicion: e.target.value })} />
        </div>
        <FieldGrid>
          <FieldRow label="Situación actual (valor vs meta)">
            <textarea ref={situacionRef} value={kpi.situacion} onChange={(e) => onChange({ ...kpi, situacion: e.target.value })} />
          </FieldRow>
          <FieldRow label="Objetivo de la coreografía">
            <textarea ref={objetivoRef} value={kpi.objetivo} onChange={(e) => onChange({ ...kpi, objetivo: e.target.value })} />
          </FieldRow>
          <FieldRow label="Responsable">
            <input type="text" value={kpi.responsable} onChange={(e) => onChange({ ...kpi, responsable: e.target.value })} />
          </FieldRow>
        </FieldGrid>

        <AccionesTable acciones={kpi.acciones} onChange={(acciones) => onChange({ ...kpi, acciones })} onMarcarCumplidaInmediato={onMarcarCumplidaInmediato} hoy={hoy} />

        <FieldGrid>
          <FieldRow label="Punto de control">
            <textarea ref={puntoControlRef} value={kpi.puntoControl} onChange={(e) => onChange({ ...kpi, puntoControl: e.target.value })} />
          </FieldRow>
          <FechaHoraDefinitiva
            value={{ fecha: kpi.fechaRevision, hora: kpi.horaRevision, historial: kpi.historialFechaRevision, ajustesUsuario: kpi.ajustesUsuarioFechaRevision }}
            label={`fecha/hora de revisión de "${kpi.nombre || 'este KPI adicional'}"`}
            fechaLabel="Fecha de revisión con Riesgo Regional"
            onChange={(v) => onChange({ ...kpi, fechaRevision: v.fecha, horaRevision: v.hora, historialFechaRevision: v.historial, ajustesUsuarioFechaRevision: v.ajustesUsuario })}
          />
        </FieldGrid>
      </div>
    </div>
  )
}
