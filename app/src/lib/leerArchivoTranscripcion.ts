export async function leerArchivoTranscripcion(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const resultado = await mammoth.extractRawText({ arrayBuffer })
    return resultado.value.trim()
  }
  const texto = await file.text()
  if (ext === 'vtt' || ext === 'srt') {
    return texto
      .split(/\r?\n/)
      .filter((linea) => {
        const l = linea.trim()
        if (!l) return false
        if (/^WEBVTT/i.test(l)) return false
        if (/^NOTE/i.test(l)) return false
        if (/^\d+$/.test(l)) return false
        if (/-->/.test(l)) return false
        return true
      })
      .join('\n')
      .trim()
  }
  return texto.trim()
}
