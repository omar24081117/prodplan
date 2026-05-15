'use client'

import { useState, useEffect } from 'react'

type Resultado = {
  nombre: string
  hora: string
  tipo: 'entrada' | 'salida'
  turno?: string
} | null

type Resumen = {
  total: number
}

export default function AsistenciaPage() {
  const [cedula, setCedula] = useState('')
  const [loading, setLoading] = useState<'entrada' | 'salida' | null>(null)
  const [resultado, setResultado] = useState<Resultado>(null)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState<Resumen | null>(null)

  useEffect(() => {
    fetch('/api/asistencia/resumen')
      .then(r => r.json())
      .then(setResumen)
      .catch(() => {})
  }, [resultado])

  async function marcar(tipo: 'entrada' | 'salida') {
    if (!cedula.trim()) return
    setLoading(tipo)
    setError('')
    setResultado(null)
    try {
      const res = await fetch('/api/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim(), tipo }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al marcar asistencia')
      } else {
        setResultado(data)
        setCedula('')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Asistencia</h1>
        <p className="text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className={`w-full max-w-sm rounded-xl p-6 text-center ${resultado.tipo === 'entrada' ? 'bg-emerald-900/50 border border-emerald-600' : 'bg-orange-900/50 border border-orange-600'}`}>
          <p className="text-gray-300 text-sm mb-1">{resultado.tipo === 'entrada' ? '✅ Entrada registrada' : '🚪 Salida registrada'}</p>
          <p className="text-white text-2xl font-bold">{resultado.nombre}</p>
          <p className="text-4xl font-mono font-bold text-white mt-2">{resultado.hora}</p>
          {resultado.turno && <p className="text-gray-300 text-sm mt-1">Turno {resultado.turno}</p>}
        </div>
      )}

      {/* Input cédula */}
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ingresa tu cédula"
          value={cedula}
          onChange={e => { setCedula(e.target.value); setError(''); setResultado(null) }}
          className="bg-gray-800 border border-gray-700 text-white text-center text-2xl font-mono rounded-lg px-4 py-4 focus:outline-none focus:border-blue-500"
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={() => marcar('entrada')}
          disabled={!cedula.trim() || loading !== null}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl py-4 text-lg transition-colors"
        >
          {loading === 'entrada' ? 'Registrando...' : '✅ Entrada'}
        </button>

        <button
          onClick={() => marcar('salida')}
          disabled={!cedula.trim() || loading !== null}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold rounded-xl py-4 text-lg transition-colors"
        >
          {loading === 'salida' ? 'Registrando...' : '🚪 Salida'}
        </button>
      </div>

      {/* Resumen del día */}
      {resumen && (
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">Personal en planta hoy</p>
          <p className="text-white text-3xl font-bold mt-1">{resumen.total}</p>
          <p className="text-gray-500 text-xs mt-1">con entrada registrada</p>
        </div>
      )}

      <a href="/" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
        ← Volver al inicio
      </a>
    </main>
  )
}
