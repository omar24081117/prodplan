'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Jornada = {
  id: string
  fecha: string
  semana: string | null
  personal_disponible: number
  created_at: string
}

export default function PlaneacionPage() {
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fecha: '', semana: '', personal_disponible: '' })
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/jornadas')
    const data = await res.json()
    setJornadas(data)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/jornadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: form.fecha,
        semana: form.semana || null,
        personal_disponible: parseInt(form.personal_disponible),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al guardar')
    } else {
      setShowForm(false)
      setForm({ fecha: '', semana: '', personal_disponible: '' })
      cargar()
    }
    setSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Planeación</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + Nueva jornada
        </button>
      </div>

      {showForm && (
        <form onSubmit={guardar} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6 flex flex-col gap-3">
          <h2 className="text-white font-semibold">Nueva jornada</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Fecha *</label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Semana</label>
              <input
                type="text"
                placeholder="Ej: Semana 20"
                value={form.semana}
                onChange={e => setForm(f => ({ ...f, semana: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Personal disponible *</label>
              <input
                type="number"
                required
                min={1}
                value={form.personal_disponible}
                onChange={e => setForm(f => ({ ...f, personal_disponible: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-white px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400">Cargando jornadas...</p>
      ) : jornadas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No hay jornadas creadas</p>
          <p className="text-sm mt-1">Crea la primera jornada para comenzar a planear</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jornadas.map(j => (
            <div key={j.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">
                  {j.fecha ? new Date(j.fecha.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </p>
                <p className="text-gray-400 text-sm mt-0.5">
                  {j.semana && <span className="mr-3">{j.semana}</span>}
                  <span>{j.personal_disponible} personas disponibles</span>
                </p>
              </div>
              <Link
                href={`/admin/planeacion/${j.id}`}
                className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                Planear →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
