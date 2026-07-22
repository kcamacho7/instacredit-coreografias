import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { sb } from '../lib/supabase'
import type { Tables } from '../types/database.types'

export type PerfilUsuario = Tables<'perfiles_usuario'>

interface AuthContextValue {
  loading: boolean
  user: User | null
  profile: PerfilUsuario | null
  regionalUnlocked: boolean
  authError: string
  authInfo: string
  recoveryMode: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  setNewPassword: (password: string) => Promise<void>
  clearMessages: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Busca el perfil por user_id; si no aparece (p.ej. el signUp no traía sesión
// activa en el momento en que se llamó vincular_preautorizacion), reintenta
// la vinculación una vez — mismo mecanismo de auto-reparación del sitio legado.
async function cargarPerfil(user: User): Promise<PerfilUsuario | null> {
  let { data } = await sb.from('perfiles_usuario').select('*').eq('user_id', user.id).maybeSingle()
  if (!data) {
    await sb.rpc('vincular_preautorizacion')
    ;({ data } = await sb.from('perfiles_usuario').select('*').eq('user_id', user.id).maybeSingle())
  }
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PerfilUsuario | null>(null)
  const [authError, setAuthError] = useState('')
  const [authInfo, setAuthInfo] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data } = await sb.auth.getSession()
      const sessionUser = data.session?.user ?? null
      if (!activo) return
      setUser(sessionUser)
      if (sessionUser) setProfile(await cargarPerfil(sessionUser))
      setLoading(false)
    })()
    return () => { activo = false }
  }, [])

  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const clearMessages = () => { setAuthError(''); setAuthInfo('') }

  async function login(email: string, password: string) {
    setAuthError('')
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setAuthError('No se pudo iniciar sesión: ' + error.message); return }
    setUser(data.user)
    setProfile(await cargarPerfil(data.user))
  }

  async function signup(email: string, password: string) {
    setAuthError('')
    const emailNorm = email.trim().toLowerCase()
    const { data: preautorizado, error: preauthErr } = await sb.rpc('verificar_preautorizacion', { p_email: emailNorm })
    if (preauthErr) { setAuthError('No se pudo verificar la autorización: ' + preauthErr.message); return }
    if (!preautorizado) {
      setAuthError('Tu correo no ha sido autorizado. Pídele a tu Regional o Administración que te agregue primero desde el panel de mantenimiento de usuarios.')
      return
    }
    const { data, error } = await sb.auth.signUp({
      email: emailNorm,
      password,
      options: { emailRedirectTo: window.location.href.split('#')[0] },
    })
    if (error) { setAuthError('No se pudo crear la cuenta: ' + error.message); return }
    if (data.user) await sb.rpc('vincular_preautorizacion')
    setUser(data.user)
    if (data.user) setProfile(await cargarPerfil(data.user))
    setAuthError(data.session ? '' : 'Cuenta creada. Si tu correo pide confirmación, revisa tu bandeja antes de poder iniciar sesión.')
  }

  async function logout() {
    await sb.auth.signOut()
    setUser(null)
    setProfile(null)
    sessionStorage.removeItem('instacredit_coreografias_area_admin')
  }

  async function forgotPassword(email: string) {
    setAuthError(''); setAuthInfo('')
    if (!email || !email.includes('@')) { setAuthError('Escribe tu correo arriba y vuelve a intentar.'); return }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.href.split('#')[0] })
    if (error) { setAuthError('No se pudo enviar el enlace: ' + error.message); return }
    setAuthInfo('Te enviamos un enlace a ' + email + ' para crear una contraseña nueva. Revisa tu bandeja (y spam).')
  }

  async function setNewPassword(password: string) {
    setAuthError('')
    if (!password || password.length < 6) { setAuthError('La contraseña debe tener al menos 6 caracteres.'); return }
    const { error } = await sb.auth.updateUser({ password })
    if (error) { setAuthError('No se pudo guardar la contraseña: ' + error.message); return }
    setRecoveryMode(false)
    setAuthInfo('Contraseña actualizada. Ya tienes sesión iniciada.')
    const { data } = await sb.auth.getSession()
    const sessionUser = data.session?.user ?? null
    setUser(sessionUser)
    if (sessionUser) setProfile(await cargarPerfil(sessionUser))
  }

  const regionalUnlocked = !!(profile && (profile.es_regional || profile.es_admin))

  return (
    <AuthContext.Provider value={{
      loading, user, profile, regionalUnlocked, authError, authInfo, recoveryMode,
      login, signup, logout, forgotPassword, setNewPassword, clearMessages,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
