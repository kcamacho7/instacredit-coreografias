import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastTipo = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  mensaje: string
  tipo: ToastTipo
  saliendo: boolean
}

interface ToastContextValue {
  mostrarAlerta: (mensaje: string, tipo?: ToastTipo) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONOS: Record<ToastTipo, string> = { info: 'ℹ️', success: '✅', error: '⚠️' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const cerrar = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  const mostrarAlerta = useCallback((mensaje: string, tipo?: ToastTipo) => {
    const resuelto: ToastTipo = tipo ?? (/^error/i.test(mensaje) ? 'error' : 'info')
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, mensaje, tipo: resuelto, saliendo: false }])
    setTimeout(() => cerrar(id), 6000)
  }, [cerrar])

  return (
    <ToastContext.Provider value={{ mostrarAlerta }}>
      {children}
      <div id="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.tipo + (t.saliendo ? ' toast-exit' : '')}>
            <span className="toast-icon">{ICONOS[t.tipo]}</span>
            <span className="toast-msg">{t.mensaje}</span>
            <button type="button" className="toast-cerrar" aria-label="Cerrar" onClick={() => cerrar(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
