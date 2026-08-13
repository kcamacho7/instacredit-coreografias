import { useRef, useState } from 'react'
import { sb } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/ToastProvider'
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea'
import { useEdgeFunctionProgress } from '../../hooks/useEdgeFunctionProgress'
import { useDiasBloqueoMinuta } from '../../hooks/useConfigSistema'
import { leerArchivoTranscripcion } from '../../lib/leerArchivoTranscripcion'
import { ReunionesList } from './ReunionesList'

interface AcuerdosModuleProps {
  areaNegocio: string
}

export function AcuerdosModule({ areaNegocio }: AcuerdosModuleProps) {
  const { user, profile } = useAuth()
  const { mostrarAlerta } = useToast()
  const diasBloqueoMinuta = useDiasBloqueoMinuta()
  const procesarIA = useEdgeFunctionProgress()

  const [transcripcion, setTranscripcion] = useState('')
  const [nombreArchivo, setNombreArchivo] = useState('Ningún archivo seleccionado — formatos .txt, .vtt, .srt, .docx')
  const [estadoArchivo, setEstadoArchivo] = useState<{ texto: string; color: string }>({ texto: '', color: '' })
  const [creando, setCreando] = useState(false)
  const [refrescarTrigger, setRefrescarTrigger] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const transcripcionRef = useAutoGrowTextarea(transcripcion)

  function recargar() {
    setRefrescarTrigger((t) => t + 1)
  }

  async function onArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNombreArchivo(file.name)
    setEstadoArchivo({ texto: `Leyendo ${file.name}…`, color: 'var(--azul-claro)' })
    try {
      const texto = await leerArchivoTranscripcion(file)
      // Si ya había texto (de un archivo anterior), se agrega como una parte más
      // en vez de reemplazarlo — para sesiones grabadas en varios archivos
      // separados (se cortó la grabación, o quedó en más de una app).
      setTranscripcion((prev) => {
        const anterior = prev.trim()
        if (!anterior) return texto
        const parteNum = (anterior.match(/--- Parte \d+/g) || []).length + 2
        return anterior + `\n\n--- Parte ${parteNum} de la transcripción (${file.name}) ---\n\n` + texto
      })
      setEstadoArchivo({ texto: `✓ ${file.name} agregado a la transcripción — revisa el texto abajo. Si la sesión tuvo varias grabaciones, puedes seguir eligiendo más archivos antes de crear la reunión.`, color: 'var(--verde)' })
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err)
      setEstadoArchivo({ texto: `No se pudo leer el archivo: ${mensaje}. Pega el texto manualmente.`, color: 'var(--rojo)' })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function crearReunion() {
    const texto = transcripcion.trim()
    if (!texto) { mostrarAlerta('Sube un archivo o pega la transcripción de la reunión.'); return }
    const fecha = new Date().toISOString().slice(0, 10)
    setCreando(true)
    const { data: nueva, error } = await sb.from('reuniones').insert([{
      fecha, transcripcion: texto, estado: 'pendiente_procesar', area_negocio: areaNegocio,
      creado_por_email: user?.email?.toLowerCase() || '', creado_por_nombre: profile?.nombre || '',
    }]).select().single()
    if (error) { mostrarAlerta('Error: ' + error.message); setCreando(false); return }

    setTranscripcion('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setNombreArchivo('Ningún archivo seleccionado — formatos .txt, .vtt, .srt, .docx')
    setEstadoArchivo({ texto: '', color: '' })
    recargar()

    await procesarIA.invocar({
      nombreFuncion: 'generar-minuta',
      reunionId: nueva.id,
      mensajeError: 'No se pudo procesar la minuta con IA:',
      onOk: (data) => `✅ Minuta lista — se generaron ${data.acuerdos || 0} acuerdo(s).`,
    })
    recargar()
    setCreando(false)
  }

  const progreso = procesarIA.estado

  return (
    <div>
      <div style={{ background: '#F0F7EE', border: '1px dashed var(--verde)', borderRadius: 8, padding: '14px 20px', marginBottom: 20 }}>
        <button type="button" className="add-proyecto-btn" style={{ margin: '0 0 14px 0' }} disabled={!transcripcion.trim() || creando} onClick={crearReunion}>
          + Crear reunión y analizar con IA
        </button>

        {progreso.tipo !== 'inactivo' && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff', border: '1px solid var(--gris-borde)', borderRadius: 6, fontSize: 13 }}>
            <strong style={{ color: progreso.tipo === 'error' ? 'var(--rojo)' : progreso.tipo === 'ok' ? 'var(--verde)' : 'var(--azul)' }}>
              {progreso.tipo === 'cargando' ? `🤖 Analizando la transcripción con IA… ${progreso.segundos}s` : progreso.tipo === 'ok' ? progreso.mensaje : `⚠️ ${progreso.mensaje}`}
            </strong>
          </div>
        )}

        <div className="field" style={{ padding: '0 0 10px 0' }}>
          <label>Subir archivo de transcripción</label>
          <div className="file-upload-row">
            <label className="file-upload-btn" htmlFor="nuevaReunionArchivoInput">📎 {transcripcion.trim() ? 'Agregar otro archivo' : 'Elegir archivo'}</label>
            <input ref={fileInputRef} type="file" id="nuevaReunionArchivoInput" className="nueva-reunion-archivo" accept=".txt,.vtt,.srt,.docx" onChange={onArchivoChange} />
            <span className="nueva-reunion-archivo-nombre">{nombreArchivo}</span>
          </div>
          <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--azul-claro)' }}>Si la sesión se grabó en varias partes (se cortó, o quedó en más de un archivo), sube cada una por separado — se van agregando al mismo texto para procesarlas juntas como una sola reunión.</div>
          {estadoArchivo.texto && <div style={{ fontSize: 12, marginTop: 6, color: estadoArchivo.color }}>{estadoArchivo.texto}</div>}
        </div>

        <div className="field" style={{ padding: '0 0 10px 0' }}>
          <label>Transcripción</label>
          <textarea
            ref={transcripcionRef}
            rows={6}
            placeholder='Se llena sola al subir el archivo, o puedes pegar el texto aquí directamente. El título lo genera la IA a partir del contenido, y la fecha queda como la de hoy (fecha de carga).'
            value={transcripcion}
            onChange={(e) => setTranscripcion(e.target.value)}
          />
        </div>
      </div>

      <ReunionesList areaNegocio={areaNegocio} diasBloqueoMinuta={diasBloqueoMinuta} refrescarTrigger={refrescarTrigger} onReload={recargar} />
    </div>
  )
}
