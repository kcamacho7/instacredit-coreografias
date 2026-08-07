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
import { SeguimientoMinutasTab } from '../regional/SeguimientoMinutasTab'

const ACTIVE_TAB_KEY = 'instacredit_coreografias_active_tab'
const SIDEBAR_COLLAPSED_KEY = 'instacredit_coreografias_sidebar_collapsed'

interface TabDef {
  code: string
  label: ReactNode
  className?: string
}

interface SidebarItemDef {
  code: string
  icon: ReactNode
  label: string
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
  // "Acceso Acuerdos" (columna es_lider en la BD) es un permiso independiente que se
  // asigna explícitamente por usuario — no se hereda de ser regional/admin.
  const puedeVerAcuerdosStandalone = !!(profile && profile.es_lider)
  const puedeVerAdministracion = !!(profile && (profile.es_admin || profile.es_admin_area || profile.es_admin_pais))
  const puedeVerSeguimientoMinutas = !!(profile && (profile.es_regional || profile.es_admin || profile.es_admin_area || profile.es_admin_pais))

  function isotipo(inline = true) {
    return <img src={`${base}assets/isotipo_instacredit.png`} alt="" style={{ height: '1em', width: 'auto', verticalAlign: '-0.15em', marginRight: inline ? '.35em' : 0 }} />
  }

  // Barra superior: solo países + Regional {Área}. El resto vive en el menú lateral.
  const tabs: TabDef[] = useMemo(() => {
    const lista: TabDef[] = paisesVisibles.map((p) => ({ code: p.code, label: <Emoji text={`${p.bandera} ${p.nombre}`} /> }))
    if (esRegionalExclusivo) lista.push({ code: 'REGIONAL_AREA', label: <>{isotipo()}Regional {nombreAreaActiva}</>, className: 'tab-btn-regional' })
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paisesVisibles, esRegionalExclusivo, nombreAreaActiva, base])

  const sidebarItems: SidebarItemDef[] = useMemo(() => {
    const lista: SidebarItemDef[] = [{ code: 'DASHBOARD', icon: <Emoji text="📊" />, label: 'Dashboard' }]
    if (puedeVerAcuerdosStandalone) lista.push({ code: 'ACUERDOS', icon: isotipo(false), label: 'Acuerdos de reuniones' })
    if (puedeVerSeguimientoMinutas) lista.push({ code: 'SEGUIMIENTO_MINUTAS', icon: isotipo(false), label: 'Seguimiento minutas' })
    if (puedeVerAdministracion) lista.push({ code: 'REGIONAL', icon: isotipo(false), label: 'Administración del sistema' })
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeVerAcuerdosStandalone, puedeVerSeguimientoMinutas, puedeVerAdministracion, base])

  const todosLosCodigos = useMemo(() => [...tabs.map((t) => t.code), ...sidebarItems.map((s) => s.code)], [tabs, sidebarItems])

  const [activeTab, setActiveTab] = useState<string>(() => {
    const guardada = sessionStorage.getItem(ACTIVE_TAB_KEY)
    return guardada || (paisesVisibles.length ? paisesVisibles[0].code : 'DASHBOARD')
  })

  useEffect(() => {
    if (!todosLosCodigos.includes(activeTab)) {
      setActiveTab(todosLosCodigos[0] || 'DASHBOARD')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosLosCodigos])

  function selectTab(code: string) {
    setActiveTab(code)
    sessionStorage.setItem(ACTIVE_TAB_KEY, code)
  }

  const [sidebarColapsado, setSidebarColapsado] = useState<boolean>(() => sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
  function alternarSidebar() {
    setSidebarColapsado((prev) => {
      const nuevo = !prev
      sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, nuevo ? '1' : '0')
      return nuevo
    })
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
    <div id="appLayout">
      <aside className={'sidebar' + (sidebarColapsado ? ' collapsed' : '')}>
        <button type="button" className="sidebar-toggle" onClick={alternarSidebar} title={sidebarColapsado ? 'Expandir menú' : 'Contraer menú'}>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          <span className="sidebar-toggle-label">Menú</span>
        </button>
        <nav className="sidebar-nav">
          {sidebarItems.map((s) => (
            <button
              key={s.code}
              type="button"
              className={'sidebar-btn' + (activeTab === s.code ? ' active' : '')}
              onClick={() => selectTab(s.code)}
              title={s.label}
            >
              <span className="sidebar-icon">{s.icon}</span>
              <span className="sidebar-label">{s.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    <div id="appMain">
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
          <DashboardPage areaNegocio={currentArea} nombreAreaActiva={nombreAreaActiva} areasCatalogo={catalogo} />
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
        {puedeVerSeguimientoMinutas && (
          <div className={'tab-panel' + (activeTab === 'SEGUIMIENTO_MINUTAS' ? ' active' : '')}>
            <SeguimientoMinutasTab areaNegocio={currentArea} />
          </div>
        )}
        {puedeVerAdministracion && (
          <div className={'tab-panel' + (activeTab === 'REGIONAL' ? ' active' : '')}>
            <RegionalPanel areaNegocio={currentArea} />
          </div>
        )}
      </div>

      <footer>
        <span>¡Apoyándote siempre! — Instacredit {nombreAreaActiva} Regional</span>
        <span>Coreografías Operativas · Julio 2026</span>
      </footer>
    </div>
    </div>
    </KpiCatalogProvider>
  )
}
