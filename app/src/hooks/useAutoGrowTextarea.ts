import { useEffect, useRef } from 'react'

/** Auto-crece un <textarea> según su contenido, igual que autoGrow()/wireAutoGrow() del sitio legado. */
export function useAutoGrowTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return ref
}
