import { useState } from 'react'
import type { ProyectoState } from '../../lib/stateShape'
import { emptyProyecto } from '../../lib/stateShape'
import { sb } from '../../lib/supabase'
import { toJson } from '../../lib/json'
import { CollapsibleCard } from '../../components/CollapsibleCard'
import { AccionesTable } from '../../components/AccionesTable'
import { FieldGrid, FieldRow } from '../../components/form/FieldGrid'
import { FechaHoraDefinitiva } from '../../components/FechaHoraDefinitiva'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { useDialog } from '../../components/ui/DialogProvider'

interface ProyectosSectionProps {
  paisCode: string
  areaNegocio: string
  isUnlocked: boolean
  hoy: string
  proyectos: ProyectoState[]
  onChange: (proyectos: ProyectoState[]) => void
}

export function ProyectosSection({ paisCode, areaNegocio, isUnlocked, hoy, proyectos, onChange }: ProyectosSectionProps) {
  const { mostrarConfirm } = useDialog()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  function actualizar(id: string, nuevo: ProyectoState) {
    onChange(proyectos.map((p) => (p.id === id ? nuevo : p)))
  }

  function agregar() {
    onChange([...proyectos, emptyProyecto()])
  }

  async function eliminar(p: ProyectoState) {
    const ok = await mostrarConfirm(`¿Eliminar el proyecto especial "${p.nombre || '(sin nombre)'}"? Quedará registrado en la bitácora de Riesgo Regional con los últimos datos.`)
    if (!ok) return
    await sb.from('proyectos_especiales_log').insert([{
      original_id: p.id, pais_code: paisCode, area_negocio: areaNegocio, nombre: p.nombre, descripcion: p.descripcion,
      responsable: p.responsable, estado: p.estado, fecha_seguimiento: p.fechaSeguimiento || null,
      hora_seguimiento: p.horaSeguimiento || null, acciones: toJson(p.acciones),
    }])
    await sb.from('proyectos_especiales').delete().eq('id', p.id)
    onChange(proyectos.filter((x) => x.id !== p.id))
  }

  return (
    <div className="area-block proyecto-area">
      <div className="area-header">
        <h2>Proyecto especial</h2>
        <span>Seguimiento adicional</span>
      </div>
      <div className="area-owner">
        <strong>Uso:</strong> espacio libre para documentar el seguimiento de proyectos especiales asignados a este país (fuera del catálogo fijo de KPI).
      </div>

      {proyectos.length === 0 && <div className="sin-proyectos">Sin proyectos especiales registrados.</div>}

      {proyectos.map((p) => (
        <CollapsibleCard
          key={p.id}
          titulo={p.nombre}
          placeholder="Nombre del proyecto especial"
          onTituloChange={(v) => actualizar(p.id, { ...p, nombre: v })}
          onEliminar={() => eliminar(p)}
          eliminarLabel="Eliminar proyecto"
          locked={!isUnlocked}
          open={abiertos.has(p.id)}
          onToggle={(abierto) => setAbiertos((prev) => {
            const next = new Set(prev)
            if (abierto) next.add(p.id); else next.delete(p.id)
            return next
          })}
        >
          <ProyectoBody
            proyecto={p}
            onChange={(nuevo) => actualizar(p.id, nuevo)}
            hoy={hoy}
            onMarcarCumplidaInmediato={async (idx) => {
              const nuevasAcciones = p.acciones.map((a, i) => (i === idx ? { ...a, estado: 'Cumplida' } : a))
              await sb.from('proyectos_especiales').update({ acciones: toJson(nuevasAcciones) }).eq('id', p.id)
            }}
          />
        </CollapsibleCard>
      ))}

      <button type="button" className="add-proyecto-btn" disabled={!isUnlocked} style={!isUnlocked ? { opacity: 0.55 } : undefined} onClick={agregar}>
        + Agregar proyecto especial
      </button>
    </div>
  )
}

interface ProyectoBodyProps {
  proyecto: ProyectoState
  onChange: (p: ProyectoState) => void
  hoy: string
  onMarcarCumplidaInmediato: (idx: number) => void | Promise<void>
}

function ProyectoBody({ proyecto, onChange, hoy, onMarcarCumplidaInmediato }: ProyectoBodyProps) {
  const descripcionRef = useAutoGrowTextarea(proyecto.descripcion)

  return (
    <>
      <FieldGrid>
        <FieldRow label="Descripción / objetivo">
          <textarea ref={descripcionRef} value={proyecto.descripcion} onChange={(e) => onChange({ ...proyecto, descripcion: e.target.value })} />
        </FieldRow>
        <FieldRow label="Responsable">
          <input type="text" value={proyecto.responsable} onChange={(e) => onChange({ ...proyecto, responsable: e.target.value })} />
        </FieldRow>
        <FieldRow label="Estado general">
          <select value={proyecto.estado} onChange={(e) => onChange({ ...proyecto, estado: e.target.value })}>
            <option value="Pendiente">Pendiente</option>
            <option value="En curso">En curso</option>
            <option value="Cumplido">Cumplido</option>
            <option value="Detenido">Detenido</option>
          </select>
        </FieldRow>
      </FieldGrid>

      <AccionesTable acciones={proyecto.acciones} onChange={(acciones) => onChange({ ...proyecto, acciones })} onMarcarCumplidaInmediato={onMarcarCumplidaInmediato} hoy={hoy} />

      <FieldGrid>
        <FechaHoraDefinitiva
          value={{ fecha: proyecto.fechaSeguimiento, hora: proyecto.horaSeguimiento, historial: proyecto.historialFechaSeguimiento, ajustesUsuario: proyecto.ajustesUsuarioFechaSeguimiento }}
          label={`fecha/hora de seguimiento de "${proyecto.nombre || 'este proyecto especial'}"`}
          fechaLabel="Fecha de seguimiento"
          onChange={(v) => onChange({ ...proyecto, fechaSeguimiento: v.fecha, horaSeguimiento: v.hora, historialFechaSeguimiento: v.historial, ajustesUsuarioFechaSeguimiento: v.ajustesUsuario })}
        />
      </FieldGrid>
    </>
  )
}
