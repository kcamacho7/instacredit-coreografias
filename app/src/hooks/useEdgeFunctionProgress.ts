import { useRef, useState } from 'react'
import { sb } from '../lib/supabase'

export type ProgresoEstado =
  | { tipo: 'inactivo' }
  | { tipo: 'cargando'; segundos: number }
  | { tipo: 'ok'; mensaje: string }
  | { tipo: 'error'; mensaje: string }

interface InvocarOpciones {
  nombreFuncion: string
  reunionId: string
  mensajeError: string
  onOk: (data: { acuerdos?: number; enviados?: number }) => string
}

/** Invoca una Edge Function (generar-minuta / enviar-minuta) con un cronómetro de progreso, igual que procesarConIA()/enviarMinutaConProgreso() del sitio legado. */
export function useEdgeFunctionProgress() {
  const [estado, setEstado] = useState<ProgresoEstado>({ tipo: 'inactivo' })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function invocar({ nombreFuncion, reunionId, mensajeError, onOk }: InvocarOpciones) {
    const inicio = Date.now()
    setEstado({ tipo: 'cargando', segundos: 0 })
    timerRef.current = setInterval(() => {
      setEstado((prev) => (prev.tipo === 'cargando' ? { tipo: 'cargando', segundos: Math.round((Date.now() - inicio) / 1000) } : prev))
    }, 1000)

    try {
      const { data, error } = await sb.functions.invoke(nombreFuncion, { body: { reunion_id: reunionId } })
      if (timerRef.current) clearInterval(timerRef.current)
      if (error || (data && data.ok === false)) {
        let msg = (data && data.error) || error?.message || 'Error desconocido'
        const context = (error as { context?: { json?: () => Promise<{ error?: string }> } } | undefined)?.context
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json()
            if (body?.error) msg = body.error
          } catch { /* noop */ }
        }
        setEstado({ tipo: 'error', mensaje: msg })
        return { ok: false as const, mensaje: mensajeError + '\n\n' + msg }
      }
      setEstado({ tipo: 'ok', mensaje: onOk(data) })
      return { ok: true as const }
    } catch (e) {
      if (timerRef.current) clearInterval(timerRef.current)
      const mensaje = e instanceof Error ? e.message : String(e)
      setEstado({ tipo: 'error', mensaje })
      return { ok: false as const, mensaje: mensajeError + '\n\n' + mensaje }
    }
  }

  return { estado, invocar }
}
