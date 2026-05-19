'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Users, Package, ChevronDown, ChevronUp } from 'lucide-react'

const HORAS_POR_TURNO: Record<string, string[]> = {
  'MAÑANA': [
    '06:00-07:00','07:00-08:00','08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00',
    '12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00',
  ],
  'TARDE': [
    '13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00',
    '18:00-19:00','19:00-20:00','20:00-21:00','21:00-22:00',
  ],
  'NOCHE': [
    '22:00-23:00','23:00-00:00','00:00-01:00','01:00-02:00',
    '02:00-03:00','03:00-04:00','04:00-05:00','05:00-06:00',
  ],
}
function horasTurno(turno: string): string[] {
  return HORAS_POR_TURNO[turno] ?? HORAS_POR_TURNO['MAÑANA']
}

type Actividad = {
  id: string; sku: string | null; producto: string; proceso: string
  turno: string; cantidad: number; lote: string | null; personal_planeado: number | null
}
type Reporte = { hora: string; cantidad: number; tiempo_improductivo: number | null; observacion: string | null }
type OperarioAsignado = { cedula: string; nombre: string }
type Asistente = { cedula: string; nombre: string; hora_ingreso: string }
type SortField = 'proceso' | 'turno' | 'producto' | 'pct'
type SortDir = 'asc' | 'desc'

export default function AdminEjecucionPage() {
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }))
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [reportes, setReportes] = useState<Record<string, Reporte[]>>({})
  const [asignadosPor, setAsignadosPor] = useState<Record<string, OperarioAsignado[]>>({})
  const [expandida, setExpandida] = useState<string | null>(null)
  const [modalLote, setModalLote] = useState<string | null>(null)
  const [modalPersonas, setModalPersonas] = useState<string | null>(null)
  const [loteVal, setLoteVal] = useState('')
  const [asistenciaHoy, setAsistenciaHoy] = useState<Asistente[]>([])
  const [savingPersona, setSavingPersona] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('proceso')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filtroProceso, setFiltroProceso] = useState('')

  const cargarReportes = useCallback(async (id: string) => {
    const res = await fetch(`/api/reportes?actividad_id=${id}`)
    const data = await res.json()
    setReportes(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }))
  }, [])

  const cargarAsignados = useCallback(async (id: string) => {
    const res = await fetch(`/api/actividades/${id}/operarios`)
    const data = await res.json()
    setAsignadosPor(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }))
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    const jRes = await fetch('/api/jornadas')
    const jornadas = await jRes.json()
    const jornada = jornadas.find((j: { fecha: string }) => j.fecha === fecha)
    if (jornada) {
      const aRes = await fetch(`/api/jornadas/${jornada.id}/actividades`)
      const acts: Actividad[] = await aRes.json()
      setActividades(acts)
      await Promise.all(acts.map(a => Promise.all([cargarReportes(a.id), cargarAsignados(a.id)])))
    } else {
      setActividades([])
      setReportes({})
      setAsignadosPor({})
    }
    setLoading(false)
  }, [fecha, cargarReportes, cargarAsignados])

  useEffect(() => { cargar() }, [cargar])

  async function cargarAsistencia() {
    const res = await fetch(`/api/asistencia/lista?fecha=${fecha}`)
    setAsistenciaHoy(await res.json())
  }

  async function guardarLote() {
    if (!modalLote) return
    await fetch(`/api/actividades/${modalLote}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lote: loteVal }),
    })
    setModalLote(null); setLoteVal(''); cargar()
  }

  async function togglePersona(actividadId: string, asistente: Asistente) {
    const yaAsignado = (asignadosPor[actividadId] || []).some(a => a.cedula === asistente.cedula)
    setSavingPersona(asistente.cedula)
    await fetch(`/api/actividades/${actividadId}/operarios`, {
      method: yaAsignado ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: asistente.cedula, nombre: asistente.nombre }),
    })
    await cargarAsignados(actividadId)
    setSavingPersona(null)
  }

  function totalReportado(id: string) {
    return (reportes[id] || []).reduce((s, r) => s + r.cantidad, 0)
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-40" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-green-400" /> : <ArrowDown size={12} className="text-green-400" />
  }

  const procesos = [...new Set(actividades.map(a => a.proceso))].sort()

  const actividadesFiltradas = actividades
    .filter(a => !filtroProceso || a.proceso === filtroProceso)
    .slice()
    .sort((a, b) => {
      let va: string | number = '', vb: string | number = ''
      if (sortField === 'proceso')      { va = a.proceso; vb = b.proceso }
      else if (sortField === 'turno')   { va = a.turno;   vb = b.turno }
      else if (sortField === 'producto'){ va = a.producto; vb = b.producto }
      else if (sortField === 'pct') {
        va = a.cantidad > 0 ? Math.round((totalReportado(a.id) / a.cantidad) * 100) : 0
        vb = b.cantidad > 0 ? Math.round((totalReportado(b.id) / b.cantidad) * 100) : 0
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const actividadModal = modalPersonas ? actividades.find(a => a.id === modalPersonas) : null

  return (
    <div className="max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Ejecución</h1>
        <input
          type="date" value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
        <button onClick={cargar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">↻ Actualizar</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-10">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      ) : actividades.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No hay jornada para el {fecha}</p>
        </div>
      ) : (
        <>
          {/* Chips filtro por proceso */}
          <div className="flex gap-2 flex-wrap mb-3">
            <button onClick={() => setFiltroProceso('')}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{ background: !filtroProceso ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: !filtroProceso ? '#fff' : '#7aaa66' }}>
              Todos ({actividades.length})
            </button>
            {procesos.map(p => {
              const cnt = actividades.filter(a => a.proceso === p).length
              return (
                <button key={p} onClick={() => setFiltroProceso(p)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: filtroProceso === p ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228', color: filtroProceso === p ? '#fff' : '#7aaa66' }}>
                  {p} ({cnt})
                </button>
              )
            })}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a4e1c' }}>
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr style={{ background: '#1e3a14', borderBottom: '1px solid #2a4e1c' }}>
                  <th className="px-3 py-3 text-left">
                    <button onClick={() => toggleSort('proceso')} className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wide hover:text-white" style={{ color: '#7aaa66' }}>
                      Proceso <SortIcon field="proceso" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button onClick={() => toggleSort('turno')} className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wide hover:text-white" style={{ color: '#7aaa66' }}>
                      Turno <SortIcon field="turno" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button onClick={() => toggleSort('producto')} className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wide hover:text-white" style={{ color: '#7aaa66' }}>
                      Descripción <SortIcon field="producto" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide whitespace-nowrap" style={{ color: '#7aaa66' }}>Trip / Real</th>
                  <th className="px-3 py-3 text-center">
                    <button onClick={() => toggleSort('pct')} className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wide mx-auto hover:text-white" style={{ color: '#7aaa66' }}>
                      Avance <SortIcon field="pct" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide" style={{ color: '#7aaa66' }}>Lote</th>
                  <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide" style={{ color: '#7aaa66' }}>Personal</th>
                  <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide" style={{ color: '#7aaa66' }}>Horas</th>
                </tr>
              </thead>
              <tbody>
                {actividadesFiltradas.map((a, i) => {
                  const reps = reportes[a.id] || []
                  const asignados = asignadosPor[a.id] || []
                  const ejecutado = totalReportado(a.id)
                  const pct = a.cantidad > 0 ? Math.min(100, Math.round((ejecutado / a.cantidad) * 100)) : 0
                  const abierta = expandida === a.id
                  const horasDelTurno = horasTurno(a.turno)
                  const horasReportadas = reps.filter(r => horasDelTurno.includes(r.hora)).length

                  return (
                    <>
                      <tr key={a.id}
                        style={{
                          background: abierta ? '#1a3010' : i % 2 === 0 ? '#111a0d' : '#152010',
                          borderBottom: abierta ? 'none' : '1px solid #1e3414',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e3a14')}
                        onMouseLeave={e => (e.currentTarget.style.background = abierta ? '#1a3010' : i % 2 === 0 ? '#111a0d' : '#152010')}>

                        {/* Proceso */}
                        <td className="px-3 py-2.5">
                          <span className="text-white text-xs font-semibold">{a.proceso}</span>
                        </td>

                        {/* Turno */}
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            a.turno === 'MAÑANA' ? 'bg-yellow-900/60 text-yellow-300' :
                            a.turno === 'TARDE'  ? 'bg-orange-900/60 text-orange-300' :
                                                   'bg-blue-900/60 text-blue-300'
                          }`}>{a.turno}</span>
                        </td>

                        {/* Descripción */}
                        <td className="px-3 py-2.5 max-w-[200px]">
                          {a.sku && <span className="text-gray-500 font-mono text-[10px] mr-1.5">{a.sku}</span>}
                          <span className="text-white text-xs">{a.producto}</span>
                        </td>

                        {/* TRIP / REAL */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 font-mono">{a.personal_planeado ?? '—'}</span>
                              <span className="text-gray-600 text-[10px]">/</span>
                              <span className={`text-sm font-bold ${
                                asignados.length === 0 ? 'text-gray-600' :
                                asignados.length >= (a.personal_planeado ?? 0) ? 'text-green-400' : 'text-yellow-400'
                              }`}>{asignados.length}</span>
                            </div>
                            {a.personal_planeado != null && a.personal_planeado > 0 && (
                              <div className="w-10 bg-gray-800 rounded-full h-1">
                                <div className={`h-1 rounded-full ${asignados.length >= a.personal_planeado ? 'bg-green-500' : 'bg-yellow-500'}`}
                                  style={{ width: `${Math.min(100, Math.round((asignados.length / a.personal_planeado) * 100))}%` }} />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Avance */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-center gap-1 min-w-[90px]">
                            <div className="w-full bg-gray-800 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-gray-600'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-gray-400 text-[10px] whitespace-nowrap">
                              {ejecutado.toLocaleString()} / {a.cantidad.toLocaleString()}
                              <span className={`ml-1 font-bold ${pct >= 100 ? 'text-emerald-400' : pct >= 60 ? 'text-blue-400' : 'text-gray-400'}`}>{pct}%</span>
                            </span>
                          </div>
                        </td>

                        {/* Lote */}
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => { setModalLote(a.id); setLoteVal(a.lote || '') }}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg mx-auto transition-colors ${
                              a.lote ? 'bg-amber-900/50 text-amber-300 hover:bg-amber-800/50' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                            }`}>
                            <Package size={11} />
                            {a.lote || 'Asignar'}
                          </button>
                        </td>

                        {/* Personal */}
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => { setModalPersonas(a.id); cargarAsistencia() }}
                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mx-auto transition-colors ${
                              asignados.length > 0 ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/40' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                            }`}>
                            <Users size={11} />
                            {asignados.length > 0 ? asignados.length : 'Asignar'}
                          </button>
                        </td>

                        {/* Horas */}
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => setExpandida(abierta ? null : a.id)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg mx-auto bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
                            <span className="font-mono">{horasReportadas}/{horasDelTurno.length}</span>
                            {abierta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                      </tr>

                      {/* Fila expandida — grid de horas */}
                      {abierta && (
                        <tr key={`${a.id}-horas`} style={{ background: '#0d1a0a', borderBottom: '2px solid #2a4e1c' }}>
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                              {horasTurno(a.turno).map(hora => {
                                const rep = reps.find(r => r.hora === hora)
                                return (
                                  <div key={hora}
                                    className="rounded-lg p-2 text-center text-xs"
                                    style={{
                                      background: rep ? 'rgba(16,80,20,0.55)' : '#111e0c',
                                      border: rep ? '1px solid #2a6e20' : '1px solid #1a3010',
                                    }}>
                                    <div className="font-mono text-[10px]" style={{ color: '#6b9a60' }}>{hora.slice(0, 5)}</div>
                                    <div className="font-bold text-white mt-0.5">{rep ? rep.cantidad.toLocaleString() : <span style={{ color: '#2a4a22' }}>—</span>}</div>
                                    {rep?.tiempo_improductivo ? (
                                      <div className="text-[9px] text-orange-400 font-semibold mt-0.5" title={rep.observacion || ''}>
                                        {rep.tiempo_improductivo}min⚠
                                      </div>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Lote */}
      {modalLote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-xs flex flex-col gap-4">
            <h2 className="text-white font-semibold">Registrar lote</h2>
            <input type="text" autoFocus placeholder="Número de lote"
              value={loteVal} onChange={e => setLoteVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardarLote()}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 font-mono" />
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm flex flex-col gap-4 max-h-[85vh]">
            <div>
              <h2 className="text-white font-semibold">Asignar personal</h2>
              {actividadModal && (
                <p className="text-gray-400 text-sm mt-0.5">{actividadModal.producto} · {actividadModal.proceso}</p>
              )}
              {actividadModal && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-gray-800 rounded-lg">
                  <span className="text-gray-400 text-xs">TRIP:</span>
                  <span className="text-white font-bold text-sm">{actividadModal.personal_planeado ?? '—'}</span>
                  <span className="text-gray-600 text-xs mx-1">·</span>
                  <span className="text-gray-400 text-xs">Asignados:</span>
                  <span className={`font-bold text-sm ${
                    (asignadosPor[modalPersonas] || []).length >= (actividadModal.personal_planeado ?? 0) ? 'text-green-400' : 'text-yellow-400'
                  }`}>{(asignadosPor[modalPersonas] || []).length}</span>
                </div>
              )}
            </div>

            {asistenciaHoy.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay asistencia registrada para esta fecha</p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                {asistenciaHoy.map(op => {
                  const asignado = (asignadosPor[modalPersonas] || []).some(a => a.cedula === op.cedula)
                  const cargando = savingPersona === op.cedula
                  return (
                    <button key={op.cedula}
                      onClick={() => togglePersona(modalPersonas, op)}
                      disabled={cargando}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors text-left ${
                        asignado ? 'bg-blue-800/60 border border-blue-600 hover:bg-blue-700/60' : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                      } ${cargando ? 'opacity-50' : ''}`}>
                      <div>
                        <p className="text-white text-sm font-medium">{op.nombre}</p>
                        <p className="text-gray-400 text-xs">{op.cedula} · Entró {op.hora_ingreso}</p>
                      </div>
                      <span className={`text-lg font-bold ${asignado ? 'text-blue-400' : 'text-gray-600'}`}>
                        {cargando ? '…' : asignado ? '✓' : '+'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <button onClick={() => setModalPersonas(null)} className="text-gray-400 hover:text-white text-sm py-1">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
