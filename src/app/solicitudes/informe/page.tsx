'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, Clock, CheckCircle2, XCircle, RefreshCw, Loader2, Play } from 'lucide-react'

type Estado = 'Pendiente' | 'En Trámite' | 'Finalizada' | 'Rechazada'

type SolicitudCompra = {
  id: string; numero: number; fecha: string; solicitante_nombre: string; area: string
  tipo_solicitud: string; descripcion: string; cantidad: string; unidad: string
  urgencia: string; estado: Estado
  observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
}
type SolicitudMensajeria = {
  id: string; numero: number; fecha: string; solicitante_nombre: string; area: string
  destinatario: string; direccion: string; descripcion: string
  urgencia: string; estado: Estado
  observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
}

const EST: Record<Estado, { bg: string; color: string; border: string }> = {
  Pendiente:    { bg: '#1c1400', color: '#fbbf24', border: '#854d0e' },
  'En Trámite': { bg: '#0c1a3d', color: '#60a5fa', border: '#1e3a8a' },
  Finalizada:   { bg: '#052e16', color: '#4ade80', border: '#166534' },
  Rechazada:    { bg: '#1a0505', color: '#f87171', border: '#7f1d1d' },
}

const SORT_ORDER: Record<Estado, number> = { Pendiente: 0, 'En Trámite': 1, Rechazada: 2, Finalizada: 3 }

type Filtro = 'Todos' | Estado

function EstadoBadge({ estado }: { estado: Estado }) {
  const st = EST[estado]
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: st.bg, color: st.color }}>
      {estado === 'Finalizada'  ? <CheckCircle2 size={10} /> :
       estado === 'En Trámite'  ? <Play size={10} /> :
       estado === 'Rechazada'   ? <XCircle size={10} /> :
       <Clock size={10} />}
      {estado}
    </span>
  )
}

export default function InformeSolicitudesPage() {
  const router = useRouter()

  const [tab,        setTab]        = useState<'compras' | 'mensajeria'>('compras')
  const [compras,    setCompras]    = useState<SolicitudCompra[]>([])
  const [mensajeria, setMensajeria] = useState<SolicitudMensajeria[]>([])
  const [loading,    setLoading]    = useState(false)
  const [filtro,     setFiltro]     = useState<Filtro>('Todos')
  const [authOk,     setAuthOk]     = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('solicitudes_user')
      if (saved) setAuthOk(true)
      else router.replace('/solicitudes')
    } catch { router.replace('/solicitudes') }
  }, [router])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [rc, rm] = await Promise.all([
        fetch('/api/solicitudes/compras').then(r => r.json()),
        fetch('/api/solicitudes/mensajeria').then(r => r.json()),
      ])
      if (Array.isArray(rc)) setCompras(rc)
      if (Array.isArray(rm)) setMensajeria(rm)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (authOk) cargar() }, [authOk, cargar])

  if (!authOk) return null

  const sortFn = (a: { estado: Estado }, b: { estado: Estado }) =>
    (SORT_ORDER[a.estado] ?? 4) - (SORT_ORDER[b.estado] ?? 4)

  const listaCompras    = (filtro === 'Todos' ? compras    : compras.filter(s => s.estado === filtro)).slice().sort(sortFn)
  const listaMensajeria = (filtro === 'Todos' ? mensajeria : mensajeria.filter(s => s.estado === filtro)).slice().sort(sortFn)

  const count = (arr: { estado: Estado }[], e: Estado) => arr.filter(s => s.estado === e).length
  const totalPend   = count(compras, 'Pendiente')   + count(mensajeria, 'Pendiente')
  const totalTramit = count(compras, 'En Trámite')  + count(mensajeria, 'En Trámite')
  const totalFinal  = count(compras, 'Finalizada')  + count(mensajeria, 'Finalizada')
  const totalRech   = count(compras, 'Rechazada')   + count(mensajeria, 'Rechazada')

  const FILTROS: Filtro[] = ['Todos', 'Pendiente', 'En Trámite', 'Finalizada', 'Rechazada']

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => router.push('/solicitudes')} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={20} className="text-yellow-400" /> Estado de Solicitudes
          </h1>
          <button onClick={cargar} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-all"
            style={{ background: '#1f2937', border: '1px solid #374151' }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Actualizar
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pendientes', value: totalPend,   est: 'Pendiente'    as Estado, icon: <Clock size={13} /> },
            { label: 'En Trámite', value: totalTramit, est: 'En Trámite'   as Estado, icon: <Play size={13} /> },
            { label: 'Finalizadas', value: totalFinal, est: 'Finalizada'   as Estado, icon: <CheckCircle2 size={13} /> },
            { label: 'Rechazadas', value: totalRech,   est: 'Rechazada'    as Estado, icon: <XCircle size={13} /> },
          ].map(c => {
            const st = EST[c.est]
            return (
              <div key={c.label} className="rounded-xl p-4" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: st.color }}>
                  {c.icon}
                  <span className="text-xs font-bold">{c.label}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: st.color }}>{c.value}</p>
              </div>
            )
          })}
        </div>

        {/* Tabs + Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e293b' }}>
            {(['compras', 'mensajeria'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-2 text-xs font-bold transition-all"
                style={{
                  background: tab === t ? (t === 'compras' ? '#0e4f5c' : '#3b1c5c') : '#111827',
                  color:      tab === t ? (t === 'compras' ? '#22d3ee' : '#c084fc') : '#6b7280',
                }}>
                {t === 'compras' ? '🛒 Compras' : '📬 Mensajería'}
                <span className="ml-2 text-xs opacity-60">{t === 'compras' ? compras.length : mensajeria.length}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 ml-auto flex-wrap">
            {FILTROS.map(est => {
              const st     = est !== 'Todos' ? EST[est] : null
              const active = filtro === est
              return (
                <button key={est} onClick={() => setFiltro(est)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
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
        </div>

        {/* Tabla Compras */}
        {tab === 'compras' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="text-cyan-400 animate-spin" /></div>
            ) : listaCompras.length === 0 ? (
              <p className="text-center text-gray-600 py-12 text-sm">Sin solicitudes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                      {['ID', 'Fecha', 'Solicitante', 'Área', 'Tipo', 'Descripción', 'Cant.', 'Urgencia', 'Estado', 'Lo realizado / Gestor'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaCompras.map((s, i) => {
                      const dimmed = s.estado === 'Finalizada' || s.estado === 'Rechazada'
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b', opacity: dimmed ? 0.6 : 1 }}>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>
                              #{s.numero ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                          <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                          <td className="px-3 py-2.5 text-cyan-400 text-xs font-semibold whitespace-nowrap">{s.tipo_solicitud}</td>
                          <td className="px-3 py-2.5 text-gray-200 max-w-[150px]">
                            <span className="block truncate" title={s.descripcion}>{s.descripcion}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{s.cantidad} {s.unidad}</td>
                          <td className="px-3 py-2.5">
                            {s.urgencia === 'Urgente'
                              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                              : <span className="text-xs text-gray-600">Normal</span>}
                          </td>
                          <td className="px-3 py-2.5"><EstadoBadge estado={s.estado} /></td>
                          <td className="px-3 py-2.5 max-w-[160px]">
                            {s.observacion && <span className="block text-gray-300 text-xs truncate" title={s.observacion}>{s.observacion}</span>}
                            {s.gestionado_por && <span className="block text-gray-600 text-xs mt-0.5">{s.gestionado_por}</span>}
                            {!s.observacion && !s.gestionado_por && <span className="text-gray-700 text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tabla Mensajería */}
        {tab === 'mensajeria' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="text-purple-400 animate-spin" /></div>
            ) : listaMensajeria.length === 0 ? (
              <p className="text-center text-gray-600 py-12 text-sm">Sin solicitudes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#020617', borderBottom: '2px solid #1e293b' }}>
                      {['ID', 'Fecha', 'Solicitante', 'Área', 'Destinatario', 'Dirección', 'Descripción', 'Urgencia', 'Estado', 'Lo realizado / Gestor'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaMensajeria.map((s, i) => {
                      const dimmed = s.estado === 'Finalizada' || s.estado === 'Rechazada'
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b', opacity: dimmed ? 0.6 : 1 }}>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#e2e8f0' }}>
                              #{s.numero ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                          <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                          <td className="px-3 py-2.5 text-purple-300 font-medium whitespace-nowrap">{s.destinatario}</td>
                          <td className="px-3 py-2.5 text-gray-300 text-xs max-w-[100px]">
                            <span className="block truncate" title={s.direccion}>{s.direccion}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-200 max-w-[130px]">
                            <span className="block truncate" title={s.descripcion}>{s.descripcion}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {s.urgencia === 'Urgente'
                              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                              : <span className="text-xs text-gray-600">Normal</span>}
                          </td>
                          <td className="px-3 py-2.5"><EstadoBadge estado={s.estado} /></td>
                          <td className="px-3 py-2.5 max-w-[160px]">
                            {s.observacion && <span className="block text-gray-300 text-xs truncate" title={s.observacion}>{s.observacion}</span>}
                            {s.gestionado_por && <span className="block text-gray-600 text-xs mt-0.5">{s.gestionado_por}</span>}
                            {!s.observacion && !s.gestionado_por && <span className="text-gray-700 text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
