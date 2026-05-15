'use client'

import { useState, useEffect, useCallback } from 'react'

const HORAS = ['07:00-08:00','08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00',
  '12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00']

type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string
  turno: string; cantidad: number; lote: string | null; personal_planeado: number | null
}
type Reporte = { hora: string; cantidad: number; operario_nombre: string | null }
type Operario = { cedula: string; nombre: string; hora_ingreso: string }

export default function AdminEjecucionPage() {
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA'))
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [reportes, setReportes] = useState<Record<string, Reporte[]>>({})
  const [expandida, setExpandida] = useState<string | null>(null)
  const [modalLote, setModalLote] = useState<string | null>(null)
  const [modalPersonas, setModalPersonas] = useState<string | null>(null)
  const [loteVal, setLoteVal] = useState('')
  const [asistenciaHoy, setAsistenciaHoy] = useState<Operario[]>([])
  const [loading, setLoading] = useState(true)

  const cargarReportes = useCallback(async (actividadId: string) => {
    const res = await fetch(`/api/reportes?actividad_id=${actividadId}`)
    const data = await res.json()
    setReportes(prev => ({ ...prev, [actividadId]: data }))
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    const jornadasRes = await fetch('/api/jornadas')
    const jornadas = await jornadasRes.json()
    const jornada = jornadas.find((j: { fecha: string }) => j.fecha === fecha)
    if (jornada) {
      const actRes = await fetch(`/api/jornadas/${jornada.id}/actividades`)
      const acts: Actividad[] = await actRes.json()
      setActividades(acts)
      await Promise.all(acts.map(a => cargarReportes(a.id)))
    } else {
      setActividades([])
    }
    setLoading(false)
  }, [fecha, cargarReportes])

  useEffect(() => { cargar() }, [cargar])

  async function cargarAsistencia() {
    const res = await fetch(`/api/asistencia/lista?fecha=${fecha}`)
    const data = await res.json()
    setAsistenciaHoy(data)
  }

  async function guardarLote() {
    if (!modalLote) return
    await fetch(`/api/actividades/${modalLote}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lote: loteVal }),
    })
    setModalLote(null)
    setLoteVal('')
    cargar()
  }

  function totalReportado(actividadId: string) {
    return (reportes[actividadId] || []).reduce((s, r) => s + r.cantidad, 0)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Ejecución</h1>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
        <button onClick={cargar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">↻ Actualizar</button>
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : actividades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No hay jornada para el {fecha}</p>
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
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setExpandida(abierta ? null : a.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.sku && <span className="text-gray-500 text-xs font-mono">{a.sku}</span>}
                        <span className="text-white font-semibold">{a.producto}</span>
                        <span className="text-gray-400 text-xs">{a.proceso}</span>
                        <span className="text-gray-400 text-xs">{a.turno}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-gray-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs whitespace-nowrap">
                          {ejecutado.toLocaleString()} / {a.cantidad.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                    </button>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setModalPersonas(a.id); cargarAsistencia() }}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-2 py-1.5 rounded-lg"
                        title="Asignar personas"
                      >
                        👥
                      </button>
                      <button
                        onClick={() => { setModalLote(a.id); setLoteVal(a.lote || '') }}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-2 py-1.5 rounded-lg"
                        title="Registrar lote"
                      >
                        📦 {a.lote ? <span className="font-mono text-emerald-400">{a.lote}</span> : ''}
                      </button>
                    </div>
                  </div>
                </div>

                {abierta && (
                  <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                    <div className="grid grid-cols-5 gap-1.5">
                      {HORAS.map(hora => {
                        const rep = reps.find(r => r.hora === hora)
                        return (
                          <div
                            key={hora}
                            className={`rounded-lg p-2 text-center text-xs ${
                              rep ? 'bg-emerald-900/50 border border-emerald-700' : 'bg-gray-800 border border-gray-700'
                            }`}
                          >
                            <div className="font-mono text-[10px] text-gray-400">{hora.slice(0, 5)}</div>
                            <div className="font-bold text-white mt-0.5">{rep ? rep.cantidad : '—'}</div>
                            {rep?.operario_nombre && (
                              <div className="text-[9px] text-gray-500 truncate">{rep.operario_nombre.split(' ')[0]}</div>
                            )}
                          </div>
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

      {/* Modal Lote */}
      {modalLote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-xs flex flex-col gap-4">
            <h2 className="text-white font-semibold">Registrar lote</h2>
            <input
              type="text"
              autoFocus
              placeholder="Número de lote"
              value={loteVal}
              onChange={e => setLoteVal(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={guardarLote} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg">Guardar</button>
              <button onClick={() => setModalLote(null)} className="px-4 text-gray-400 hover:text-white">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Personas */}
      {modalPersonas && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-white font-semibold">Personal en planta hoy</h2>
            {asistenciaHoy.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay asistencia registrada para esta fecha</p>
            ) : (
              <div className="flex flex-col gap-2">
                {asistenciaHoy.map(op => (
                  <div key={op.cedula} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white text-sm">{op.nombre}</p>
                      <p className="text-gray-400 text-xs">{op.cedula} · Entró {op.hora_ingreso}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setModalPersonas(null)} className="text-gray-400 hover:text-white text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
