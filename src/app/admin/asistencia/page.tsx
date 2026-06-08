'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Users, UserCheck, TrendingUp, Calendar, BarChart3 } from 'lucide-react'

type RegistroBase = { cedula: string; nombre: string; rol: string; hora_ingreso: string; hora_salida: string | null; fecha?: string }

type EstadisticasRango = {
  total_operarios_sistema: number
  dias_en_rango: number
  promedio_operarios_dia: number
  asistencia_por_dia: { fecha: string; count: number }[]
  pct_promedio: number
}

type ResumenEmpleado = { cedula: string; nombre: string; rol: string; dias: number; dias_lista: string[] }

function sumarHoras(hora: string, horas: number): string {
  const [h, m] = hora.split(':').map(Number)
  const totalMin = h * 60 + m + horas * 60
  const hh = Math.floor(totalMin / 60) % 24
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function horasTranscurridas(horaIngreso: string): number {
  const horaActual = new Date().toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const [hi, mi] = horaIngreso.split(':').map(Number)
  const [ha, ma] = horaActual.split(':').map(Number)
  let minActual = ha * 60 + ma
  const minIngreso = hi * 60 + mi
  if (minActual < minIngreso) minActual += 24 * 60
  return (minActual - minIngreso) / 60
}

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const ROL_COLOR: Record<string, string> = {
  Operario:   'bg-emerald-900/50 text-emerald-300',
  Supervisor: 'bg-blue-900/50 text-blue-300',
  Analista:   'bg-purple-900/50 text-purple-300',
  Director:   'bg-amber-900/50 text-amber-300',
  Gerencia:   'bg-rose-900/50 text-rose-300',
}

export default function AsistenciaAdminPage() {
  const hoy     = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const primerDia = hoy.slice(0, 7) + '-01'

  const [modo,      setModo]     = useState<'dia' | 'rango'>('dia')
  const [fecha,     setFecha]    = useState(hoy)
  const [fInicio,   setFInicio]  = useState(primerDia)
  const [fFin,      setFFin]     = useState(hoy)
  const [registros, setRegistros]= useState<RegistroBase[]>([])
  const [resumen,   setResumen]  = useState<ResumenEmpleado[]>([])
  const [stats,     setStats]    = useState<{ total_operarios_sistema?: number } & Partial<EstadisticasRango>>({})
  const [loading,   setLoading]  = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const url = modo === 'dia'
      ? `/api/asistencia/lista?fecha=${fecha}`
      : `/api/asistencia/lista?fecha_inicio=${fInicio}&fecha_fin=${fFin}`
    const res  = await fetch(url)
    const data = await res.json()
    setRegistros(data.registros ?? [])
    setResumen(data.resumen_empleados ?? [])
    setStats(data.estadisticas ?? {})
    setLoading(false)
  }, [modo, fecha, fInicio, fFin])

  useEffect(() => { cargar() }, [cargar])

  // ── MODO DÍA: separar operarios de otros ─────────────────────────────────
  const operarios = registros.filter(r => r.rol === 'Operario')
  const otros     = registros.filter(r => r.rol !== 'Operario')
  const enPlanta  = operarios.filter(r => !r.hora_salida)
  const totalSist = stats.total_operarios_sistema ?? 0
  const pctOper   = totalSist > 0 ? Math.round((operarios.length / totalSist) * 100) : 0

  // ── MODO RANGO: separar resumen ───────────────────────────────────────────
  const resOper = resumen.filter(r => r.rol === 'Operario')
  const resOtro = resumen.filter(r => r.rol !== 'Operario')

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCheck size={22} className="text-emerald-400" /> Asistencia
        </h1>

        {/* Toggle modo */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1f2937' }}>
          {(['dia', 'rango'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
              style={{ background: modo === m ? '#065f46' : '#111827', color: modo === m ? '#34d399' : '#6b7280' }}>
              {m === 'dia' ? '📅 Día' : '📊 Rango'}
            </button>
          ))}
        </div>

        {/* Controles de fecha */}
        {modo === 'dia' ? (
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Desde</label>
              <input type="date" value={fInicio} max={fFin} onChange={e => setFInicio(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Hasta</label>
              <input type="date" value={fFin} min={fInicio} max={hoy} onChange={e => setFFin(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            </div>
          </div>
        )}

        <button onClick={cargar} className="text-gray-400 hover:text-white px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all">
          <RefreshCw size={14} />
        </button>
      </div>

      {!loading && (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────────────── */}
          {modo === 'dia' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl p-4" style={{ background: '#052e16', border: '1px solid #166534' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-emerald-400" />
                  <p className="text-emerald-400 text-xs font-bold uppercase">Operarios hoy</p>
                </div>
                <p className="text-3xl font-black text-emerald-300">{operarios.length}</p>
                <p className="text-xs text-emerald-700 mt-0.5">de {totalSist} registrados</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: '#0a1a0a', border: '1px solid #14532d' }}>
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck size={14} className="text-green-400" />
                  <p className="text-green-400 text-xs font-bold uppercase">En planta</p>
                </div>
                <p className="text-3xl font-black text-green-300">{enPlanta.length}</p>
                <p className="text-xs text-green-800 mt-0.5">sin salida registrada</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: '#1e1a00', border: '1px solid #854d0e' }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-amber-400" />
                  <p className="text-amber-400 text-xs font-bold uppercase">Cobertura</p>
                </div>
                <p className="text-3xl font-black text-amber-300">{pctOper}%</p>
                <p className="text-xs text-amber-800 mt-0.5">operarios con asistencia</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: '#0f172a', border: '1px solid #1e40af' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-blue-400" />
                  <p className="text-blue-400 text-xs font-bold uppercase">Otros perfiles</p>
                </div>
                <p className="text-3xl font-black text-blue-300">{otros.length}</p>
                <p className="text-xs text-blue-800 mt-0.5">no operarios</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl p-4" style={{ background: '#052e16', border: '1px solid #166534' }}>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={14} className="text-emerald-400" />
                  <p className="text-emerald-400 text-xs font-bold uppercase">Promedio/día</p>
                </div>
                <p className="text-3xl font-black text-emerald-300">{stats.promedio_operarios_dia ?? 0}</p>
                <p className="text-xs text-emerald-700 mt-0.5">operarios por día</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: '#1e1a00', border: '1px solid #854d0e' }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-amber-400" />
                  <p className="text-amber-400 text-xs font-bold uppercase">% Promedio</p>
                </div>
                <p className="text-3xl font-black text-amber-300">{stats.pct_promedio ?? 0}%</p>
                <p className="text-xs text-amber-800 mt-0.5">cobertura promedio</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: '#0f172a', border: '1px solid #1e40af' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={14} className="text-blue-400" />
                  <p className="text-blue-400 text-xs font-bold uppercase">Días con registro</p>
                </div>
                <p className="text-3xl font-black text-blue-300">{stats.dias_en_rango ?? 0}</p>
                <p className="text-xs text-blue-800 mt-0.5">en el período</p>
              </div>

              <div className="rounded-xl p-4" style={{ background: '#0f172a', border: '1px solid #374151' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-gray-400" />
                  <p className="text-gray-400 text-xs font-bold uppercase">Total operarios</p>
                </div>
                <p className="text-3xl font-black text-gray-300">{totalSist}</p>
                <p className="text-xs text-gray-600 mt-0.5">registrados en sistema</p>
              </div>
            </div>
          )}

          {/* ── MODO DÍA: tablas ─────────────────────────────────────────────── */}
          {modo === 'dia' && (
            <div className="flex flex-col gap-5">

              {/* Operarios */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                    Operarios <span className="text-emerald-700">({operarios.length}/{totalSist})</span>
                  </h2>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #166534' }}>
                  {operarios.length === 0 ? (
                    <p className="text-center text-gray-600 py-6 text-sm">Sin operarios registrados hoy</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#052e16', borderBottom: '1px solid #166534' }}>
                          {['Nombre','Cédula','Entrada','Salida','Cierre auto'].map(h => (
                            <th key={h} className="text-left text-emerald-700 px-4 py-2.5 font-bold text-xs uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {operarios.map((r, i) => {
                          const cierreAuto = sumarHoras(r.hora_ingreso, 12)
                          const horas = !r.hora_salida ? horasTranscurridas(r.hora_ingreso) : 0
                          return (
                            <tr key={r.cedula}
                              style={{ background: i % 2 === 0 ? '#0d1117' : '#0a1f0a', borderBottom: '1px solid #14532d' }}>
                              <td className="px-4 py-2.5 text-white font-medium">{r.nombre}</td>
                              <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.cedula}</td>
                              <td className="px-4 py-2.5 text-emerald-400 font-mono">{r.hora_ingreso}</td>
                              <td className="px-4 py-2.5 font-mono">
                                {r.hora_salida
                                  ? <span className="text-orange-400">{r.hora_salida}</span>
                                  : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>En planta</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {r.hora_salida ? (
                                  <span className="text-gray-700 text-xs">—</span>
                                ) : (
                                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                                    {cierreAuto}
                                    {horas > 0 && horas < 12 && <span className="ml-1 text-gray-600">({Math.floor(12-horas)}h rest.)</span>}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Otros perfiles */}
              {otros.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                      Otros perfiles <span className="text-blue-700">({otros.length})</span>
                    </h2>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e3a5f' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#0c1e33', borderBottom: '1px solid #1e3a5f' }}>
                          {['Nombre','Cédula','Rol','Entrada','Salida'].map(h => (
                            <th key={h} className="text-left text-blue-700 px-4 py-2.5 font-bold text-xs uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {otros.map((r, i) => (
                          <tr key={r.cedula}
                            style={{ background: i % 2 === 0 ? '#0d1117' : '#0a1525', borderBottom: '1px solid #1e293b' }}>
                            <td className="px-4 py-2.5 text-white font-medium">{r.nombre}</td>
                            <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.cedula}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ROL_COLOR[r.rol] ?? 'bg-gray-800 text-gray-400'}`}>
                                {r.rol}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-emerald-400 font-mono">{r.hora_ingreso}</td>
                            <td className="px-4 py-2.5 font-mono">
                              {r.hora_salida
                                ? <span className="text-orange-400">{r.hora_salida}</span>
                                : <span className="text-gray-600 text-xs">En planta</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODO RANGO ───────────────────────────────────────────────────── */}
          {modo === 'rango' && (
            <div className="flex flex-col gap-5">

              {/* Mini-gráfico asistencia por día */}
              {(stats.asistencia_por_dia?.length ?? 0) > 0 && (
                <div className="rounded-xl p-4" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Operarios con asistencia por día</p>
                  <div className="flex items-end gap-1.5 h-16 overflow-x-auto">
                    {stats.asistencia_por_dia!.map(d => {
                      const pct = totalSist > 0 ? (d.count / totalSist) : 0
                      return (
                        <div key={d.fecha} className="flex flex-col items-center gap-1 flex-shrink-0" title={`${fmtFecha(d.fecha)}: ${d.count} operarios`}>
                          <span className="text-xs text-gray-500 font-mono">{d.count}</span>
                          <div className="w-7 rounded-t-sm" style={{ height: `${Math.max(4, pct * 48)}px`, background: pct >= 0.8 ? '#22c55e' : pct >= 0.6 ? '#eab308' : '#ef4444' }} />
                          <span className="text-xs text-gray-600" style={{ fontSize: '0.55rem' }}>{d.fecha.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tabla operarios — rango */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                    Operarios <span className="text-emerald-700">({resOper.length})</span>
                  </h2>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #166534' }}>
                  {resOper.length === 0 ? (
                    <p className="text-center text-gray-600 py-6 text-sm">Sin registros en el período</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#052e16', borderBottom: '1px solid #166534' }}>
                          <th className="text-left text-emerald-700 px-4 py-2.5 font-bold text-xs uppercase">Nombre</th>
                          <th className="text-left text-emerald-700 px-4 py-2.5 font-bold text-xs uppercase">Cédula</th>
                          <th className="text-center text-emerald-700 px-4 py-2.5 font-bold text-xs uppercase">Días asistidos</th>
                          <th className="text-center text-emerald-700 px-4 py-2.5 font-bold text-xs uppercase">% Asistencia</th>
                          <th className="text-center text-emerald-700 px-4 py-2.5 font-bold text-xs uppercase">Días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resOper.sort((a, b) => b.dias - a.dias).map((r, i) => {
                          const pct = (stats.dias_en_rango ?? 1) > 0 ? Math.round((r.dias / (stats.dias_en_rango ?? 1)) * 100) : 0
                          return (
                            <tr key={r.cedula}
                              style={{ background: i % 2 === 0 ? '#0d1117' : '#0a1f0a', borderBottom: '1px solid #14532d' }}>
                              <td className="px-4 py-2.5 text-white font-medium">{r.nombre}</td>
                              <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.cedula}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="text-lg font-black" style={{ color: pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171' }}>
                                  {r.dias}
                                </span>
                                <span className="text-gray-600 text-xs"> / {stats.dias_en_rango}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? '#4ade80' : pct >= 60 ? '#eab308' : '#ef4444' }} />
                                  </div>
                                  <span className="text-xs font-bold" style={{ color: pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171' }}>{pct}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex flex-wrap gap-0.5 justify-center">
                                  {r.dias_lista.map(d => (
                                    <span key={d} className="text-xs px-1 rounded font-mono"
                                      style={{ background: '#052e16', color: '#4ade80', fontSize: '0.6rem' }}>
                                      {d.slice(8)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Otros perfiles — rango */}
              {resOtro.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                      Otros perfiles <span className="text-blue-700">({resOtro.length})</span>
                    </h2>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e3a5f' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#0c1e33', borderBottom: '1px solid #1e3a5f' }}>
                          <th className="text-left text-blue-700 px-4 py-2.5 font-bold text-xs uppercase">Nombre</th>
                          <th className="text-left text-blue-700 px-4 py-2.5 font-bold text-xs uppercase">Rol</th>
                          <th className="text-center text-blue-700 px-4 py-2.5 font-bold text-xs uppercase">Días asistidos</th>
                          <th className="text-center text-blue-700 px-4 py-2.5 font-bold text-xs uppercase">% Asistencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resOtro.sort((a, b) => b.dias - a.dias).map((r, i) => {
                          const pct = (stats.dias_en_rango ?? 1) > 0 ? Math.round((r.dias / (stats.dias_en_rango ?? 1)) * 100) : 0
                          return (
                            <tr key={r.cedula}
                              style={{ background: i % 2 === 0 ? '#0d1117' : '#0a1525', borderBottom: '1px solid #1e293b' }}>
                              <td className="px-4 py-2.5 text-white font-medium">{r.nombre}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ROL_COLOR[r.rol] ?? 'bg-gray-800 text-gray-400'}`}>{r.rol}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="text-lg font-black text-blue-300">{r.dias}</span>
                                <span className="text-gray-600 text-xs"> / {stats.dias_en_rango}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="text-sm font-bold text-blue-400">{pct}%</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {loading && <p className="text-center text-gray-500 py-12 text-sm">Cargando...</p>}
    </div>
  )
}
