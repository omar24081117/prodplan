'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, Clock, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react'

type SolicitudCompra = {
  id: string; fecha: string; solicitante_nombre: string; area: string
  tipo_solicitud: string; descripcion: string; cantidad: string; unidad: string
  urgencia: string; estado: 'Pendiente' | 'Aprobada' | 'Rechazada'
  observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
}
type SolicitudMensajeria = {
  id: string; fecha: string; solicitante_nombre: string; area: string
  destinatario: string; direccion: string; descripcion: string
  urgencia: string; estado: 'Pendiente' | 'Aprobada' | 'Rechazada'
  observacion: string | null; gestionado_por: string | null; gestionado_en: string | null
}

const EST = {
  Pendiente: { bg: '#1c1400', color: '#fbbf24', border: '#854d0e' },
  Aprobada:  { bg: '#052e16', color: '#4ade80', border: '#166534' },
  Rechazada: { bg: '#1a0505', color: '#f87171', border: '#7f1d1d' },
}

type Filtro = 'Todos' | 'Pendiente' | 'Aprobada' | 'Rechazada'

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

  const listaCompras    = filtro === 'Todos' ? compras    : compras.filter(s => s.estado === filtro)
  const listaMensajeria = filtro === 'Todos' ? mensajeria : mensajeria.filter(s => s.estado === filtro)

  const totalPend = compras.filter(s => s.estado === 'Pendiente').length + mensajeria.filter(s => s.estado === 'Pendiente').length
  const totalApro = compras.filter(s => s.estado === 'Aprobada').length  + mensajeria.filter(s => s.estado === 'Aprobada').length
  const totalRech = compras.filter(s => s.estado === 'Rechazada').length + mensajeria.filter(s => s.estado === 'Rechazada').length

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
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Pendientes', value: totalPend, ...EST.Pendiente, icon: <Clock size={14} /> },
            { label: 'Aprobadas',  value: totalApro, ...EST.Aprobada,  icon: <CheckCircle2 size={14} /> },
            { label: 'Rechazadas', value: totalRech, ...EST.Rechazada, icon: <XCircle size={14} /> },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: c.color }}>
                {c.icon}
                <span className="text-xs font-bold">{c.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
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
                <span className="ml-2 text-xs opacity-60">
                  {t === 'compras' ? compras.length : mensajeria.length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 ml-auto flex-wrap">
            {(['Todos', 'Pendiente', 'Aprobada', 'Rechazada'] as const).map(est => {
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
                      {['Fecha', 'Solicitante', 'Área', 'Tipo', 'Descripción', 'Cant.', 'Urgencia', 'Estado', 'Gestionado por'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaCompras.map((s, i) => {
                      const st = EST[s.estado]
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b' }}>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                          <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                          <td className="px-3 py-2.5 text-cyan-400 text-xs font-semibold whitespace-nowrap">{s.tipo_solicitud}</td>
                          <td className="px-3 py-2.5 text-gray-200 max-w-[160px]">
                            <span className="block truncate" title={s.descripcion}>{s.descripcion}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{s.cantidad} {s.unidad}</td>
                          <td className="px-3 py-2.5">
                            {s.urgencia === 'Urgente'
                              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                              : <span className="text-xs text-gray-600">Normal</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
                              style={{ background: st.bg, color: st.color }}>
                              {s.estado === 'Aprobada' ? <CheckCircle2 size={10} /> : s.estado === 'Rechazada' ? <XCircle size={10} /> : <Clock size={10} />}
                              {s.estado}
                            </span>
                            {s.observacion && <span className="block text-gray-600 text-xs mt-0.5 max-w-[120px] truncate">{s.observacion}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{s.gestionado_por ?? '—'}</td>
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
                      {['Fecha', 'Solicitante', 'Área', 'Destinatario', 'Dirección', 'Descripción', 'Urgencia', 'Estado', 'Gestionado por'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaMensajeria.map((s, i) => {
                      const st = EST[s.estado]
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0f172a', borderBottom: '1px solid #1e293b' }}>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs whitespace-nowrap">{s.fecha}</td>
                          <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{s.solicitante_nombre}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.area}</td>
                          <td className="px-3 py-2.5 text-purple-300 font-medium whitespace-nowrap">{s.destinatario}</td>
                          <td className="px-3 py-2.5 text-gray-300 text-xs max-w-[120px]">
                            <span className="block truncate" title={s.direccion}>{s.direccion}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-200 max-w-[140px]">
                            <span className="block truncate" title={s.descripcion}>{s.descripcion}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {s.urgencia === 'Urgente'
                              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#450a0a', color: '#fca5a5' }}>URGENTE</span>
                              : <span className="text-xs text-gray-600">Normal</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
                              style={{ background: st.bg, color: st.color }}>
                              {s.estado === 'Aprobada' ? <CheckCircle2 size={10} /> : s.estado === 'Rechazada' ? <XCircle size={10} /> : <Clock size={10} />}
                              {s.estado}
                            </span>
                            {s.observacion && <span className="block text-gray-600 text-xs mt-0.5 max-w-[120px] truncate">{s.observacion}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{s.gestionado_por ?? '—'}</td>
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
