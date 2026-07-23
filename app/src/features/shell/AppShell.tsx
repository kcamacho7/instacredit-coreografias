import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAreaNegocio } from '../../hooks/useAreaNegocio'
import { KpiCatalogProvider } from '../../hooks/useKpiCatalog'
import { Emoji } from '../../components/Emoji'
import { AuthBar } from '../auth/AuthBar'
import { PAISES } from '../../lib/catalogs'
import { PaisPanel } from '../pais/PaisPanel'
import { GerentePaisPanel } from '../pais/GerentePaisPanel'
import { RegionalPanel } from '../regional/RegionalPanel'
import { RegionalAreaPanel } from '../regional/RegionalAreaPanel'
import { DashboardPage } from '../dashboard/DashboardPage'
import { AcuerdosModule } from '../acuerdos/AcuerdosModule'

const ACTIVE_TAB_KEY = 'instacredit_coreografias_active_tab'

interface TabDef {
  code: string
  label: ReactNode
  className?: string
}

export function AppShell() {
  const { profile } = useAuth()
  const { catalogo, currentArea, nombreAreaActiva, cambiarAreaActiva } = useAreaNegocio(profile)
  const base = import.meta.env.BASE_URL

  const puedeVerTodosPaises = !!(profile && (profile.es_regional || profile.es_admin))
  const paisesVisibles = useMemo(
    () => (puedeVerTodosPaises ? PAISES : PAISES.filter((p) => profile && profile.pais_code === p.code)),
    [puedeVerTodosPaises, profile],
  )
  const esRegionalExclusivo = !!(profile && profile.es_regional)
  const esGerentePais = !!(profile && profile.es_gerente_pais && profile.pais_code)
  // Acuerdos standalone queda solo para un líder puro — regional/admin ya tienen
  // Acuerdos embebido en su tab "Regional {Área}".
  const puedeVerAcuerdosStandalone = !!(profile && profile.es_lider && !profile.es_regional && !profile.es_admin)

  function isotipo() {
    return <img src={`${base}assets/isotipo_instacredit.png`} alt="" style={{ height: '1em', width: 'auto', verticalAlign: '-0.15em', marginRight: '.35em' }} />
  }

  const tabs: TabDef[] = useMemo(() => {
    const lista: TabDef[] = paisesVisibles.map((p) => ({ code: p.code, label: <Emoji text={`${p.bandera} ${p.nombre}`} /> }))
    if (esRegionalExclusivo) lista.push({ code: 'REGIONAL_AREA', label: <>{isotipo()}Regional {nombreAreaActiva}</>, className: 'tab-btn-regional' })
    lista.push({ code: 'DASHBOARD', label: <Emoji text="📊 Dashboard" /> })
    if (puedeVerAcuerdosStandalone) lista.push({ code: 'ACUERDOS', label: <>{isotipo()}Acuerdos de reuniones</>, className: 'tab-btn-regional' })
    lista.push({ code: 'REGIONAL', label: <>{isotipo()}Administración del sistema</>, className: 'tab-btn-regional' })
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paisesVisibles, esRegionalExclusivo, puedeVerAcuerdosStandalone, nombreAreaActiva, base])

  const [activeTab, setActiveTab] = useState<string>(() => {
    const guardada = sessionStorage.getItem(ACTIVE_TAB_KEY)
    return guardada || (paisesVisibles.length ? paisesVisibles[0].code : 'DASHBOARD')
  })

  useEffect(() => {
    if (!tabs.some((t) => t.code === activeTab)) {
      setActiveTab(tabs[0]?.code || 'DASHBOARD')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  function selectTab(code: string) {
    setActiveTab(code)
    sessionStorage.setItem(ACTIVE_TAB_KEY, code)
  }

  // El toolbar es sticky en top:0 y las tabs son sticky justo debajo — en vez de
  // asumir una altura fija de toolbar (frágil ante cambios de fuente/contenido),
  // se mide en vivo para que nunca quede un hueco que deje ver el contenido
  // scrolleando detrás.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setToolbarHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <KpiCatalogProvider areaNegocio={currentArea}>
    <div id="appContent">
      <header className="cover">
        <div className="page" style={{ padding: 0 }}>
          <div className="logo-row"><img src={`${base}assets/logo_claro.png`} alt="Instacredit" /></div>
          <div className="eyebrow">{nombreAreaActiva} — Instacredit</div>
          <h1>Coreografías Operativas</h1>
          <p>Cada Gerente de País documenta aquí sus Coreografías por KPI.</p>
        </div>
        <img className="prestamito" src={`${base}assets/prestamito_senalando.png`} alt="Prestamito" />
      </header>

      <div className="toolbar" ref={toolbarRef}>
        <span className="status" id="statusText">Datos consolidados desde la nube</span>
      </div>

      <AuthBar currentArea={currentArea} nombreAreaActiva={nombreAreaActiva} areasCatalogo={catalogo} onCambiarArea={cambiarAreaActiva} />

      <div className="tabs" id="tabs" style={toolbarHeight ? { top: toolbarHeight } : undefined}>
        {tabs.map((t) => (
          <button
            key={t.code}
            type="button"
            className={'tab-btn' + (t.className ? ' ' + t.className : '') + (activeTab === t.code ? ' active' : '')}
            onClick={() => selectTab(t.code)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="page" id="tabPanels">
        {paisesVisibles.map((p) => (
          <div key={p.code} className={'tab-panel' + (activeTab === p.code ? ' active' : '')}>
            {esGerentePais && p.code === profile!.pais_code ? (
              <GerentePaisPanel paisCode={p.code} areasCatalogo={catalogo} />
            ) : (
              <PaisPanel paisCode={p.code} areaNegocio={currentArea} />
            )}
          </div>
        ))}
        <div className={'tab-panel' + (activeTab === 'DASHBOARD' ? ' active' : '')}>
          <DashboardPage areaNegocio={currentArea} nombreAreaActiva={nombreAreaActiva} />
        </div>
        {esRegionalExclusivo && (
          <div className={'tab-panel' + (activeTab === 'REGIONAL_AREA' ? ' active' : '')}>
            <RegionalAreaPanel areaNegocio={currentArea} nombreAreaActiva={nombreAreaActiva} />
          </div>
        )}
        {puedeVerAcuerdosStandalone && (
          <div className={'tab-panel' + (activeTab === 'ACUERDOS' ? ' active' : '')}>
            <div style={{ paddingTop: 20 }}>
              <div className="area-owner" style={{ borderRadius: 8, marginBottom: 16 }}>
                <strong>Qué es:</strong> sube el archivo (o pega el texto) de una transcripción y la IA arma la minuta al instante, con título y acuerdos sugeridos (responsable, fecha y correo, tomados de la lista de usuarios cuando reconoce el nombre). Revisa y ajusta cada acuerdo, y al "Guardar minuta" puedes enviarla por correo a cada responsable y a Riesgo Regional en el mismo paso, con un PDF adjunto del detalle completo.
              </div>
              <AcuerdosModule areaNegocio={currentArea} />
            </div>
          </div>
        )}
        <div className={'tab-panel' + (activeTab === 'REGIONAL' ? ' active' : '')}>
          <RegionalPanel areaNegocio={currentArea} />
        </div>
      </div>

      <footer>
        <span>¡Apoyándote siempre! — Instacredit {nombreAreaActiva} Regional</span>
        <span>Coreografías Operativas · Julio 2026</span>
      </footer>
    </div>
    </KpiCatalogProvider>
  )
}
