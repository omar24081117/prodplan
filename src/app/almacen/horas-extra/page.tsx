'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart2, FileBarChart2, Loader2, Clock, Warehouse, ChevronLeft, ChevronRight, UserX, Check, Settings, X, AlertTriangle, CheckCircle2 } from 'lucide-react'

const TIPOS_AUSENTISMO = [
  'Descanso', 'Sin Justa Causa', 'Permiso Remunerado', 'Permiso No Remunerado',
  'Calamidad', 'Incapacidad', 'Día de la Familia', 'Vacaciones',
  'Licencia de Maternidad', 'Licencia de Paternidad',
] as const
type TipoAusentismo = typeof TIPOS_AUSENTISMO[number]

type Almacenista = { cedula: string; nombre: string; rol: string; activo: boolean }
type Override = {
  hora_ingreso: string; salida_efectiva: string
  horas_extra_manual?: number; horas_nocturnas_manual?: number
  recargo_nocturno_manual?: number; recargo_diurno_manual?: number
  minutos_alimentacion?: number
}
type Registro = {
  cedula: string; nombre: string; rol: string | null
  hora_ingreso: string | null; hora_salida: string | null
  turno: 'T1' | 'T2' | null; entrada_norm: string | null
  salida_norm: string | null; salida_efectiva: string | null
  minutos_extra: number; horas_extra: number; horas_recargo: number
  dia_libre: boolean; aprobado: boolean; aprobado_por_nombre: string | null
  rechazado: boolean; rechazado_por_nombre: string | null
}
type Ausentismo = { cedula: string; nombre: string; tipo: TipoAusentismo }

const SESSION_KEY = 'almacen_usuario'

function calcConOverride(r: Registro, ov: Override) {
  const tieneManualDiurno   = ov.horas_extra_manual != null
  const tieneManualNocturno = (ov.horas_nocturnas_manual ?? 0) > 0
  if (tieneManualDiurno || tieneManualNocturno) {
    return { minutos_extra: Math.round((ov.horas_extra_manual ?? 0) * 60), horas_extra: ov.horas_extra_manual ?? 0, horas_recargo: ov.recargo_nocturno_manual ?? 0 }
  }
  if (!r.salida_norm) return { minutos_extra: 0, horas_extra: 0, horas_recargo: 0 }
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const normMins = toMins(r.salida_norm)
  const efMins   = toMins(ov.salida_efectiva)
  if (efMins < 0) return { minutos_extra: 0, horas_extra: 0, horas_recargo: 0 }
  const alimMins = ov.minutos_alimentacion ?? 0
  const minExtra = Math.max(0, efMins - normMins - alimMins)
  const hExtra   = Math.round((minExtra / 60) * 100) / 100
  const hRecargo = efMins >= 22 * 60 + 30 ? Math.round((Math.max(0, efMins - 19 * 60) / 60) * 100) / 100 : 0
  return { minutos_extra: minExtra, horas_extra: hExtra, horas_recargo: hRecargo }
}

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

function TurnoManualModal({
  registro, overrideActual, onClose, onGuardar,
}: {
  registro: Registro
  overrideActual?: Override
  onClose: () => void
  onGuardar: (cedula: string, ov: Override) => void
}) {
  const tieneManual = ((overrideActual?.horas_extra_manual ?? 0) > 0) || ((overrideActual?.horas_nocturnas_manual ?? 0) > 0)
  const [modo,            setModo]            = useState<'horario' | 'adicional'>(tieneManual ? 'adicional' : 'horario')
  const [horaIngreso,     setHoraIngreso]     = useState(overrideActual?.hora_ingreso    ?? registro.hora_ingreso    ?? '')
  const [salidaEfec,      setSalidaEfec]      = useState(overrideActual?.salida_efectiva ?? registro.salida_efectiva ?? registro.hora_salida ?? '')
  const [hsExtManual,     setHsExtManual]     = useState(overrideActual?.horas_extra_manual?.toString()     ?? '')
  const [hsNocManual,     setHsNocManual]     = useState(overrideActual?.horas_nocturnas_manual?.toString() ?? '')
  const [hsRecNocManual,  setHsRecNocManual]  = useState(overrideActual?.recargo_nocturno_manual?.toString() ?? '')
  const [hsRecDiurManual, setHsRecDiurManual] = useState(overrideActual?.recargo_diurno_manual?.toString() ?? '')
  const [minAlim,         setMinAlim]         = useState(overrideActual?.minutos_alimentacion?.toString() ?? '')

  const previewHorario = modo === 'horario' && salidaEfec && (registro.salida_norm || registro.dia_libre)
    ? calcConOverride(registro, { hora_ingreso: horaIngreso, salida_efectiva: salidaEfec, minutos_alimentacion: parseInt(minAlim) || 0 })
    : null
  const previewManual = modo === 'adicional' && (hsExtManual || hsNocManual)
    ? {
        horas_extra:    parseFloat(hsExtManual)    || 0,
        minutos_extra:  Math.round((parseFloat(hsExtManual) || 0) * 60),
        horas_nocturnas: parseFloat(hsNocManual)   || 0,
        horas_recargo:  parseFloat(hsRecNocManual) || 0,
        recargo_diurno: parseFloat(hsRecDiurManual) || 0,
      }
    : null
  const preview = previewHorario ?? previewManual

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    const alim = parseInt(minAlim) || undefined
    if (modo === 'adicional') {
      onGuardar(registro.cedula, {
        hora_ingreso: horaIngreso || registro.hora_ingreso || '',
        salida_efectiva: '',
        horas_extra_manual:      parseFloat(hsExtManual)     || 0,
        horas_nocturnas_manual:  parseFloat(hsNocManual)     || undefined,
        recargo_nocturno_manual: parseFloat(hsRecNocManual)  || undefined,
        recargo_diurno_manual:   parseFloat(hsRecDiurManual) || undefined,
        minutos_alimentacion:    alim,
      })
    } else {
      onGuardar(registro.cedula, { hora_ingreso: horaIngreso, salida_efectiva: salidaEfec, minutos_alimentacion: alim })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: '#111827', border: '1px solid #374151' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Settings size={16} className="text-purple-400" /> Configurar horario
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>

        {(registro.aprobado || registro.rechazado) && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
            style={{ background: 'rgba(180,120,0,0.18)', border: '1px solid #92400e', color: '#fbbf24' }}>
            <AlertTriangle size={13} />
            {registro.aprobado
              ? 'Este empleado ya está aprobado. Al guardar, la aprobación se borrará y quedará Pendiente.'
              : 'Este empleado está rechazado. Al guardar, el rechazo se borrará y quedará Pendiente.'}
          </div>
        )}

        <div className="mb-4 p-3 rounded-lg" style={{ background: '#1f2937', border: '1px solid #374151' }}>
          <p className="text-white font-semibold text-sm">{registro.nombre}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs font-mono">
            <span className="text-gray-500">Entrada: <span className="text-sky-300">{registro.hora_ingreso ?? '—'}</span></span>
            <span className="text-gray-500">Salida: <span className="text-orange-300">{registro.hora_salida ?? '—'}</span></span>
            {registro.salida_norm && <span className="text-gray-500">S. norm: <span className="text-green-400">{registro.salida_norm}</span></span>}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { val: 'horario',   label: 'Corregir horario',    color: '#1d4ed8' },
            { val: 'adicional', label: '+ Jornada adicional', color: '#7e22ce' },
          ].map(m => (
            <button key={m.val} type="button"
              onClick={() => setModo(m.val as 'horario' | 'adicional')}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: modo === m.val ? m.color : '#1f2937',
                border: `1px solid ${modo === m.val ? m.color : '#374151'}`,
                color: modo === m.val ? 'white' : '#6b7280'
              }}>
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-3">
          {modo === 'horario' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Hora ingreso <span className="text-sky-400">(corregir)</span></label>
                <input type="time" required value={horaIngreso}
                  onChange={e => setHoraIngreso(e.target.value)}
                  className="w-full bg-gray-800 border border-sky-800 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-sky-400" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Salida efectiva <span className="text-orange-400">(cálculo)</span></label>
                <input type="time" required value={salidaEfec}
                  onChange={e => setSalidaEfec(e.target.value)}
                  className="w-full bg-gray-800 border border-orange-800 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-400" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Horas extra <span className="text-amber-400">diurnas</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.25" min="0" max="24" placeholder="0" value={hsExtManual}
                    onChange={e => setHsExtManual(e.target.value)}
                    className="flex-1 bg-gray-800 border border-amber-700 text-white rounded-lg px-3 py-2 text-base font-mono font-bold focus:outline-none focus:border-amber-400 text-center" />
                  <span className="text-gray-400 text-sm font-semibold">h</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Horas extra <span className="text-violet-400">nocturnas</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.25" min="0" max="24" placeholder="0" value={hsNocManual}
                    onChange={e => setHsNocManual(e.target.value)}
                    className="flex-1 bg-gray-800 border border-violet-700 text-white rounded-lg px-3 py-2 text-base font-mono font-bold focus:outline-none focus:border-violet-400 text-center" />
                  <span className="text-gray-400 text-sm font-semibold">h</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Recargo nocturno <span className="text-red-400">manual</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.25" min="0" max="24" placeholder="0" value={hsRecNocManual}
                    onChange={e => setHsRecNocManual(e.target.value)}
                    className="flex-1 bg-gray-800 border border-red-800 text-white rounded-lg px-3 py-2 text-base font-mono font-bold focus:outline-none focus:border-red-500 text-center" />
                  <span className="text-gray-400 text-sm font-semibold">h</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Recargo <span className="text-yellow-400">diurno</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.25" min="0" max="24" placeholder="0" value={hsRecDiurManual}
                    onChange={e => setHsRecDiurManual(e.target.value)}
                    className="flex-1 bg-gray-800 border border-yellow-700 text-white rounded-lg px-3 py-2 text-base font-mono font-bold focus:outline-none focus:border-yellow-400 text-center" />
                  <span className="text-gray-400 text-sm font-semibold">h</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Alimentación <span className="text-emerald-400">(min a descontar)</span>
              <span className="text-gray-600 ml-1">— opcional</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="120" step="5" placeholder="0" value={minAlim}
                onChange={e => setMinAlim(e.target.value)}
                className="w-24 bg-gray-800 border border-emerald-800 text-white rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-emerald-400 text-center" />
              <span className="text-gray-400 text-sm">min</span>
            </div>
          </div>

          {preview && (
            <div className="rounded-lg p-3 text-xs" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <p className="text-gray-400 mb-1.5 font-semibold uppercase tracking-wide text-xs">Vista previa</p>
              <div className="flex gap-4 flex-wrap">
                <div>
                  <p className="text-gray-500">Min extra</p>
                  <p className="font-bold" style={{ color: preview.minutos_extra > 0 ? '#fdba74' : '#475569' }}>{preview.minutos_extra} min</p>
                </div>
                <div>
                  <p className="text-gray-500">Hrs diurnas</p>
                  <p className="font-bold" style={{ color: preview.horas_extra > 0 ? '#fdba74' : '#475569' }}>{preview.horas_extra.toFixed(2)} h</p>
                </div>
                {'horas_nocturnas' in preview && (
                  <div>
                    <p className="text-gray-500">Hrs nocturnas</p>
                    <p className="font-bold" style={{ color: (preview as {horas_nocturnas:number}).horas_nocturnas > 0 ? '#c4b5fd' : '#475569' }}>
                      {(preview as {horas_nocturnas:number}).horas_nocturnas.toFixed(2)} h
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Recargo noct.</p>
                  <p className="font-bold" style={{ color: preview.horas_recargo > 0 ? '#fca5a5' : '#475569' }}>{preview.horas_recargo.toFixed(2)} h</p>
                </div>
                {'recargo_diurno' in preview && (
                  <div>
                    <p className="text-gray-500">Recargo diurno</p>
                    <p className="font-bold" style={{ color: (preview as {recargo_diurno:number}).recargo_diurno > 0 ? '#fde68a' : '#475569' }}>
                      {(preview as {recargo_diurno:number}).recargo_diurno.toFixed(2)} h
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              style={{ background: '#1f2937', border: '1px solid #374151' }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-all hover:brightness-110"
              style={{
                background: modo === 'adicional' ? 'linear-gradient(135deg,#581c87,#7e22ce)' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                border: `1px solid ${modo === 'adicional' ? '#a855f7' : '#3b82f6'}`
              }}>
              <CheckCircle2 size={14} /> Aplicar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AlmacenHorasExtraPage() {
  const router = useRouter()
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const [fecha, setFecha]               = useState(hoy)
  const [almacenistas, setAlmacenistas] = useState<Almacenista[]>([])
  const [registros, setRegistros]       = useState<Registro[]>([])
  const [overrides, setOverrides]       = useState<Record<string, Override>>({})
  const [ausentismos, setAusentismos]   = useState<Record<string, Ausentismo>>({})
  const [loading, setLoading]           = useState(true)
  const [authChecked, setAuthChecked]   = useState(false)
  const [guardando, setGuardando]       = useState<string | null>(null)
  const [selAus, setSelAus]             = useState<Record<string, TipoAusentismo | ''>>({})
  const [modalTurno, setModalTurno]     = useState<Registro | null>(null)

  // Auth
  useEffect(() => {
    try {
      const s = localStorage.getItem(SESSION_KEY)
      if (!s) { router.replace('/almacen'); return }
    } catch { router.replace('/almacen'); return }
    setAuthChecked(true)
  }, [router])

  // Cargar lista de almacenistas activos (solo una vez)
  useEffect(() => {
    if (!authChecked) return
    fetch('/api/personal')
      .then(r => r.json())
      .then((data: Almacenista[]) => {
        const arr = Array.isArray(data) ? data : []
        setAlmacenistas(arr.filter(p => p.rol === 'Almacenista' && p.activo !== false))
      })
      .catch(() => {})
  }, [authChecked])

  const cargar = useCallback(async (f: string) => {
    setLoading(true)
    const [resReg, resOv, resAus] = await Promise.all([
      fetch(`/api/horas-extra?fecha=${f}`),
      fetch(`/api/horas-extra/override?fecha=${f}`),
      fetch(`/api/ausentismos?fecha=${f}`),
    ])
    const dataReg = await resReg.json()
    const dataOv  = resOv.ok  ? await resOv.json()  : []
    const dataAus = resAus.ok ? await resAus.json() : []

    setRegistros(dataReg.registros ?? [])

    const ovMap: Record<string, Override> = {}
    for (const ov of dataOv) {
      if (ov.hora_ingreso || ov.salida_efectiva || ov.horas_extra_manual != null || ov.horas_nocturnas_manual) {
        ovMap[ov.cedula] = {
          hora_ingreso: ov.hora_ingreso ?? '', salida_efectiva: ov.salida_efectiva ?? '',
          horas_extra_manual: ov.horas_extra_manual ?? undefined,
          horas_nocturnas_manual: ov.horas_nocturnas_manual ?? undefined,
          recargo_nocturno_manual: ov.recargo_nocturno_manual ?? undefined,
          recargo_diurno_manual: ov.recargo_diurno_manual ?? undefined,
        }
      }
    }
    setOverrides(ovMap)

    const ausMap: Record<string, Ausentismo> = {}
    for (const a of (dataAus as Ausentismo[])) ausMap[a.cedula] = a
    setAusentismos(ausMap)
    setSelAus({})
    setLoading(false)
  }, [])

  useEffect(() => { if (authChecked && almacenistas.length >= 0) cargar(fecha) }, [fecha, cargar, authChecked, almacenistas.length])

  const registroMap = new Map<string, Registro>()
  for (const r of registros) registroMap.set(r.cedula, r)

  const filas = almacenistas.map(a => {
    const r = registroMap.get(String(a.cedula))
    if (!r) return { almacenista: a, registro: null }
    const ov = overrides[r.cedula]
    const rEf = ov ? { ...r, hora_ingreso: ov.hora_ingreso, salida_efectiva: ov.salida_efectiva, ...calcConOverride(r, ov) } : r
    return { almacenista: a, registro: rEf }
  })

  const conAsistencia = filas.filter(f => f.registro)
  const conExtra      = conAsistencia.filter(f => f.registro!.horas_extra > 0 || (overrides[f.registro!.cedula]?.horas_nocturnas_manual ?? 0) > 0)
  const aprobados     = conAsistencia.filter(f => f.registro!.aprobado)
  const fmtH = (n: number) => n > 0 ? n.toFixed(2) : '—'

  async function handleGuardarOverride(cedula: string, ov: Override) {
    const res = await fetch('/api/horas-extra/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cedula,
        fecha,
        hora_ingreso:            ov.hora_ingreso            || null,
        salida_efectiva:         ov.salida_efectiva         || null,
        horas_extra_manual:      ov.horas_extra_manual      ?? null,
        horas_nocturnas_manual:  ov.horas_nocturnas_manual  ?? null,
        recargo_nocturno_manual: ov.recargo_nocturno_manual ?? null,
        recargo_diurno_manual:   ov.recargo_diurno_manual   ?? null,
        minutos_alimentacion:    ov.minutos_alimentacion    ?? null,
      }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert('Error al guardar: ' + (e.error ?? 'error desconocido'))
      return
    }
    setOverrides(prev => ({ ...prev, [cedula]: ov }))
    await cargar(fecha)
  }

  async function guardarAusentismo(cedula: string, nombre: string, tipo: string) {
    if (!tipo) return
    setGuardando(cedula)
    try {
      const res = await fetch('/api/ausentismos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, nombre, fecha, tipo }),
      })
      if (res.ok) {
        const saved = await res.json()
        setAusentismos(prev => ({ ...prev, [cedula]: saved }))
        setSelAus(prev => { const n = { ...prev }; delete n[cedula]; return n })
      } else {
        const e = await res.json().catch(() => ({}))
        alert('Error al guardar ausentismo: ' + (e.error ?? `HTTP ${res.status}`))
      }
    } catch (err) {
      alert('Error de red: ' + String(err))
    } finally { setGuardando(null) }
  }

  async function quitarAusentismo(cedula: string) {
    setGuardando(cedula)
    try {
      await fetch(`/api/ausentismos?cedula=${cedula}&fecha=${fecha}`, { method: 'DELETE' })
      setAusentismos(prev => { const n = { ...prev }; delete n[cedula]; return n })
    } finally { setGuardando(null) }
  }

  if (!authChecked) return null

  return (
    <main className="min-h-screen relative" style={{ background: '#070b14' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(168,85,247,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.02) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between flex-wrap gap-3"
        style={{ borderBottom: '1px solid #0f1e2e', background: 'rgba(7,11,20,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/almacen')} className="p-2 rounded-lg transition-all hover:opacity-70"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <Warehouse size={18} style={{ color: '#a855f7' }} />
          </button>
          <div>
            <h1 className="text-white font-black text-sm tracking-wide flex items-center gap-2">
              <Clock size={15} style={{ color: '#a855f7' }} /> Horas Extra — Almacén
            </h1>
            <p className="text-xs" style={{ color: '#475569' }}>Personal almacenista · ausentismos editables</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/almacen/horas-extra/informe')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#0c4a6e,#0369a1)', border: '1px solid #38bdf8' }}>
            <BarChart2 size={14} /> Informe
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setFecha(f => addDays(f, -1))}
              className="p-2 rounded-lg transition-all hover:brightness-125"
              style={{ background: '#0d1525', border: '1px solid #1a2640', color: '#94a3b8' }}>
              <ChevronLeft size={16} />
            </button>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: '#0d1525', border: '1px solid #1a2640', color: '#f1f5f9' }} />
            <button onClick={() => setFecha(f => addDays(f, 1))}
              className="p-2 rounded-lg transition-all hover:brightness-125"
              style={{ background: '#0d1525', border: '1px solid #1a2640', color: '#94a3b8' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total almacenistas', value: almacenistas.length, color: '#94a3b8', bg: '#0f172a', border: '#1e293b' },
            { label: 'Con horas extra',    value: conExtra.length,     color: '#a855f7', bg: '#150a25', border: '#3b1a6e' },
            { label: 'Aprobados',          value: `${aprobados.length}/${conExtra.length}`, color: '#4ade80', bg: '#052e16', border: '#166534' },
            { label: 'Ausentes',           value: filas.filter(f => !f.registro).length, color: '#f87171', bg: '#1a0505', border: '#7f1d1d' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: k.bg, border: `1px solid ${k.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: k.color }}>{k.label}</p>
              <p className="text-3xl font-black" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin" style={{ color: '#a855f7' }} />
          </div>
        ) : filas.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#334155' }}>
            <FileBarChart2 size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Sin almacenistas configurados</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a2640' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0d1525', borderBottom: '2px solid #1a2640' }}>
                    {['Nombre','Cédula','TRN','ENT.','E.N.','SAL.','S.N.','S.EFEC.','HRS+','HRS NOC.','REC.D.','Estado / Ausentismo','Acción'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ almacenista: a, registro: r }, i) => {
                    const rowBg = i % 2 === 0 ? '#070b14' : '#0d1525'
                    const aus = ausentismos[String(a.cedula)]

                    if (!r) {
                      // Sin asistencia — fila de ausente
                      return (
                        <tr key={a.cedula} style={{ background: rowBg, borderBottom: '1px solid #0f1e2e' }}>
                          <td className="px-3 py-2.5 text-white font-semibold whitespace-nowrap">{a.nombre}</td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: '#64748b' }}>{a.cedula}</td>
                          <td colSpan={8} className="px-3 py-2.5">
                            <div className="flex items-center gap-1" style={{ color: '#f87171' }}>
                              <UserX size={13} /> <span className="text-xs font-semibold">Sin asistencia</span>
                            </div>
                          </td>
                          <td colSpan={1} />
                          <td className="px-3 py-2.5">
                            {aus ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-xs font-bold"
                                  style={{ background: '#1c1400', color: '#fbbf24' }}>{aus.tipo}</span>
                                <button onClick={() => quitarAusentismo(String(a.cedula))}
                                  disabled={guardando === String(a.cedula)}
                                  className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
                                  style={{ background: '#2a0a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                                  {guardando === String(a.cedula) ? '...' : '✕'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {guardando === String(a.cedula) ? (
                                  <span className="flex items-center gap-1 text-xs" style={{ color: '#64748b' }}>
                                    <Loader2 size={12} className="animate-spin" /> Guardando...
                                  </span>
                                ) : (
                                  <select
                                    value=""
                                    onChange={e => {
                                      const tipo = e.target.value
                                      if (tipo) guardarAusentismo(String(a.cedula), a.nombre, tipo)
                                    }}
                                    className="rounded text-xs px-2 py-1 focus:outline-none"
                                    style={{ background: '#0d1525', border: '1px solid #1a2640', color: '#94a3b8', minWidth: 170 }}>
                                    <option value="">— Marcar ausentismo —</option>
                                    {TIPOS_AUSENTISMO.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => setModalTurno({
                                cedula: String(a.cedula), nombre: a.nombre, rol: a.rol,
                                hora_ingreso: null, hora_salida: null, turno: null,
                                entrada_norm: null, salida_norm: null, salida_efectiva: null,
                                minutos_extra: 0, horas_extra: 0, horas_recargo: 0,
                                dia_libre: false, aprobado: false, aprobado_por_nombre: null,
                                rechazado: false, rechazado_por_nombre: null,
                              })}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                              style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
                              <Settings size={11} /> Config
                            </button>
                          </td>
                        </tr>
                      )
                    }

                    // Con asistencia
                    const ov = overrides[r.cedula]
                    const heNoc  = ov?.horas_nocturnas_manual  ?? 0
                    const recNoc = ov?.recargo_nocturno_manual ?? 0
                    const recDiu = ov?.recargo_diurno_manual   ?? 0
                    const tieneExtra = r.horas_extra > 0 || heNoc > 0
                    let estadoLabel = 'Sin extra'; let estadoColor = '#334155'
                    if (tieneExtra) {
                      if (r.rechazado)    { estadoLabel = 'Rechazado'; estadoColor = '#f87171' }
                      else if (r.aprobado){ estadoLabel = 'Aprobado';  estadoColor = '#4ade80' }
                      else                { estadoLabel = 'Pendiente'; estadoColor = '#fbbf24' }
                    }

                    return (
                      <tr key={r.cedula} style={{ background: rowBg, borderBottom: '1px solid #0f1e2e' }}>
                        <td className="px-3 py-2.5 text-white font-semibold whitespace-nowrap">{r.nombre}</td>
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: '#64748b' }}>{r.cedula}</td>
                        <td className="px-3 py-2.5">
                          {r.turno && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                              style={{ background: r.turno === 'T1' ? '#052e16' : '#1c1400', color: r.turno === 'T1' ? '#4ade80' : '#fbbf24' }}>
                              {r.turno}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: '#94a3b8' }}>{r.hora_ingreso ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: r.entrada_norm ? '#38bdf8' : '#334155' }}>{r.entrada_norm ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: '#94a3b8' }}>{r.hora_salida ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: '#64748b' }}>{r.salida_norm ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: r.salida_efectiva ? '#f59e0b' : '#334155' }}>{r.salida_efectiva ?? '—'}</td>
                        <td className="px-3 py-2.5 font-bold" style={{ color: r.horas_extra > 0 ? '#f97316' : '#334155' }}>{fmtH(r.horas_extra)}</td>
                        <td className="px-3 py-2.5" style={{ color: heNoc > 0 ? '#818cf8' : '#334155' }}>{fmtH(heNoc)}</td>
                        <td className="px-3 py-2.5" style={{ color: recDiu > 0 ? '#34d399' : recNoc > 0 ? '#60a5fa' : '#334155' }}>{recDiu > 0 ? fmtH(recDiu) : fmtH(recNoc)}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: estadoColor }}>{estadoLabel}</td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => setModalTurno(registros.find(x => x.cedula === r.cedula) ?? r)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                            style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#a855f7' }}>
                            <Settings size={11} /> Config
                          </button>
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

      {modalTurno && (
        <TurnoManualModal
          registro={modalTurno}
          overrideActual={overrides[modalTurno.cedula]}
          onClose={() => setModalTurno(null)}
          onGuardar={handleGuardarOverride}
        />
      )}
    </main>
  )
}
