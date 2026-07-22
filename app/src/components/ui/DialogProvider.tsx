import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ConfirmRequest {
  kind: 'confirm'
  mensaje: string
  resolve: (valor: boolean) => void
}

interface PromptRequest {
  kind: 'prompt'
  mensaje: string
  valorInicial: string
  resolve: (valor: string | null) => void
}

type DialogRequest = ConfirmRequest | PromptRequest

interface DialogContextValue {
  mostrarConfirm: (mensaje: string) => Promise<boolean>
  mostrarPrompt: (mensaje: string, valorInicial?: string) => Promise<string | null>
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const acceptRef = useRef<HTMLButtonElement>(null)

  const mostrarConfirm = useCallback((mensaje: string) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ kind: 'confirm', mensaje, resolve })
    })
  }, [])

  const mostrarPrompt = useCallback((mensaje: string, valorInicial?: string) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(valorInicial || '')
      setRequest({ kind: 'prompt', mensaje, valorInicial: valorInicial || '', resolve })
    })
  }, [])

  useEffect(() => {
    if (!request) return
    if (request.kind === 'prompt') {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      acceptRef.current?.focus()
    }
    function onKey(e: KeyboardEvent) {
      if (!request) return
      if (e.key === 'Escape') cerrar(request.kind === 'confirm' ? false : null)
      if (e.key === 'Enter' && request.kind === 'confirm') { e.preventDefault(); cerrar(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  function cerrar(valor: boolean | string | null) {
    if (!request) return
    if (request.kind === 'confirm') request.resolve(valor as boolean)
    else request.resolve(valor as string | null)
    setRequest(null)
  }

  return (
    <DialogContext.Provider value={{ mostrarConfirm, mostrarPrompt }}>
      {children}
      {request && (
        <div id="confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) cerrar(request.kind === 'confirm' ? false : null) }}>
          <div className="confirm-box">
            <p style={{ whiteSpace: 'pre-line' }}>{request.mensaje}</p>
            {request.kind === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); cerrar(promptValue) }
                }}
              />
            )}
            <div className="confirm-btns">
              <button type="button" className="btn-cancelar" onClick={() => cerrar(request.kind === 'confirm' ? false : null)}>Cancelar</button>
              <button
                ref={acceptRef}
                type="button"
                className="btn-aceptar"
                onClick={() => cerrar(request.kind === 'confirm' ? true : promptValue)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>')
  return ctx
}
