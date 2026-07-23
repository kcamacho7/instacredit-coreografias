import { useLayoutEffect, useRef } from 'react'

/**
 * Auto-crece un <textarea> según su contenido, igual que autoGrow()/wireAutoGrow()
 * del sitio legado. Además de reaccionar a cambios de texto, observa el tamaño real
 * del elemento: si el textarea vive dentro de un acordeón/tarjeta colapsada
 * (.kpi-accordion-body, .proyecto-card-body, etc. con display:none), al montar
 * oculto scrollHeight se mide en 0 y ese valor queda congelado — nunca se
 * recalculaba al abrir la sección porque el value no cambiaba. El ResizeObserver
 * detecta esa transición de oculto→visible y vuelve a ajustar la altura entonces.
 */
export function useAutoGrowTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    function ajustar() {
      if (!el) return
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }

    ajustar()

    const observer = new ResizeObserver(() => ajustar())
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  return ref
}
