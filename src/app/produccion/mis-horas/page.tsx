'use client'

import { useState } from 'react'
import { Clock, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, LogOut, Search, Moon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import LeafBackground from '@/components/LeafBackground'

type RegistroDia = {
  fecha: string
  turno: 'T1' | 'T2' | null
  hora_ingreso: string | null
  hora_salida: string | null
  salida_norm: string | null
  salida_efectiva: string | null
  minutos_extra: number
  horas_extra: number
  horas_recargo: number
  aprobado: boolean
  rechazado: boolean
  aprobado_por_nombre: string | null
  es_jornada_adicional?: boolean
}

type Totales = {
  minutos_extra: number
  horas_extra: number
  horas_recargo: number
  dias_aprobados: number
}

type Empleado = { cedula: string; nombre: string; rol: string }

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${d} ${MESES_ES[parseInt(m) - 1]} ${y}`
}

export default function MisHorasPage() {
  const router = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  // Default: primer día del mes actual hasta hoy
  const primerDiaMes = hoy.slice(0, 7) + '-01'

  const [cedula,      setCedula]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [empleado,    setEmpleado]    = useState<Empleado | null>(null)
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes)
  const [fechaFin,    setFechaFin]    = useState(hoy)
  const [registros,   setRegistros]   = useState<RegistroDia[]>([])
  const [totales,     setTotales]     = useState<Totales | null>(null)
  const [buscando,    setBuscando]    = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/horas-extra/personal?cedula=${cedula.trim()}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error'); return }
      setEmpleado(data.empleado)
      // Solo aprobados
      setRegistros((data.registros as RegistroDia[]).filter(r => r.aprobado || r.horas_recargo > 0))
      setTotales(data.totales)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (!empleado) return
    setBuscando(true)
    const res  = await fetch(`/api/horas-extra/personal?cedula=${empleado.cedula}&fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`)
    const data = await res.json()
    if (res.ok) {
      setRegistros((data.registros as RegistroDia[]).filter(r => r.aprobado || r.horas_recargo > 0))
      setTotales(data.totales)
    }
    setBuscando(false)
  }

  /* ── Login ── */
  if (!empleado) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center p-6 gap-6"
        style={{ background: '#d4e8b8' }}>
        <LeafBackground />

        <div className="relative z-10 text-center mb-2">
          <div className="flex items-center justify-center mb-3">
            <div className="p-3 rounded-full" style={{ background: 'rgba(30,58,20,0.2)', border: '1px solid rgba(60,120,30,0.4)' }}>
              <Clock size={40} strokeWidth={1.5} style={{ color: '#1e5c14' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-wide" style={{ color: '#1a3a10' }}>Mis Horas Extra</h1>
          <p className="text-sm mt-1" style={{ color: '#4a6a35' }}>Consulta tu reporte personal de horas aprobadas</p>
        </div>

        <div className="relative z-10 w-full max-w-sm rounded-2xl p-6"
          style={{ background: '#1e3a14', border: '1px solid #3a6228', boxShadow: '0 8px 32px rgba(20,60,10,0.35)' }}>
          <form onSubmit={login} className="flex flex-col gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-2">Número de cédula</label>
              <input
                type="text" inputMode="numeric" required autoFocus
                placeholder="Ingresa tu cédula"
                value={cedula} onChange={e => { setCedula(e.target.value); setError('') }}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:border-yellow-500"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <AlertTriangle size={14} /> {error}
              </p>
            )}
            <button type="submit" disabled={loading || !cedula.trim()}
              className="w-full text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#b45309,#d97706)', border: '1px solid #f59e0b' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
              {loading ? 'Buscando...' : 'Ver mis horas extra'}
            </button>
          </form>
        </div>

        <button onClick={() => router.push('/produccion')}
          className="relative z-10 flex items-center gap-1.5 text-sm hover:underline mt-2"
          style={{ color: '#3a5a28' }}>
          <ArrowLeft size={14} /> Volver
        </button>
      </main>
    )
  }

  const aprobados = registros // ya filtrados
  const totalMinutos = totales?.minutos_extra ?? 0
  const totalHoras   = totales?.horas_extra   ?? 0
  const totalRecargo = totales?.horas_recargo ?? 0

  /* ── Reporte ── */
  return (
    <main className="min-h-screen" style={{ background: '#0d1117' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: '#111827', borderBottom: '1px solid #1f2937' }}>
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">{empleado.nombre}</p>
            <p className="text-gray-500 text-xs font-mono">{empleado.cedula}</p>
          </div>
        </div>
        <button onClick={() => { setEmpleado(null); setCedula(''); setRegistros([]); setTotales(null) }}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          <LogOut size={13} /> Salir
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-10">

        {/* Filtro de rango de fechas */}
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-3 mb-5 mt-3 p-4 rounded-xl"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Desde</label>
            <input type="date" value={fechaInicio} max={fechaFin}
              onChange={e => setFechaInicio(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Hasta</label>
            <input type="date" value={fechaFin} min={fechaInicio} max={hoy}
              onChange={e => setFechaFin(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>
          <button type="submit" disabled={buscando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#b45309,#d97706)', border: '1px solid #f59e0b' }}>
            {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </form>

        {/* Totales aprobados */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl p-4 text-center" style={{ background: '#1a1200', border: '1px solid #2a2000' }}>
            <p className="text-gray-500 text-xs mb-1">Minutos extra</p>
            <p className="text-3xl font-bold" style={{ color: '#fdba74' }}>{totalMinutos}</p>
            <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>minutos aprobados</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: '#1a1200', border: '1px solid #2a2000' }}>
            <p className="text-gray-500 text-xs mb-1">Horas extra</p>
            <p className="text-3xl font-bold" style={{ color: '#fbbf24' }}>{totalHoras.toFixed(2)}</p>
            <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>horas aprobadas</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: totalRecargo > 0 ? '#1a0505' : '#111827', border: `1px solid ${totalRecargo > 0 ? '#3a0a0a' : '#1f2937'}` }}>
            <p className="text-gray-500 text-xs mb-1">Recargo noct.</p>
            <p className="text-3xl font-bold" style={{ color: totalRecargo > 0 ? '#fca5a5' : '#475569' }}>{totalRecargo.toFixed(2)}</p>
            <p className="text-xs mt-0.5" style={{ color: totalRecargo > 0 ? '#7f1d1d' : '#374151' }}>horas calculadas</p>
          </div>
        </div>

        {/* Tabla */}
        {buscando ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-yellow-400" />
          </div>
        ) : aprobados.length === 0 ? (
          <div className="text-center py-16 rounded-xl" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Clock size={40} strokeWidth={1} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 text-sm">No hay registros en el rango seleccionado</p>
            <p className="text-gray-700 text-xs mt-1">horas extra aprobadas ni recargos nocturnos</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-auto" style={{ border: '1px solid #1e293b', background: '#0d1117' }}>
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                  {['FECHA','TURNO','ENTRADA','SALIDA REAL','S. NORM','S. EFECTIVA','MIN EXTRA','HRS EXTRA','RECARGO NOCT.'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aprobados.map((r, i) => {
                  const soloRecargo = !r.aprobado && r.horas_recargo > 0
                  return (
                  <tr key={r.fecha}
                    style={{
                      background: soloRecargo
                        ? (i % 2 === 0 ? '#150a1e' : '#12081a')
                        : (i % 2 === 0 ? '#0a1f10' : '#091a0e'),
                      borderBottom: `1px solid ${soloRecargo ? '#3b0764' : '#14532d'}`
                    }}>

                    {/* FECHA */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {soloRecargo
                          ? <Moon size={12} style={{ color: '#a78bfa' }} />
                          : <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                        }
                        <span className="text-white text-xs font-medium">{fmtFecha(r.fecha)}</span>
                        {soloRecargo && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-semibold ml-1"
                            style={{ background: '#2e1065', color: '#c4b5fd', fontSize: '0.6rem' }}>
                            recargo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* TURNO */}
                    <td className="px-4 py-3">
                      {r.es_jornada_adicional ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(146,64,14,0.3)', color: '#fdba74' }}>
                          +Día
                        </span>
                      ) : r.turno ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.turno === 'T1' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                          {r.turno}
                        </span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>

                    {/* ENTRADA */}
                    <td className="px-4 py-3 font-mono text-slate-300 text-xs">{r.hora_ingreso ?? '—'}</td>

                    {/* SALIDA REAL */}
                    <td className="px-4 py-3 font-mono text-slate-300 text-xs">{r.hora_salida ?? '—'}</td>

                    {/* S. NORM */}
                    <td className="px-4 py-3 font-mono text-sky-400 text-xs font-semibold">{r.salida_norm ?? '—'}</td>

                    {/* S. EFECTIVA */}
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#f97316' }}>
                      {r.salida_efectiva ?? '—'}
                    </td>

                    {/* MIN EXTRA */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                        style={{ background: '#451a03', color: '#fdba74' }}>
                        {r.minutos_extra} min
                      </span>
                    </td>

                    {/* HRS EXTRA */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                        style={{ background: '#451a03', color: '#fed7aa' }}>
                        {r.horas_extra.toFixed(2)} h
                      </span>
                    </td>

                    {/* RECARGO NOCT */}
                    <td className="px-4 py-3">
                      {r.horas_recargo > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                          style={{ background: '#450a0a', color: '#fca5a5' }}>
                          {r.horas_recargo.toFixed(2)} h
                        </span>
                      ) : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                  </tr>
                  )
                })}
              </tbody>

              {/* Fila de totales */}
              <tfoot>
                <tr style={{ background: '#020617', borderTop: '2px solid #1e293b' }}>
                  <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Total ({aprobados.length} día{aprobados.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                      style={{ background: '#451a03', color: '#fdba74' }}>
                      {totalMinutos} min
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                      style={{ background: '#451a03', color: '#fed7aa' }}>
                      {totalHoras.toFixed(2)} h
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {totalRecargo > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                        style={{ background: '#450a0a', color: '#fca5a5' }}>
                        {totalRecargo.toFixed(2)} h
                      </span>
                    ) : <span className="text-gray-700 text-xs">—</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="text-center text-gray-700 text-xs mt-4">
          ✓ Horas extra aprobadas &nbsp;·&nbsp; <span style={{ color: '#6d28d9' }}>◐</span> Recargo nocturno
        </p>
      </div>
    </main>
  )
}
