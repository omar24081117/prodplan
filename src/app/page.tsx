'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [loadingOp, setLoadingOp] = useState(false)
  const [loadingAdmin, setLoadingAdmin] = useState(false)
  const [errorOp, setErrorOp] = useState('')
  const [errorAdmin, setErrorAdmin] = useState('')

  async function handleOperario(e: React.FormEvent) {
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

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center mb-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">PRODPLAN</h1>
        <p className="text-gray-400 text-sm mt-1">Sistema de planeación de producción</p>
      </div>

      {/* Banner Asistencia */}
      <a
        href="/asistencia"
        className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl p-4 flex items-center justify-between"
      >
        <div>
          <p className="text-white font-semibold text-lg">Marcar Asistencia</p>
          <p className="text-emerald-100 text-sm">Entrada y salida del turno</p>
        </div>
        <span className="text-3xl">✅</span>
      </a>

      {/* Card Operario */}
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Soy operario</h2>
        <form onSubmit={handleOperario} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número de cédula"
            value={cedula}
            onChange={e => setCedula(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-blue-500"
            required
          />
          {errorOp && <p className="text-red-400 text-sm">{errorOp}</p>}
          <button
            type="submit"
            disabled={loadingOp}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loadingOp ? 'Verificando...' : 'Entrar →'}
          </button>
        </form>
      </div>

      {/* Card Admin */}
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Administrador</h2>
        <form onSubmit={handleAdmin} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            required
          />
          {errorAdmin && <p className="text-red-400 text-sm">{errorAdmin}</p>}
          <button
            type="submit"
            disabled={loadingAdmin}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loadingAdmin ? 'Verificando...' : 'Acceder al panel →'}
          </button>
        </form>
      </div>
    </main>
  )
}
