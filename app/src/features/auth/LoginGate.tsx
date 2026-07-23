import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { PasswordInput } from '../../components/PasswordInput'

type Modo = 'login' | 'signup'

export function LoginGate() {
  const { authError, authInfo, recoveryMode, login, signup, forgotPassword, setNewPassword, clearMessages } = useAuth()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')

  if (recoveryMode) {
    return (
      <div className="login-gate">
        <div className="login-gate-card">
          <BrandPanel />
          <div className="login-gate-form">
            <h2>Nueva contraseña</h2>
            <p className="subt">Escribe la contraseña que vas a usar de ahora en adelante.</p>
            <div id="authBarGate">
              <PasswordInput
                placeholder="contraseña nueva (mín. 6 caracteres)"
                value={nuevaPassword}
                onChange={setNuevaPassword}
              />
              <button type="button" className="btn-auth-primary" onClick={() => setNewPassword(nuevaPassword)}>
                Guardar contraseña
              </button>
              {authInfo && <span className="auth-status">{authInfo}</span>}
              {authError && <span className="auth-error">{authError}</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function submit() {
    if (!email.trim() || !password) return
    if (modo === 'login') login(email.trim(), password)
    else signup(email.trim(), password)
  }

  return (
    <div className="login-gate">
      <div className="login-gate-card">
        <BrandPanel />
        <div className="login-gate-form">
          <h2>{modo === 'login' ? 'Iniciar sesión' : 'Primera vez'}</h2>
          <p className="subt">Accede con tu correo institucional y contraseña.</p>
          <div id="authBarGate">
            <input type="email" placeholder="correo@instacredit.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <PasswordInput placeholder="contraseña" value={password} onChange={setPassword} />
            <button type="button" className="btn-auth-primary" onClick={submit}>
              {modo === 'login' ? 'Iniciar sesión' : 'Crear mi contraseña'}
            </button>
            <button
              type="button"
              className="btn-auth-secondary"
              onClick={() => { setModo(modo === 'login' ? 'signup' : 'login'); clearMessages() }}
            >
              {modo === 'login' ? 'Primera vez / correo recién autorizado' : '¿Ya tienes contraseña? Inicia sesión'}
            </button>
            <button type="button" className="btn-auth-secondary" onClick={() => forgotPassword(email.trim())}>
              ¿Olvidaste tu contraseña?
            </button>
            <div className="auth-ayuda" style={{ flexBasis: '100%', fontSize: '12px', color: 'var(--gris-texto)', opacity: 0.75, marginTop: '2px' }}>
              {modo === 'login'
                ? 'Si ya te registraste antes, inicia sesión con tu correo y contraseña. Si es tu primer ingreso y Riesgo Regional ya autorizó tu correo, usa "Primera vez / correo recién autorizado" para crear tu contraseña.'
                : 'Solo funciona si Riesgo Regional ya autorizó tu correo en el mantenimiento de usuarios. Escribe el mismo correo autorizado y elige la contraseña que vas a usar de ahora en adelante.'}
            </div>
            {authInfo && <span className="auth-status">{authInfo}</span>}
            {authError && <span className="auth-error">{authError}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandPanel() {
  const base = import.meta.env.BASE_URL
  return (
    <div className="login-gate-brand">
      <div>
        <div className="logo-row"><img src={`${base}assets/logo_claro.png`} alt="Instacredit" /></div>
        <div className="eyebrow">Instacredit</div>
        <h1>Coreografías Operativas</h1>
        <p>Cada Gerente de País documenta aquí sus Coreografías por KPI. Inicia sesión con la cuenta que ya te fue autorizada.</p>
      </div>
      <img className="prestamito" src={`${base}assets/prestamito_senalando.png`} alt="Prestamito" />
    </div>
  )
}
