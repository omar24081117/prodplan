'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Users, Package, ChevronDown, ChevronUp, Clock } from 'lucide-react'

function formatHoras(horas: number): string {
  if (!isFinite(horas) || horas <= 0) return '—'
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

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
  turno: string; cantidad: number; lote: string | null; unidad: string | null
  personal_planeado: number | null; estandar: number | null
}
type Reporte = { hora: string; cantidad: number; tiempo_improductivo: number | null; observacion: string | null }
type OperarioAsignado = { cedula: string; nombre: string }
type OperarioSession = { cedula: string; nombre: string }
type Asistente = { cedula: string; nombre: string; hora_ingreso: string }
type SortField = 'proceso' | 'turno' | 'producto' | 'pct'
type SortDir = 'asc' | 'desc'

export default function EjecucionPage() {
  const [operario, setOperario] = useState<OperarioSession | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [reportes, setReportes] = useState<Record<string, Reporte[]>>({})
  const [asignadosPor, setAsignadosPor] = useState<Record<string, OperarioAsignado[]>>({})
  const [expandida, setExpandida] = useState<string | null>(null)
  const [modal, setModal] = useState<{ actividadId: string; hora: string } | null>(null)
  const [modalLote, setModalLote] = useState<{ id: string; loteActual: string | null } | null>(null)
  const [modalPersonas, setModalPersonas] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [tiempoImprod, setTiempoImprod] = useState('')
  const [observacion, setObservacion] = useState('')
  const [causales, setCausales] = useState<string[]>([])
  const [loteVal, setLoteVal] = useState('')
  const [asistenciaHoy, setAsistenciaHoy] = useState<Asistente[]>([])
  const [savingPersona, setSavingPersona] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('proceso')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filtroProceso, setFiltroProceso] = useState('')

  useEffect(() => {
    fetch('/api/auth/sesion').then(r => r.json())
      .then(data => { if (data.operario) setOperario(data.operario) }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/causales-paro').then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCausales(d.filter((c: { activo: boolean }) => c.activo).map((c: { nombre: string }) => c.nombre)) })
      .catch(() => {})
  }, [])

  const cargarReportes = useCallback(async (id: string) => {
    const res = await fetch(`/api/reportes?actividad_id=${id}`)
    const data = await res.json()
    setReportes(prev => ({ ...prev, [id]: data }))
  }, [])

  const cargarAsignados = useCallback(async (id: string) => {
    const res = await fetch(`/api/actividades/${id}/operarios`)
    const data = await res.json()
    setAsignadosPor(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }))
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const jRes = await fetch('/api/jornadas')
    const jornadas = await jRes.json()
    const hoy = jornadas.find((j: { fecha: string; id: string }) => j.fecha === fecha)
    if (hoy) {
      const aRes = await fetch(`/api/jornadas/${hoy.id}/actividades`)
      const acts: Actividad[] = await aRes.json()
      setActividades(acts)
      await Promise.all(acts.map(a => Promise.all([cargarReportes(a.id), cargarAsignados(a.id)])))
    }
    setLoading(false)
  }, [cargarReportes, cargarAsignados])

  useEffect(() => { cargar() }, [cargar])

  async function cargarAsistencia() {
    const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const res = await fetch(`/api/asistencia/lista?fecha=${fecha}`)
    setAsistenciaHoy(await res.json())
  }

  async function reportar() {
    if (!modal || !cantidad || !operario) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actividad_id: modal.actividadId, hora: modal.hora,
          cantidad: parseInt(cantidad),
          tiempo_improductivo: tiempoImprod ? parseInt(tiempoImprod) : null,
          observacion: observacion.trim() || null,
          operario_cedula: operario.cedula, operario_nombre: operario.nombre,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSaveError(err.error || `Error ${res.status} al guardar`)
        setSaving(false)
        return
      }
      await cargarReportes(modal.actividadId)
      setModal(null); setCantidad(''); setTiempoImprod(''); setObservacion('')
    } catch {
      setSaveError('Error de red al guardar')
    }
    setSaving(false)
  }

  async function guardarLote() {
    if (!modalLote) return
    await fetch(`/api/actividades/${modalLote.id}`, {
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

  // Sorting
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const procesos = [...new Set(actividades.map(a => a.proceso))].sort()

  const actividadesFiltradas = actividades
    .filter(a => !filtroProceso || a.proceso === filtroProceso)
    .slice()
    .sort((a, b) => {
      let va: string | number = '', vb: string | number = ''
      if (sortField === 'proceso') { va = a.proceso; vb = b.proceso }
      else if (sortField === 'turno') { va = a.turno; vb = b.turno }
      else if (sortField === 'producto') { va = a.producto; vb = b.producto }
      else if (sortField === 'pct') {
        va = Math.round((totalReportado(a.id) / a.cantidad) * 100)
        vb = Math.round((totalReportado(b.id) / b.cantidad) * 100)
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-40" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-green-400" /> : <ArrowDown size={12} className="text-green-400" />
  }

  const actividadModal = modalPersonas ? actividades.find(a => a.id === modalPersonas) : null

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(145deg, #b8c4a4 0%, #ccd8b4 40%, #bfcbaa 70%, #b4c0a0 100%)' }}>
      <p style={{ color: '#3a4e28' }}>Cargando jornada...</p>
    </main>
  )

  return (
    <main className="min-h-screen p-3 sm:p-5"
      style={{ background: 'linear-gradient(145deg, #b8c4a4 0%, #ccd8b4 40%, #bfcbaa 70%, #b4c0a0 100%)' }}>
      <div className="max-w-5xl mx-auto">

        {/* Encabezado */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1a3010' }}>Ejecución</h1>
            <p className="text-sm" style={{ color: '#3a5428' }}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {operario && (
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: '#1a3010' }}>{operario.nombre}</p>
              <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => location.href = '/')}
                className="text-xs hover:text-red-500" style={{ color: '#5a7045' }}>Salir</button>
            </div>
          )}
        </div>

        {actividades.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#5a7045' }}>
            <p className="text-lg">No hay actividades planeadas para hoy</p>
            <p className="text-sm mt-1">El administrador debe crear la jornada de hoy</p>
          </div>
        ) : (
          <>
            {/* Filtro por proceso */}
            <div className="flex gap-2 flex-wrap mb-3">
              <button onClick={() => setFiltroProceso('')}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${!filtroProceso ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                style={{ background: !filtroProceso ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228' }}>
                Todos ({actividades.length})
              </button>
              {procesos.map(p => {
                const count = actividades.filter(a => a.proceso === p).length
                return (
                  <button key={p} onClick={() => setFiltroProceso(p)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${filtroProceso === p ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    style={{ background: filtroProceso === p ? '#2e6e20' : '#1e3a14', border: '1px solid #3a6228' }}>
                    {p} ({count})
                  </button>
                )
              })}
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a4e1c' }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr style={{ background: '#1e3a14' }}>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => toggleSort('proceso')}
                        className="flex items-center gap-1 text-gray-400 hover:text-white font-semibold text-xs uppercase tracking-wide">
                        Proceso <SortIcon field="proceso" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => toggleSort('turno')}
                        className="flex items-center gap-1 text-gray-400 hover:text-white font-semibold text-xs uppercase tracking-wide">
                        Turno <SortIcon field="turno" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => toggleSort('producto')}
                        className="flex items-center gap-1 text-gray-400 hover:text-white font-semibold text-xs uppercase tracking-wide">
                        Descripción <SortIcon field="producto" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wide">Lote</th>
                    <th className="px-3 py-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Trip / Real</th>
                    <th className="px-3 py-3 text-center">
                      <button onClick={() => toggleSort('pct')}
                        className="flex items-center gap-1 text-gray-400 hover:text-white font-semibold text-xs uppercase tracking-wide mx-auto">
                        Avance <SortIcon field="pct" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wide">Asignar</th>
                    <th className="px-3 py-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">T.Estimado</th>
                    <th className="px-3 py-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wide">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {actividadesFiltradas.map((a, i) => {
                    const reps = reportes[a.id] || []
                    const asignados = asignadosPor[a.id] || []
                    const ejecutado = totalReportado(a.id)
                    const pct = Math.min(100, Math.round((ejecutado / a.cantidad) * 100))
                    const abierta = expandida === a.id
                    const horasDelTurno = horasTurno(a.turno)
                    const horasReportadas = reps.filter(r => horasDelTurno.includes(r.hora)).length

                    return (
                      <>
                        <tr key={a.id}
                          style={{
                            background: i % 2 === 0 ? '#111a0d' : '#152010',
                            borderBottom: abierta ? 'none' : '1px solid #1e3414',
                          }}>
                          {/* Proceso */}
                          <td className="px-3 py-3">
                            <span className="text-white font-semibold text-xs">{a.proceso}</span>
                          </td>
                          {/* Turno */}
                          <td className="px-3 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              a.turno === 'MAÑANA' ? 'bg-yellow-900 text-yellow-300' :
                              a.turno === 'TARDE'  ? 'bg-orange-900 text-orange-300' :
                                                     'bg-blue-900 text-blue-300'
                            }`}>{a.turno}</span>
                          </td>
                          {/* Descripción */}
                          <td className="px-3 py-3 max-w-[220px]">
                            {a.sku && <span className="text-gray-500 font-mono text-[10px] mr-1.5">{a.sku}</span>}
                            <span className="text-white text-xs">{a.producto}</span>
                            {(a.unidad) && <span className="text-gray-500 text-[10px] ml-1">· {a.unidad}</span>}
                          </td>
                          {/* Lote */}
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => { setModalLote({ id: a.id, loteActual: a.lote }); setLoteVal(a.lote || '') }}
                              className={`text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 mx-auto ${
                                a.lote ? 'bg-amber-900/50 text-amber-300 hover:bg-amber-800' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                              }`}>
                              <Package size={11} />
                              {a.lote || 'Asignar'}
                            </button>
                          </td>

                          {/* TRIP / REAL */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {/* Planeado (TRIP) */}
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {a.personal_planeado ?? '—'}
                                </span>
                                <span className="text-gray-600 text-[10px]">/</span>
                                {/* Real (asignados) */}
                                <span className={`text-sm font-bold ${
                                  asignados.length === 0 ? 'text-gray-600' :
                                  asignados.length >= (a.personal_planeado ?? 0) ? 'text-green-400' :
                                  'text-yellow-400'
                                }`}>
                                  {asignados.length}
                                </span>
                              </div>
                              {a.personal_planeado != null && (
                                <div className="w-12 bg-gray-800 rounded-full h-1">
                                  <div className={`h-1 rounded-full transition-all ${
                                    asignados.length >= a.personal_planeado ? 'bg-green-500' : 'bg-yellow-500'
                                  }`} style={{ width: `${Math.min(100, Math.round((asignados.length / a.personal_planeado) * 100))}%` }} />
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Avance */}
                          <td className="px-3 py-3">
                            <div className="flex flex-col items-center gap-1 min-w-[90px]">
                              <div className="w-full bg-gray-800 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-gray-600'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-gray-400 text-[10px] whitespace-nowrap">
                                {ejecutado.toLocaleString()} / {a.cantidad.toLocaleString()}
                                <span className={`ml-1 font-bold ${pct >= 100 ? 'text-emerald-400' : pct >= 60 ? 'text-blue-400' : 'text-gray-400'}`}>
                                  {pct}%
                                </span>
                              </span>
                            </div>
                          </td>
                          {/* Personal */}
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => { setModalPersonas(a.id); cargarAsistencia() }}
                              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mx-auto transition-colors ${
                                asignados.length > 0 ? 'bg-green-900/50 text-green-300 hover:bg-green-800/50' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                              }`}>
                              <Users size={11} />
                              {asignados.length > 0 ? asignados.length : 'Asignar'}
                            </button>
                          </td>
                          {/* T.Estimado */}
                          <td className="px-3 py-3 text-center">
                            {(() => {
                              if (!a.estandar || a.estandar <= 0) return <span className="text-gray-600 text-xs">—</span>
                              const trip = asignados.length > 0 ? asignados.length : (a.personal_planeado || 1)
                              const horas = a.cantidad / (a.estandar * trip)
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
                                    <Clock size={10} />
                                    {formatHoras(horas)}
                                  </span>
                                  {asignados.length === 0 && a.personal_planeado == null && (
                                    <span className="text-yellow-500 text-[9px]">TRIP=1</span>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          {/* Expandir horas */}
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => setExpandida(abierta ? null : a.id)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg mx-auto transition-colors bg-gray-800 hover:bg-gray-700 text-gray-300"
                              title="Ver horas">
                              <span className="font-mono">{horasReportadas}/{horasDelTurno.length}</span>
                              {abierta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </td>
                        </tr>

                        {/* Fila expandida — grid de horas */}
                        {abierta && (
                          <tr key={`${a.id}-horas`} style={{ background: i % 2 === 0 ? '#0d1a0a' : '#111a0d', borderBottom: '1px solid #1e3414' }}>
                            <td colSpan={9} className="px-4 py-3">
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                {horasTurno(a.turno).map(hora => {
                                  const rep = reps.find(r => r.hora === hora)
                                  return (
                                    <button key={hora}
                                      onClick={() => {
                                        setModal({ actividadId: a.id, hora })
                                        setCantidad(rep?.cantidad.toString() || '')
                                        setTiempoImprod(rep?.tiempo_improductivo?.toString() || '')
                                        setObservacion(rep?.observacion || '')
                                      }}
                                      className={`rounded-lg p-2 text-center text-xs transition-colors ${
                                        rep ? 'bg-emerald-800 border border-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-green-500 hover:text-white'
                                      }`}>
                                      <div className="font-mono text-[10px]">{hora.slice(0, 5)}</div>
                                      <div className="font-bold mt-0.5">{rep ? rep.cantidad.toLocaleString() : '—'}</div>
                                      {rep?.tiempo_improductivo ? (
                                        <div className="text-[9px] text-orange-400 mt-0.5 font-semibold">{rep.tiempo_improductivo}min⚠</div>
                                      ) : null}
                                    </button>
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
      </div>

      {/* Modal reportar cantidad */}
      {modal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4" style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
            <div>
              <h2 className="text-white font-semibold">Reportar hora</h2>
              <p className="text-gray-400 text-sm mt-0.5">Hora: <span className="text-white font-mono">{modal.hora}</span></p>
            </div>

            <div>
              <label className="text-gray-400 text-xs block mb-1">Cantidad producida *</label>
              <input type="number" min={0} autoFocus placeholder="0"
                value={cantidad} onChange={e => setCantidad(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && reportar()}
                className="w-full bg-gray-800 border border-gray-700 text-white text-center text-2xl font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-green-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-orange-400 text-xs block mb-1">⚠ Tiempo improductivo (min)</label>
                <input type="number" min={0} max={60} placeholder="0"
                  value={tiempoImprod} onChange={e => setTiempoImprod(e.target.value)}
                  className="w-full bg-gray-800 border border-orange-900 text-white text-center text-lg font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-400 text-xs block mb-1">Observación</label>
                {causales.length > 0 ? (
                  <select
                    value={observacion} onChange={e => setObservacion(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 flex-1"
                  >
                    <option value="">Seleccionar causa...</option>
                    {causales.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="Causa del paro..."
                    value={observacion} onChange={e => setObservacion(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 flex-1" />
                )}
              </div>
            </div>

            {saveError && (
              <p className="text-red-400 text-xs bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="flex gap-2">
              <button onClick={reportar} disabled={!cantidad || saving}
                className="flex-1 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => { setModal(null); setCantidad(''); setTiempoImprod(''); setObservacion(''); setSaveError('') }}
                className="px-4 py-3 text-gray-400 hover:text-white">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lote */}
      {modalLote && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-6 w-full max-w-xs flex flex-col gap-4" style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
            <h2 className="text-white font-semibold">Registrar lote</h2>
            <input type="text" autoFocus placeholder="Número de lote"
              value={loteVal} onChange={e => setLoteVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardarLote()}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 font-mono" />
            <div className="flex gap-2">
              <button onClick={guardarLote}
                className="flex-1 text-white font-semibold py-2.5 rounded-xl transition-all"
                style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
                Guardar
              </button>
              <button onClick={() => setModalLote(null)} className="px-4 text-gray-400 hover:text-white">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal personas */}
      {modalPersonas && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl p-5 w-full max-w-sm flex flex-col gap-3 max-h-[85vh]" style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
            <div>
              <h2 className="text-white font-semibold">Asignar personal</h2>
              {actividadModal && (
                <p className="text-gray-400 text-sm mt-0.5">{actividadModal.proceso} · {actividadModal.producto}</p>
              )}
              {actividadModal && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(46,110,32,0.2)', border: '1px solid #3a6228' }}>
                  <span className="text-gray-400 text-xs">TRIP planeado:</span>
                  <span className="text-white font-bold text-sm">{actividadModal.personal_planeado ?? '—'}</span>
                  <span className="text-gray-500 text-xs mx-1">·</span>
                  <span className="text-gray-400 text-xs">Asignados:</span>
                  <span className={`font-bold text-sm ${
                    (asignadosPor[modalPersonas!] || []).length >= (actividadModal.personal_planeado ?? 0)
                      ? 'text-green-400' : 'text-yellow-400'
                  }`}>{(asignadosPor[modalPersonas!] || []).length}</span>
                </div>
              )}
            </div>
            {asistenciaHoy.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay asistencia registrada para hoy</p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto">
                {asistenciaHoy.map(op => {
                  const asignado = (asignadosPor[modalPersonas] || []).some(a => a.cedula === op.cedula)
                  const cargando = savingPersona === op.cedula
                  return (
                    <button key={op.cedula}
                      onClick={() => togglePersona(modalPersonas, op)}
                      disabled={cargando}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors text-left ${
                        asignado ? 'border border-green-600 text-white' : 'border border-gray-700 text-gray-300 hover:border-gray-500'
                      } ${cargando ? 'opacity-50' : ''}`}
                      style={{ background: asignado ? 'rgba(46,110,32,0.4)' : '#162e10' }}>
                      <div>
                        <p className="text-sm font-medium">{op.nombre}</p>
                        <p className="text-gray-500 text-xs">{op.cedula} · Entró {op.hora_ingreso}</p>
                      </div>
                      <span className={`text-lg font-bold ${asignado ? 'text-green-400' : 'text-gray-600'}`}>
                        {cargando ? '…' : asignado ? '✓' : '+'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => setModalPersonas(null)}
              className="text-gray-400 hover:text-white text-sm py-1 mt-1">Cerrar</button>
          </div>
        </div>
      )}
    </main>
  )
}
