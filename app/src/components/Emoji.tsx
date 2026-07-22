import twemoji from 'twemoji'

/** Reemplaza los emoji (banderas, etc.) del texto por <img> de Twemoji, igual que el sitio legado — evita que Windows los muestre como texto/letras por falta de fuente de emoji. Usa una cadena (no DOM) para no chocar con la reconciliación de React. */
export function Emoji({ text, as: As = 'span' }: { text: string; as?: 'span' | 'div' }) {
  const html = twemoji.parse(text, { folder: 'svg', ext: '.svg' })
  return <As dangerouslySetInnerHTML={{ __html: html }} />
}
