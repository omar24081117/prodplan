'use client'

import { useState, useEffect, useCallback } from 'react'

const HORAS = ['07:00-08:00','08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00',
  '12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00']

type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string
  turno: string; cantidad: number; lote: string | null
}
type Reporte = { hora: string; cantidad: number; operario_nombre: string | null }
type OperarioSession = { cedula: string; nombre: string }

export default function EjecucionPage() {
  const [operario, setOperario] = useState<OperarioSession | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [reportes, setReportes] = useState<Record<string, Reporte[]>>({})
  const [expandida, setExpandida] = useState<string | null>(null)
  const [modal, setModal] = useState<{ actividadId: string; hora: string } | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Obtener sesión del operario desde la cookie via API
  useEffect(() => {
    fetch('/api/auth/sesion')
      .then(r => r.json())
      .then(data => { if (data.operario) setOperario(data.operario) })
      .catch(() => {})
  }, [])

  const cargarReportes = useCallback(async (actividadId: string) => {
    const res = await fetch(`/api/reportes?actividad_id=${actividadId}`)
    const data = await res.json()
    setReportes(prev => ({ ...prev, [actividadId]: data }))
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    const fecha = new Date().toLocaleDateString('en-CA')
    const jornadasRes = await fetch('/api/jornadas')
    const jornadas = await jornadasRes.json()
    const hoy = jornadas.find((j: { fecha: string; id: string }) => j.fecha === fecha)
    if (hoy) {
      const actRes = await fetch(`/api/jornadas/${hoy.id}/actividades`)
      const acts: Actividad[] = await actRes.json()
      setActividades(acts)
      await Promise.all(acts.map(a => cargarReportes(a.id)))
    }
    setLoading(false)
  }, [cargarReportes])

  useEffect(() => { cargar() }, [cargar])

  async function reportar() {
    if (!modal || !cantidad || !operario) return
    setSaving(true)
    await fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actividad_id: modal.actividadId,
        hora: modal.hora,
        cantidad: parseInt(cantidad),
        operario_cedula: operario.cedula,
        operario_nombre: operario.nombre,
      }),
    })
    await cargarReportes(modal.actividadId)
    setModal(null)
    setCantidad('')
    setSaving(false)
  }

  function totalReportado(actividadId: string) {
    return (reportes[actividadId] || []).reduce((s, r) => s + r.cantidad, 0)
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Cargando jornada...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Ejecución</h1>
            <p className="text-gray-400 text-sm">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {operario && (
            <div className="text-right">
              <p className="text-white text-sm font-semibold">{operario.nombre}</p>
              <button
                onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => location.href = '/')}
                className="text-gray-500 text-xs hover:text-red-400"
              >
                Salir
              </button>
            </div>
          )}
        </div>

        {actividades.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No hay actividades planeadas para hoy</p>
            <p className="text-sm mt-1">El administrador debe crear la jornada de hoy</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {actividades.map(a => {
              const reps = reportes[a.id] || []
              const ejecutado = totalReportado(a.id)
              const pct = Math.min(100, Math.round((ejecutado / a.cantidad) * 100))
              const abierta = expandida === a.id

              return (
                <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandida(abierta ? null : a.id)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.sku && <span className="text-gray-500 text-xs font-mono">{a.sku}</span>}
                        <span className="text-white font-semibold truncate">{a.producto}</span>
                        <span className="text-gray-400 text-xs">{a.proceso}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-gray-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs whitespace-nowrap">
                          {ejecutado.toLocaleString()} / {a.cantidad.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-500">{abierta ? '▲' : '▼'}</span>
                  </button>

                  {abierta && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                      <div className="grid grid-cols-5 gap-1.5">
                        {HORAS.map(hora => {
                          const rep = reps.find(r => r.hora === hora)
                          return (
                            <button
                              key={hora}
                              onClick={() => { setModal({ actividadId: a.id, hora }); setCantidad(rep?.cantidad.toString() || '') }}
                              className={`rounded-lg p-2 text-center text-xs transition-colors ${
                                rep
                                  ? 'bg-emerald-800 border border-emerald-600 text-white'
                                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-white'
                              }`}
                            >
                              <div className="font-mono text-[10px]">{hora.slice(0, 5)}</div>
                              <div className="font-bold mt-0.5">{rep ? rep.cantidad : '—'}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal reportar */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-xs flex flex-col gap-4">
            <h2 className="text-white font-semibold">Reportar cantidad</h2>
            <p className="text-gray-400 text-sm">Hora: <span className="text-white">{modal.hora}</span></p>
            <input
              type="number"
              min={0}
              autoFocus
              placeholder="Cantidad producida"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-center text-2xl font-bold rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={reportar}
                disabled={!cantidad || saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-3 text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
