import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/ui/ToastProvider'
import { DialogProvider } from './components/ui/DialogProvider'
import { LoginGate } from './features/auth/LoginGate'
import { AppShell } from './features/shell/AppShell'
import { DevSandbox } from './DevSandbox'

function LoadingScreen() {
  const base = import.meta.env.BASE_URL
  return (
    <div className="loading-screen">
      <img className="prestamito" src={`${base}assets/prestamito_caminando.png`} alt="Cargando" />
      <div className="loading-spinner" />
      <div className="loading-text">Cargando…</div>
    </div>
  )
}

function AppInner() {
  const { loading, user, recoveryMode } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user || recoveryMode) return <LoginGate />
  return <AppShell />
}

function App() {
  if (window.location.hash === '#/dev-sandbox') {
    return (
      <ToastProvider>
        <DialogProvider>
          <AuthProvider>
            <DevSandbox />
          </AuthProvider>
        </DialogProvider>
      </ToastProvider>
    )
  }
  return (
    <ToastProvider>
      <DialogProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </DialogProvider>
    </ToastProvider>
  )
}

export default App
