'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardHat, ShieldCheck, Briefcase, ArrowLeft } from 'lucide-react'
import LeafBackground from '@/components/LeafBackground'

export default function ProduccionPage() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [emailAdm, setEmailAdm] = useState('')
  const [passwordAdm, setPasswordAdm] = useState('')
  const [loadingOp, setLoadingOp] = useState(false)
  const [loadingAdmin, setLoadingAdmin] = useState(false)
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
    </main>
  )
}
