import { useState } from 'react'
import type { AreaCatalogo } from '../../lib/catalogs'
import type { CustomKpiState, KpiState } from '../../lib/stateShape'
import { EstadoBadge } from '../../components/EstadoBadge'
import { AccionesTable } from '../../components/AccionesTable'
import { FieldGrid, FieldRow } from '../../components/form/FieldGrid'
import { FechaHoraDefinitiva } from '../../components/FechaHoraDefinitiva'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { LockedProvider } from '../../lib/lockedContext'
import { sb } from '../../lib/supabase'
import { toJson } from '../../lib/json'
import { CustomKpisSection } from './CustomKpisSection'

interface KpiBlockProps {
  area: AreaCatalogo
  paisCode: string
  areaNegocio: string
  isUnlocked: boolean
  hoy: string
  kpisState: Record<string, KpiState>
  onKpiChange: (kpiId: string, kpi: KpiState) => void
  customKpis: CustomKpiState[]
  onCustomKpisChange: (custom: CustomKpiState[]) => void
}

function kpiTieneContenido(k: KpiState): boolean {
  return !!(k.situacion || k.objetivo || k.responsable || k.puntoControl || k.fechaRevision || k.acciones.some((a) => a.accion || a.responsable))
}

export function KpiBlock({ area, paisCode, areaNegocio, isUnlocked, hoy, kpisState, onKpiChange, customKpis, onCustomKpisChange }: KpiBlockProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const keysConDatos = area.kpis.filter((kpi) => kpiTieneContenido(kpisState[kpi.id])).map((k) => k.id)
  const algunoAbierto = area.kpis.some((k) => expandidos.has(k.id))

  function toggleExpandirConDatos() {
    if (algunoAbierto) setExpandidos(new Set())
    else setExpandidos(new Set(keysConDatos))
  }

  function toggleKpi(kpiId: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(kpiId)) next.delete(kpiId)
      else next.add(kpiId)
      return next
    })
  }

  return (
    <div className="area-block">
      <div className="area-header">
        <h2>{area.nombre}</h2>
        <span>Dominio {area.id}</span>
      </div>
      <div className="area-owner">
        <span><strong>Ejecuta:</strong> {area.ejecuta} &nbsp;|&nbsp; <strong>Controla:</strong> {area.controla}</span>
        <button type="button" className="btn-expandir-con-datos" onClick={toggleExpandirConDatos}>
          {algunoAbierto ? 'Contraer KPI' : 'Expandir KPI con datos'}
        </button>
      </div>

      <div className={'kpi-block' + (isUnlocked ? '' : ' locked')}>
        <LockedProvider locked={!isUnlocked}>
          {area.kpis.map((kpi) => (
            <KpiAccordionItem
              key={kpi.id}
              kpiId={kpi.id}
              nombre={kpi.nombre}
              definicion={kpi.def}
              open={expandidos.has(kpi.id)}
              onToggle={() => toggleKpi(kpi.id)}
              kpiState={kpisState[kpi.id]}
              onChange={(k) => onKpiChange(kpi.id, k)}
              hoy={hoy}
              onMarcarCumplidaInmediato={async (idx) => {
                const nuevasAcciones = kpisState[kpi.id].acciones.map((a, i) => (i === idx ? { ...a, estado: 'Cumplida' } : a))
                await sb.from('coreografias').update({ acciones: toJson(nuevasAcciones) }).eq('pais_code', paisCode).eq('area_negocio', areaNegocio).eq('area_id', area.id).eq('kpi_id', kpi.id)
              }}
            />
          ))}
        </LockedProvider>

        <CustomKpisSection
          paisCode={paisCode}
          areaNegocio={areaNegocio}
          area={area}
          isUnlocked={isUnlocked}
          hoy={hoy}
          customKpis={customKpis}
          onChange={onCustomKpisChange}
        />
      </div>
    </div>
  )
}

interface KpiAccordionItemProps {
  kpiId: string
  nombre: string
  definicion: string
  open: boolean
  onToggle: () => void
  kpiState: KpiState
  onChange: (kpi: KpiState) => void
  hoy: string
  onMarcarCumplidaInmediato: (idx: number) => void | Promise<void>
}

function KpiAccordionItem({ nombre, definicion, open, onToggle, kpiState, onChange, hoy, onMarcarCumplidaInmediato }: KpiAccordionItemProps) {
  const situacionRef = useAutoGrowTextarea(kpiState.situacion)
  const objetivoRef = useAutoGrowTextarea(kpiState.objetivo)
  const puntoControlRef = useAutoGrowTextarea(kpiState.puntoControl)
  const tieneContenido = kpiTieneContenido(kpiState)

  return (
    <div className={'kpi-accordion-item' + (open ? ' open' : '')}>
      <div className="kpi-row-header" onClick={onToggle}>
        <span className="titulo-wrap">
          {tieneContenido && <EstadoBadge acciones={kpiState.acciones} />}
          <span>{nombre}</span>
        </span>
        <span className="chevron">▶</span>
      </div>
      <div className="kpi-accordion-body">
        <div className="kpi-def">{definicion}</div>
        <FieldGrid>
          <FieldRow label="Situación actual (valor vs meta)">
            <textarea ref={situacionRef} value={kpiState.situacion} onChange={(e) => onChange({ ...kpiState, situacion: e.target.value })} />
          </FieldRow>
          <FieldRow label="Objetivo de la coreografía">
            <textarea ref={objetivoRef} value={kpiState.objetivo} onChange={(e) => onChange({ ...kpiState, objetivo: e.target.value })} />
          </FieldRow>
          <FieldRow label="Responsable">
            <input type="text" value={kpiState.responsable} onChange={(e) => onChange({ ...kpiState, responsable: e.target.value })} />
          </FieldRow>
        </FieldGrid>

        <AccionesTable
          acciones={kpiState.acciones}
          onChange={(acciones) => onChange({ ...kpiState, acciones })}
          onMarcarCumplidaInmediato={onMarcarCumplidaInmediato}
          hoy={hoy}
        />

        <FieldGrid>
          <FieldRow label="Punto de control">
            <textarea ref={puntoControlRef} value={kpiState.puntoControl} onChange={(e) => onChange({ ...kpiState, puntoControl: e.target.value })} />
          </FieldRow>
          <FechaHoraDefinitiva
            value={{ fecha: kpiState.fechaRevision, hora: kpiState.horaRevision, historial: kpiState.historialFechaRevision, ajustesUsuario: kpiState.ajustesUsuarioFechaRevision }}
            label={`la fecha/hora de revisión de "${nombre}"`}
            fechaLabel="Fecha de revisión con Riesgo Regional"
            onChange={(v) => onChange({ ...kpiState, fechaRevision: v.fecha, horaRevision: v.hora, historialFechaRevision: v.historial, ajustesUsuarioFechaRevision: v.ajustesUsuario })}
          />
        </FieldGrid>
      </div>
    </div>
  )
}
