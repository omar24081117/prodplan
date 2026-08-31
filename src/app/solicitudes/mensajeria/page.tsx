'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, ArrowLeft, Plus, Clock, CheckCircle2, XCircle, Search, Lock, X, Loader2, Play, Flag, Bike } from 'lucide-react'

type Estado = 'Pendiente' | 'En Trámite' | 'Finalizada' | 'Rechazada'

type Solicitud = {
  id: string; numero: number; created_at: string; fecha: string
  solicitante_nombre: string; area: string
  destinatario: string; direccion: string; descripcion: string
  urgencia: 'Normal' | 'Urgente'
  estado: Estado; observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
  mensajero_asignado: string | null
}

const EST: Record<Estado, { bg: string; color: string; border: string }> = {
  Pendiente:    { bg: '#1c1400', color: '#fbbf24', border: '#854d0e' },
  'En Trámite': { bg: '#0c1a3d', color: '#60a5fa', border: '#1e3a8a' },
  Finalizada:   { bg: '#052e16', color: '#4ade80', border: '#166534' },
  Rechazada:    { bg: '#1a0505', color: '#f87171', border: '#7f1d1d' },
}

const SORT_ORDER: Record<Estado, number> = { Pendiente: 0, 'En Trámite': 1, Rechazada: 2, Finalizada: 3 }

function fmtFecha(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

type AccionTipo = 'En Trámite' | 'Finalizada' | 'Rechazada'

export default function MensajeriaPage() {
  const router = useRouter()

  const [authOk,       setAuthOk]       = useState(false)
  const [gestor,       setGestor]       = useState<{ nombre: string; esMensajero: boolean } | null>(null)
  const [solicitudes,  setSolicitudes]  = useState<Solicitud[]>([])
  const [loadingSols,  setLoadingSols]  = useState(false)
  const [personal,     setPersonal]     = useState<string[]>([])
  const [mensajeros,   setMensajeros]   = useState<string[]>([])

  const [modalGestion, setModalGestion] = useState(false)
  const [cedulaInput,  setCedulaInput]  = useState('')
  const [errorGestion, setErrorGestion] = useState('')
  const [loadingAuth,  setLoadingAuth]  = useState(false)

  const [modalNueva, setModalNueva] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [errorForm,  setErrorForm]  = useState('')
  const [form, setForm] = useState({
    solicitante_nombre: '', area: '',
    destinatario: '', direccion: '', descripcion: '',
    urgencia: 'Normal' as 'Normal' | 'Urgente',
  })

  const [accionId,        setAccionId]        = useState<string | null>(null)
  const [accionTipo,      setAccionTipo]      = useState<AccionTipo | null>(null)
  const [accionObs,       setAccionObs]       = useState('')
  const [accionMensajero, setAccionMensajero] = useState('')
  const [savingAccion,    setSavingAccion]    = useState(false)
  const [solicitudCreada, setSolicitudCreada] = useState<{ numero: number; descripcion: string } | null>(null)

  const [busqueda,     setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | Estado>('Todos')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('solicitudes_user')
      if (saved) setAuthOk(true)
      else router.replace('/solicitudes')
    } catch { router.replace('/solicitudes') }
  }, [router])

  useEffect(() => {
    fetch('/api/personal').then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return
      const activos = data as { nombre: string; activo: boolean; rol: string; rol_secundario: string | null }[]
      setPersonal(activos.filter(p => p.activo).map(p => p.nombre).sort())
      setMensajeros(
        activos
          .filter(p => p.activo && (p.rol === 'Mensajero' || p.rol_secundario === 'Mensajero'))
          .map(p => p.nombre)
          .sort()
      )
    }).catch(() => {})
  }, [])

  async function cargarSolicitudes() {
    setLoadingSols(true)
    try {
      const data = await fetch('/api/solicitudes/mensajeria').then(r => r.json())
      if (Array.isArray(data)) setSolicitudes(data)
    } catch {}
    finally { setLoadingSols(false) }
  }

  useEffect(() => { if (gestor) cargarSolicitudes() }, [gestor])

  async function intentarGestion(e: React.FormEvent) {
    e.preventDefault()
    setLoadingAuth(true); setErrorGestion('')
    try {
      const res  = await fetch('/api/solicitudes/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedulaInput.trim(), modulo: 'mensajeria' }),
      })
      const data = await res.json()
      if (!res.ok)              { setErrorGestion(data.error || 'Error'); return }
      if (!data.puedeGestionar) { setErrorGestion('No tienes acceso a la gestión de mensajería'); return }
      const esMensajero = data.rol === 'Mensajero' || data.rol_secundario === 'Mensajero'
      setGestor({ nombre: data.nombre, esMensajero })
      setModalGestion(false); setCedulaInput('')
    } catch { setErrorGestion('Error de conexión') }
    finally { setLoadingAuth(false) }
  }

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErrorForm('')
    try {
      const res = await fetch('/api/solicitudes/mensajeria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErrorForm(data.error || 'Error al guardar'); return }
      setModalNueva(false)
      setForm({ solicitante_nombre: '', area: '', destinatario: '', direccion: '', descripcion: '', urgencia: 'Normal' })
      if (data.numero) {
        setSolicitudCreada({ numero: data.numero, descripcion: form.descripcion })
        setTimeout(() => setSolicitudCreada(null), 8000)
      }
      if (gestor) cargarSolicitudes()
    } catch { setErrorForm('Error de conexión') }
    finally { setSaving(false) }
  }

  async function ejecutarAccion() {
    if (!accionId || !accionTipo || !gestor) return
    setSavingAccion(true)
    try {
      const payload: Record<string, string | null> = {
        estado: accionTipo,
        observacion: accionObs,
        gestionado_por: gestor.nombre,
      }
      if (accionTipo === 'En Trámite' && accionMensajero)
        payload.mensajero_asignado = accionMensajero
      const res = await fetch(`/api/solicitudes/mensajeria/${accionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setAccionId(null); setAccionTipo(null); setAccionObs(''); setAccionMensajero('')
        cargarSolicitudes()
      }
    } catch {}
    finally { setSavingAccion(false) }
  }

  const filtradas = solicitudes
    .filter(s => {
      if (gestor?.esMensajero && s.mensajero_asignado !== gestor.nombre) return false
      const ok1 = s.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                  s.solicitante_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                  s.destinatario.toLowerCase().includes(busqueda.toLowerCase())
      const ok2 = filtroEstado === 'Todos' || s.estado === filtroEstado
      return ok1 && ok2
    })
    .sort((a, b) => (SORT_ORDER[a.estado] ?? 4) - (SORT_ORDER[b.estado] ?? 4))

  const tableRef = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)
  const startX    = useRef(0)
  const scrollL   = useRef(0)
  function onDragStart(e: React.MouseEvent) {
    dragging.current = true
    startX.current = e.pageX
    scrollL.current = tableRef.current?.scrollLeft ?? 0
    if (tableRef.current) tableRef.current.style.cursor = 'grabbing'
  }
  function onDragMove(e: React.MouseEvent) {
    if (!dragging.current || !tableRef.current) return
    e.preventDefault()
    tableRef.current.scrollLeft = scrollL.current - (e.pageX - startX.current)
  }
  function onDragEnd() {
    dragging.current = false
    if (tableRef.current) tableRef.current.style.cursor = 'grab'
  }

  if (!authOk) return null

  const ESTADOS_FILTRO: Array<'Todos' | Estado> = ['Todos', 'Pendiente', 'En Trámite', 'Finalizada', 'Rechazada']

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">

      {/* Notificación solicitud creada */}
      {solicitudCreada !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}>
          <div className="rounded-2xl px-6 py-5" style={{ background: '#1a0b2e', border: '2px solid #7c3aed' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={22} className="text-purple-400 flex-shrink-0" />
                <p className="text-purple-300 font-bold text-base">Solicitud creada</p>
              </div>
              <button onClick={() => setSolicitudCreada(null)} className="text-purple-800 hover:text-purple-400 mt-0.5">
                <X size={16} />
              </button>
            </div>
            <div className="rounded-xl px-4 py-3 mb-3" style={{ background: '#100820', border: '1px solid #4c1d95' }}>
              <p className="text-gray-400 text-xs mb-1">Descripción del envío</p>
              <p className="text-white text-sm font-medium">{solicitudCreada.descripcion}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">ID asignado:</span>
              <span className="font-mono font-bold text-lg text-white">#{solicitudCreada.numero}</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => router.push('/solicitudes')} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Send size={20} className="text-purple-400" /> Mensajería
          </h1>
          {gestor && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: gestor.esMensajero ? '#2dd4bf' : '#a78bfa' }}>
            {gestor.esMensajero && <Bike size={13} />}
            {gestor.nombre}
            {gestor.esMensajero && <span className="text-gray-600 font-normal">· mis entregas</span>}
          </span>
              <button onClick={() => setGestor(null)} className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1 rounded"
                style={{ background: '#1f2937', border: '1px solid #374151' }}>
                Salir
              </button>
              <button onClick={() => setModalNueva(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #3b1c5c, #4c2580)', border: '1px solid #9333ea' }}>
                <Plus size={14} /> Nueva Solicitud
              </button>
            </div>
          )}
        </div>

        {/* Gestión mode */}
        {gestor && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] rounded-lg px-3 py-2"
                style={{ background: '#111827', border: '1px solid #1e293b' }}>
                <Search size={13} className="text-gray-500" />
                <input type="text" placeholder="Buscar descripción, solicitante o destinatario..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
              </div>
              {ESTADOS_FILTRO.map(est => {
                const st     = est !== 'Todos' ? EST[est] : null
                const active = filtroEstado === est
                return (
                  <button key={est} onClick={() => setFiltroEstado(est)}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? (st?.bg ?? '#1f2937') : '#111827',
                      color:      active ? (st?.color ?? '#e5e7eb') : '#6b7280',
                      border:     `1px solid ${active ? (st?.border ?? '#374151') : '#1f2937'}`,
                    }}>
                    {est}
                  </button>
                )
              })}
            </div>

            {loadingSols ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="text-purple-400 animate-spin" /></div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
                {filtradas.length === 0 ? (
                  <p className="text-center text-gray-600 py-12 text-sm">No hay solicitudes</p>
                ) : (
                  <div ref={tableRef} className="overflow-x-auto select-none"
                    style={{ cursor: 'grab' }}
                    onMouseDown={onDragStart} onMouseMove={onDragMove}
                    onMouseUp={onDragEnd} onMouseLeave={onDragEnd}>
                    <table className="text-sm" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                      <thead>
                        <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                          {['ID', 'Fecha', 'Solicitante', 'Área', 'Destinatario', 'Dirección', 'Descripción', 'Urgencia', 'Mensajero', 'Estado', 'Acciones'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtradas.map((s, i) => {
                          const st       = EST[s.estado]
                          const isAccion = accionId === s.id
                          const dimmed   = s.estado === 'Finalizada' || s.estado === 'Rechazada'
                          return (
                            <>
                              <tr key={s.id}
                                style={{
                                  background:   i % 2 === 0 ? '#0d1117' : '#0f172a',
                                  borderBottom: isAccion ? 'none' : '1px solid #1e293b',
                                  opacity:      dimmed ? 0.6 : 1,
                                }}>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>
                                    #{s.numero ?? '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                                <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                                <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                                <td className="px-3 py-2.5 text-purple-300 font-medium whitespace-nowrap">{s.destinatario}</td>
                                <td className="px-3 py-2.5 text-gray-300 text-xs" style={{ minWidth: 120 }}>
                                  {s.direccion}
                                </td>
                                <td className="px-3 py-2.5 text-gray-200" style={{ minWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                  {s.descripcion}
                                </td>
                                <td className="px-3 py-2.5">
                                  {s.urgencia === 'Urgente'
                                    ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                                    : <span className="text-xs text-gray-600">Normal</span>}
                                </td>
                                <td className="px-3 py-2.5" style={{ minWidth: 150 }}
                                  onMouseDown={e => e.stopPropagation()}>
                                  {dimmed ? (
                                    s.mensajero_asignado
                                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#0d2d2d', color: '#2dd4bf', border: '1px solid #0d9488' }}>
                                          <Bike size={10} />{s.mensajero_asignado}
                                        </span>
                                      : <span className="text-gray-700 text-xs">—</span>
                                  ) : (
                                    <select
                                      value={s.mensajero_asignado ?? ''}
                                      onChange={async e => {
                                        const val = e.target.value || null
                                        await fetch(`/api/solicitudes/mensajeria/${s.id}`, {
                                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ estado: s.estado, observacion: s.observacion, gestionado_por: s.gestionado_por ?? gestor!.nombre, mensajero_asignado: val }),
                                        })
                                        cargarSolicitudes()
                                      }}
                                      className="text-xs font-semibold rounded cursor-pointer focus:outline-none"
                                      style={{ background: '#0d2d2d', color: s.mensajero_asignado ? '#2dd4bf' : '#6b7280', border: '1px solid #0d9488', padding: '2px 6px' }}>
                                      <option value="" style={{ background: '#111827', color: '#9ca3af' }}>— asignar —</option>
                                      {mensajeros.map(m => <option key={m} value={m} style={{ background: '#111827', color: '#e2e8f0' }}>{m}</option>)}
                                    </select>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap"
                                    style={{ background: st.bg, color: st.color }}>
                                    {s.estado === 'Finalizada'  ? <CheckCircle2 size={10} /> :
                                     s.estado === 'En Trámite'  ? <Play size={10} /> :
                                     s.estado === 'Rechazada'   ? <XCircle size={10} /> :
                                     <Clock size={10} />}
                                    {s.estado}
                                  </span>
                                  {s.gestionado_por && <span className="block text-gray-600 text-xs mt-0.5">{s.gestionado_por}</span>}
                                  {s.gestionado_en && <span className="block text-gray-700 text-xs mt-0.5 font-mono">{fmtFecha(s.gestionado_en)}</span>}
                                  {s.observacion && <span className="block text-gray-500 text-xs mt-0.5 max-w-[140px] truncate" title={s.observacion}>{s.observacion}</span>}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {s.estado === 'Pendiente' && (
                                    <div className="flex gap-1">
                                      <button onClick={() => { setAccionId(s.id); setAccionTipo('En Trámite'); setAccionObs(''); setAccionMensajero(s.mensajero_asignado ?? '') }}
                                        className="px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110"
                                        style={{ background: '#0c1a3d', color: '#60a5fa', border: '1px solid #1e3a8a' }}>
                                        Iniciar
                                      </button>
                                      <button onClick={() => { setAccionId(s.id); setAccionTipo('Rechazada'); setAccionObs(''); setAccionMensajero('') }}
                                        className="px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110"
                                        style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
                                        Rechazar
                                      </button>
                                    </div>
                                  )}
                                  {s.estado === 'En Trámite' && (
                                    <button onClick={() => { setAccionId(s.id); setAccionTipo('Finalizada'); setAccionObs(''); setAccionMensajero('') }}
                                      className="px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110 flex items-center gap-1"
                                      style={{ background: '#052e16', color: '#4ade80', border: '1px solid #166534' }}>
                                      <Flag size={10} /> Finalizar
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {isAccion && (
                                <tr key={`${s.id}-acc`} style={{ background: '#080d08', borderBottom: '2px solid #1e293b' }}>
                                  <td colSpan={11} className="px-4 py-3">
                                    <div className="flex items-start gap-3 flex-wrap">
                                      <span className="text-xs font-bold mt-1.5 whitespace-nowrap"
                                        style={{ color: accionTipo === 'Finalizada' ? '#4ade80' : accionTipo === 'En Trámite' ? '#60a5fa' : '#f87171' }}>
                                        {accionTipo === 'En Trámite' ? '▶ Iniciar trámite' : accionTipo === 'Finalizada' ? '✓ Finalizar envío' : '✕ Rechazar envío'}
                                      </span>
                                      {accionTipo === 'En Trámite' && (
                                        <div className="min-w-[180px]">
                                          <select
                                            value={accionMensajero}
                                            onChange={e => setAccionMensajero(e.target.value)}
                                            className="w-full bg-gray-900 border border-teal-800 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer">
                                            <option value="">— Asignar mensajero —</option>
                                            {mensajeros.map(m => <option key={m} value={m}>{m}</option>)}
                                          </select>
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-[200px]">
                                        <input type="text" autoFocus={accionTipo !== 'En Trámite'}
                                          placeholder={accionTipo === 'Finalizada' ? 'Descripción de lo realizado (obligatorio)' : 'Descripción de la acción (opcional)'}
                                          value={accionObs}
                                          onChange={e => setAccionObs(e.target.value)}
                                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500" />
                                      </div>
                                      <button onClick={ejecutarAccion}
                                        disabled={savingAccion || (accionTipo === 'Finalizada' && !accionObs.trim())}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 flex items-center gap-1"
                                        style={{ background: accionTipo === 'En Trámite' ? '#1e3a8a' : accionTipo === 'Finalizada' ? '#166534' : '#7f1d1d' }}>
                                        {savingAccion && <Loader2 size={12} className="animate-spin" />}
                                        Confirmar
                                      </button>
                                      <button onClick={() => { setAccionId(null); setAccionTipo(null); setAccionMensajero('') }} className="text-gray-600 hover:text-gray-400 mt-1">
                                        <X size={14} />
                                      </button>
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
                )}
              </div>
            )}
          </>
        )}

        {!gestor && (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <Send size={56} className="text-purple-900 opacity-40" />
            <p className="text-gray-500 text-base font-medium">¿Qué deseas hacer?</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
              <button onClick={() => setModalNueva(true)}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8 px-6 rounded-2xl font-bold text-white text-base transition-all hover:brightness-110 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3b1c5c, #4c2580)', border: '1px solid #9333ea' }}>
                <Plus size={28} className="text-purple-300" />
                Nueva Solicitud
              </button>
              <button onClick={() => setModalGestion(true)}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8 px-6 rounded-2xl font-bold text-white text-base transition-all hover:brightness-110 active:scale-95"
                style={{ background: '#1a2535', border: '1px solid #374151' }}>
                <Lock size={28} className="text-gray-400" />
                Gestión
              </button>
              <button onClick={() => setModalGestion(true)}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8 px-6 rounded-2xl font-bold text-white text-base transition-all hover:brightness-110 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #0d2d2d, #0f3f3a)', border: '1px solid #0d9488' }}>
                <Bike size={28} className="text-teal-400" />
                Mensajero
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Gestión auth */}
      {modalGestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-purple-400" />
                <h3 className="text-white font-bold text-base">Acceso de Gestión</h3>
              </div>
              <button onClick={() => { setModalGestion(false); setCedulaInput(''); setErrorGestion('') }} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-gray-500 text-xs mb-4">Director · Gerencia · Mensajero · Almacenista</p>
            <form onSubmit={intentarGestion} className="flex flex-col gap-3">
              <input type="text" inputMode="numeric" placeholder="Ingresa tu cédula"
                value={cedulaInput} autoFocus onChange={e => setCedulaInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
              {errorGestion && <p className="text-red-400 text-xs text-center">{errorGestion}</p>}
              <button type="submit" disabled={loadingAuth || !cedulaInput.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #3b1c5c, #4c2580)', border: '1px solid #9333ea' }}>
                {loadingAuth && <Loader2 size={14} className="animate-spin" />}
                Ingresar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva Solicitud */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #374151' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Send size={16} className="text-purple-400" /> Nueva Solicitud de Mensajería
              </h3>
              <button onClick={() => setModalNueva(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={enviarSolicitud} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Solicitante *</label>
                  {personal.length > 0 ? (
                    <select required value={form.solicitante_nombre}
                      onChange={e => setForm(f => ({ ...f, solicitante_nombre: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 cursor-pointer">
                      <option value="">— seleccionar —</option>
                      {personal.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input required value={form.solicitante_nombre} onChange={e => setForm(f => ({ ...f, solicitante_nombre: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Área *</label>
                  <input required value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Destinatario / empresa *</label>
                <input required value={form.destinatario} placeholder="Nombre o empresa de destino"
                  onChange={e => setForm(f => ({ ...f, destinatario: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Dirección de destino *</label>
                <input required value={form.direccion} placeholder="Dirección completa"
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Descripción del envío *</label>
                <textarea required rows={2} value={form.descripcion} placeholder="Qué se va a enviar (documentos, paquete, etc.)"
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Urgencia</label>
                <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value as 'Normal' | 'Urgente' }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer">
                  <option value="Normal">Normal</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
              {errorForm && <p className="text-red-400 text-xs">{errorForm}</p>}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setModalNueva(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #3b1c5c, #4c2580)', border: '1px solid #9333ea' }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
