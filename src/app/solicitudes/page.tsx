'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Send, Lock, X, Loader2, ClipboardList } from 'lucide-react'

type SolicitudesUser = { nombre: string; rol: string }

export default function SolicitudesPage() {
  const router = useRouter()

  const [usuario,      setUsuario]      = useState<SolicitudesUser | null>(null)
  const [cedulaInput,  setCedulaInput]  = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [checking,     setChecking]     = useState(true)

  // Restaurar sesión guardada en localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('solicitudes_user')
      if (saved) setUsuario(JSON.parse(saved))
    } catch {}
    setChecking(false)
  }, [])

  async function ingresar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/solicitudes/auth?cedula=${encodeURIComponent(cedulaInput.trim())}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Acceso denegado'); return }
      const user: SolicitudesUser = { nombre: data.nombre, rol: data.rol }
      localStorage.setItem('solicitudes_user', JSON.stringify(user))
      setUsuario(user)
      setCedulaInput('')
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  function salir() {
    localStorage.removeItem('solicitudes_user')
    setUsuario(null)
  }

  if (checking) return null

  if (!usuario) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-xs rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #0e4f5c, #3b1c5c)', border: '1px solid #374151' }}>
              <Lock size={20} className="text-white" />
            </div>
            <h1 className="text-white font-bold text-lg">Solicitudes</h1>
            <p className="text-gray-500 text-xs mt-1 text-center">Ingresa tu cédula para acceder</p>
          </div>

          <form onSubmit={ingresar} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Número de cédula"
              value={cedulaInput}
              autoFocus
              onChange={e => { setCedulaInput(e.target.value); setError('') }}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 text-center tracking-widest"
            />
            {error && (
              <p className="text-red-400 text-xs text-center px-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !cedulaInput.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors">
              ← Volver al inicio
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Solicitudes</h1>
            <p className="text-xs text-gray-500 mt-0.5">{usuario.nombre}</p>
          </div>
          <button onClick={salir}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 px-3 py-1.5 rounded-lg transition-all"
            style={{ background: '#1f2937', border: '1px solid #374151' }}>
            <X size={12} /> Salir
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <button onClick={() => router.push('/solicitudes/compras')}
            className="p-6 rounded-2xl text-left transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #0e4f5c, #0f6674)', border: '1px solid #22b8cc' }}>
            <ShoppingCart size={28} className="text-cyan-300 mb-3" />
            <p className="text-white font-bold text-lg">Solicitudes de Compra</p>
            <p className="text-cyan-200/60 text-sm mt-1">Materiales, insumos y suministros internos</p>
          </button>

          <button onClick={() => router.push('/solicitudes/mensajeria')}
            className="p-6 rounded-2xl text-left transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #3b1c5c, #4c2580)', border: '1px solid #9333ea' }}>
            <Send size={28} className="text-purple-300 mb-3" />
            <p className="text-white font-bold text-lg">Mensajería</p>
            <p className="text-purple-200/60 text-sm mt-1">Envíos, correspondencia y entregas externas</p>
          </button>

          <button onClick={() => router.push('/solicitudes/informe')}
            className="p-5 rounded-2xl text-left transition-all hover:brightness-110 flex items-center gap-4"
            style={{ background: '#111827', border: '1px solid #374151' }}>
            <ClipboardList size={24} className="text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-white font-bold">Estado de Solicitudes</p>
              <p className="text-gray-500 text-sm mt-0.5">Ver todas las solicitudes y su estado actual</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
