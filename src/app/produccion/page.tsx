'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardHat, ShieldCheck, Briefcase, ArrowLeft, Clock, BarChart2, Lock, Eye, EyeOff } from 'lucide-react'
import LeafBackground from '@/components/LeafBackground'

export default function ProduccionPage() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [emailAdm, setEmailAdm] = useState('')
  const [passwordAdm, setPasswordAdm] = useState('')
  const [loadingOp, setLoadingOp] = useState(false)
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  // ── Modal Planeación ────────────────────────────────────────────────────
  const [showPlan, setShowPlan] = useState(false)
  const [clavePlan, setClavePlan] = useState('')
  const [showClave, setShowClave] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [errorPlan, setErrorPlan] = useState('')

  async function handlePlaneacion(e: React.FormEvent) {
    e.preventDefault()
    setLoadingPlan(true)
    setErrorPlan('')
    try {
      const res = await fetch('/api/auth/planeacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: clavePlan }),
      })
      if (!res.ok) {
        setErrorPlan('Clave incorrecta')
      } else {
        sessionStorage.setItem('planeacion_auth', '1')
        router.push('/produccion/planeacion')
      }
    } catch {
      setErrorPlan('Error de conexión')
    } finally {
      setLoadingPlan(false)
    }
  }
  const [loadingAdm, setLoadingAdm] = useState(false)
  const [errorOp, setErrorOp] = useState('')
  const [errorAdmin, setErrorAdmin] = useState('')
  const [errorAdm, setErrorAdm] = useState('')

  async function handleEmpleado(e: React.FormEvent) {
    e.preventDefault()
    setLoadingOp(true)
    setErrorOp('')
    try {
      const res = await fetch('/api/auth/operario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorOp(data.error || 'Cédula no encontrada')
      } else {
        router.push('/ejecucion')
      }
    } catch {
      setErrorOp('Error de conexión')
    } finally {
      setLoadingOp(false)
    }
  }

  async function handleAdmin(e: React.FormEvent) {
    e.preventDefault()
    setLoadingAdmin(true)
    setErrorAdmin('')
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorAdmin(data.error || 'Contraseña incorrecta')
      } else {
        router.push('/admin')
      }
    } catch {
      setErrorAdmin('Error de conexión')
    } finally {
      setLoadingAdmin(false)
    }
  }

  async function handleAdministrativo(e: React.FormEvent) {
    e.preventDefault()
    setLoadingAdm(true)
    setErrorAdm('')
    try {
      const res = await fetch('/api/auth/administrativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAdm, password: passwordAdm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorAdm(data.error || 'Credenciales incorrectas')
      } else {
        router.push('/admin')
      }
    } catch {
      setErrorAdm('Error de conexión')
    } finally {
      setLoadingAdm(false)
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 gap-6"
      style={{ background: '#d4e8b8' }}>
      <LeafBackground />

      {/* Encabezado */}
      <div className="relative z-10 text-center mb-2">
        <div className="flex items-center justify-center mb-3">
          <div className="p-3 rounded-full" style={{ background: 'rgba(30,58,20,0.2)', border: '1px solid rgba(60,120,30,0.4)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#1e5c14' }}>
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
              <line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-wide" style={{ color: '#1a3a10' }}>Producción</h1>
        <p className="text-sm mt-1" style={{ color: '#4a6a35' }}>Selecciona cómo quieres ingresar</p>
      </div>

      {/* Card Empleado */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(80,180,60,0.15)' }}>
            <HardHat size={28} strokeWidth={1.5} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Soy empleado</h2>
            <p className="text-gray-400 text-xs">Ingresa con tu número de cédula</p>
          </div>
        </div>
        <form onSubmit={handleEmpleado} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número de cédula"
            value={cedula}
            onChange={e => setCedula(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-500"
            required
          />
          {errorOp && <p className="text-red-400 text-sm">{errorOp}</p>}
          <button type="submit" disabled={loadingOp}
            className="w-full text-white font-semibold rounded-xl py-3 transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #2e6e20, #3d8830)', border: '1px solid #5aaa40' }}>
            {loadingOp ? 'Verificando...' : 'Entrar a producción →'}
          </button>
        </form>
      </div>

      {/* Card Mis Horas Extra */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-5 cursor-pointer hover:brightness-110 transition-all"
        style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}
        onClick={() => router.push('/produccion/mis-horas')}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(180,80,0,0.2)' }}>
            <Clock size={28} strokeWidth={1.5} className="text-yellow-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Mis Horas Extra</h2>
            <p className="text-gray-400 text-xs">Consulta tu reporte de tiempo adicional</p>
          </div>
          <span className="ml-auto text-gray-500 text-xl">→</span>
        </div>
      </div>

      {/* Card Planeación */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-5 cursor-pointer hover:brightness-110 transition-all"
        style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}
        onClick={() => { setClavePlan(''); setErrorPlan(''); setShowPlan(true) }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(60,180,80,0.15)' }}>
            <BarChart2 size={28} strokeWidth={1.5} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Planeación</h2>
            <p className="text-gray-400 text-xs">Demanda, inventario y forecast semanal</p>
          </div>
          <span className="ml-auto flex flex-col items-end gap-0.5">
            <span className="text-gray-500 text-xl">→</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(250,204,21,0.15)', color: '#fde047', border: '1px solid rgba(250,204,21,0.3)' }}>
              Beta
            </span>
          </span>
        </div>
      </div>

      {/* Card Personal Administrativo */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(80,180,60,0.15)' }}>
            <Briefcase size={28} strokeWidth={1.5} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Personal Administrativo</h2>
            <p className="text-gray-400 text-xs">Acceso con correo y contraseña</p>
          </div>
        </div>
        <form onSubmit={handleAdministrativo} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={emailAdm}
            onChange={e => setEmailAdm(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={passwordAdm}
            onChange={e => setPasswordAdm(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
            required
          />
          {errorAdm && <p className="text-red-400 text-sm">{errorAdm}</p>}
          <button type="submit" disabled={loadingAdm}
            className="w-full text-white font-semibold rounded-xl py-3 transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1e4d6e, #2060a0)', border: '1px solid #3080cc' }}>
            {loadingAdm ? 'Verificando...' : 'Entrar →'}
          </button>
        </form>
      </div>

      {/* Card Administrador */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(80,180,60,0.15)' }}>
            <ShieldCheck size={28} strokeWidth={1.5} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Administrador</h2>
            <p className="text-gray-400 text-xs">Acceso al panel de control</p>
          </div>
        </div>
        <form onSubmit={handleAdmin} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
            required
          />
          {errorAdmin && <p className="text-red-400 text-sm">{errorAdmin}</p>}
          <button type="submit" disabled={loadingAdmin}
            className="w-full text-white font-semibold rounded-xl py-3 transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3d5c18, #527820)', border: '1px solid #7aaa30' }}>
            {loadingAdmin ? 'Verificando...' : 'Acceder al panel →'}
          </button>
        </form>
      </div>

      <button onClick={() => router.push('/')}
        className="relative z-10 flex items-center gap-1.5 text-sm hover:underline transition-colors mt-2"
        style={{ color: '#3a5a28' }}>
        <ArrowLeft size={14} /> Volver al inicio
      </button>

      {/* ── Modal Planeación ── */}
      {showPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="relative z-10 w-full max-w-sm rounded-2xl p-7"
            style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(60,180,80,0.15)' }}>
                <Lock size={22} strokeWidth={1.5} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Planeación</h2>
                <p className="text-xs" style={{ color: '#6b9c6b' }}>Acceso restringido — ingresa la clave</p>
              </div>
            </div>

            <form onSubmit={handlePlaneacion} className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type={showClave ? 'text' : 'password'}
                  placeholder="Clave de acceso"
                  value={clavePlan}
                  onChange={e => setClavePlan(e.target.value)}
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 pr-10 text-lg focus:outline-none focus:border-green-500"
                  required
                />
                <button type="button" onClick={() => setShowClave(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  {showClave ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {errorPlan && (
                <p className="text-red-400 text-sm text-center">{errorPlan}</p>
              )}

              <button type="submit" disabled={loadingPlan}
                className="w-full text-white font-semibold rounded-xl py-3 transition-all hover:brightness-110 disabled:opacity-50 mt-1"
                style={{ background: 'linear-gradient(135deg, #2e6e20, #3d8830)', border: '1px solid #5aaa40' }}>
                {loadingPlan ? 'Verificando…' : 'Ingresar →'}
              </button>

              <button type="button" onClick={() => setShowPlan(false)}
                className="text-sm text-center hover:underline mt-1"
                style={{ color: '#4a6a35' }}>
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
