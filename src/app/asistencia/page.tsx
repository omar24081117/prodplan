'use client'

import { useState, useEffect } from 'react'
import { LogIn, LogOut, Users, ArrowLeft } from 'lucide-react'
import LeafBackground from '@/components/LeafBackground'

type Resultado = {
  nombre: string; hora: string; tipo: 'entrada' | 'salida'; turno?: string
} | null

type Resumen = { total: number }

export default function AsistenciaPage() {
  const [cedula, setCedula] = useState('')
  const [loading, setLoading] = useState<'entrada' | 'salida' | null>(null)
  const [resultado, setResultado] = useState<Resultado>(null)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState<Resumen | null>(null)

  useEffect(() => {
    fetch('/api/asistencia/resumen').then(r => r.json()).then(setResumen).catch(() => {})
  }, [resultado])

  async function marcar(tipo: 'entrada' | 'salida') {
    if (!cedula.trim()) return
    setLoading(tipo); setError(''); setResultado(null)
    try {
      const res = await fetch('/api/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim(), tipo }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Error al marcar asistencia')
      else { setResultado(data); setCedula('') }
    } catch { setError('Error de conexión') }
    finally { setLoading(null) }
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-4 gap-6"
      style={{ background: '#d4e8b8' }}>
      <LeafBackground />

      {/* Encabezado */}
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center mb-3">
          <div className="p-3 rounded-full" style={{ background: 'rgba(30,58,20,0.2)', border: '1px solid rgba(60,120,30,0.4)' }}>
            <Users size={36} strokeWidth={1.5} style={{ color: '#1e5c14' }} />
          </div>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#1a3a10' }}>Asistencia</h1>
        <p className="text-sm mt-1" style={{ color: '#4a6a35' }}>
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="relative z-10 w-full max-w-sm rounded-2xl p-6 text-center"
          style={{
            background: resultado.tipo === 'entrada' ? 'linear-gradient(135deg, #1e5c14, #2e7820)' : 'linear-gradient(135deg, #6a4a10, #8a6418)',
            border: resultado.tipo === 'entrada' ? '1px solid #4a9a30' : '1px solid #b08828',
            boxShadow: '0 8px 32px rgba(20,60,10,0.35)'
          }}>
          <div className="flex justify-center mb-2">
            {resultado.tipo === 'entrada'
              ? <LogIn size={28} className="text-white" strokeWidth={1.5} />
              : <LogOut size={28} className="text-white" strokeWidth={1.5} />}
          </div>
          <p className="text-green-100 text-sm mb-1">
            {resultado.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada'}
          </p>
          <p className="text-white text-2xl font-bold">{resultado.nombre}</p>
          <p className="text-4xl font-mono font-bold text-white mt-2">{resultado.hora}</p>
          {resultado.turno && <p className="text-green-100/80 text-sm mt-1">Turno {resultado.turno}</p>}
        </div>
      )}

      {/* Input cédula */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ingresa tu cédula"
          value={cedula}
          onChange={e => { setCedula(e.target.value); setError(''); setResultado(null) }}
          className="bg-gray-800 border border-gray-700 text-white text-center text-2xl font-mono rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button onClick={() => marcar('entrada')} disabled={!cedula.trim() || loading !== null}
          className="flex items-center justify-center gap-2 disabled:opacity-40 text-white font-bold rounded-xl py-4 text-lg transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #2e6e20, #3d8830)', border: '1px solid #5aaa40' }}>
          <LogIn size={20} strokeWidth={2} />
          {loading === 'entrada' ? 'Registrando...' : 'Entrada'}
        </button>
        <button onClick={() => marcar('salida')} disabled={!cedula.trim() || loading !== null}
          className="flex items-center justify-center gap-2 disabled:opacity-40 text-white font-bold rounded-xl py-4 text-lg transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #7a5818, #9a7020)', border: '1px solid #c09030' }}>
          <LogOut size={20} strokeWidth={2} />
          {loading === 'salida' ? 'Registrando...' : 'Salida'}
        </button>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="relative z-10 w-full max-w-sm rounded-2xl p-4 text-center"
          style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
          <div className="flex items-center justify-center gap-2 text-sm mb-1" style={{ color: '#8aaa78' }}>
            <Users size={14} /><span>Personal en planta hoy</span>
          </div>
          <p className="text-white text-3xl font-bold mt-1">{resumen.total}</p>
          <p className="text-xs mt-1" style={{ color: '#6a8a58' }}>personas con entrada registrada</p>
        </div>
      )}

      <a href="/" className="relative z-10 flex items-center gap-1.5 text-sm hover:underline transition-colors mt-2"
        style={{ color: '#3a5a28' }}>
        <ArrowLeft size={14} /> Volver al inicio
      </a>
    </main>
  )
}
