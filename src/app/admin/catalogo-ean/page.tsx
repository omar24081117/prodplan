'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Search, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Package, Trash2 } from 'lucide-react'

type Producto = { referencia: string; descripcion: string; tipo: string | null; ean13: string | null; activo: boolean }

export default function CatalogoEanPage() {
  const fileRef     = useRef<HTMLInputElement>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading,   setLoading]   = useState(false)
  const [busqueda,  setBusqueda]  = useState('')
  const [archivo,   setArchivo]   = useState<File | null>(null)
  const [cargando,  setCargando]  = useState(false)
  const [msg,       setMsg]       = useState('')
  const [total,     setTotal]     = useState(0)

  const cargar = useCallback(async (q = '') => {
    setLoading(true)
    const url = q ? `/api/productos-ean?q=${encodeURIComponent(q)}` : '/api/productos-ean?q='
    const res  = await fetch(url + (q ? '' : '&limit=200') )
    // For full list use direct query
    const res2 = await fetch(`/api/productos-ean/lista${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    if (res2.ok) {
      const data = await res2.json()
      setProductos(data.items ?? [])
      setTotal(data.total ?? 0)
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function subirCatalogo(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) return
    setCargando(true); setMsg('')
    const fd = new FormData(); fd.append('file', archivo)
    const res  = await fetch('/api/productos-ean/cargar', { method: 'POST', body: fd })
    const data = await res.json()
    setMsg(res.ok ? `✅ ${data.cargados} productos cargados de ${data.total_filas} filas` : `❌ ${data.error}`)
    setCargando(false)
    if (res.ok) { setArchivo(null); if (fileRef.current) fileRef.current.value = ''; cargar() }
  }

  const filtrados = busqueda
    ? productos.filter(p =>
        p.referencia.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.ean13 ?? '').includes(busqueda))
    : productos

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package size={22} className="text-orange-400" /> Catálogo EAN / Productos
        </h1>
        <span className="text-xs px-2 py-1 rounded-lg text-gray-500" style={{ background: '#1f2937' }}>
          {total} productos
        </span>
        <button onClick={() => cargar(busqueda)} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Carga de Excel */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <p className="text-sm font-bold text-white mb-1">📋 Cargar catálogo desde Excel</p>
        <p className="text-xs text-gray-500 mb-3">Columnas requeridas: <span className="text-orange-300">REF · DESCRIPCION</span> · opcionales: TIPO · EAN13</p>
        <form onSubmit={subirCatalogo} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Archivo .xlsx / .xls</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls"
              onChange={e => { setArchivo(e.target.files?.[0] ?? null); setMsg('') }}
              className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-900/40 file:text-orange-300 hover:file:bg-orange-900/60" />
          </div>
          <button type="submit" disabled={!archivo || cargando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#92400e,#b45309)', color: 'white', border: '1px solid #d97706' }}>
            {cargando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {cargando ? 'Cargando...' : 'Cargar al sistema'}
          </button>
        </form>
        {msg && (
          <div className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
            style={{ background: msg.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, color: msg.startsWith('✅') ? '#4ade80' : '#fca5a5' }}>
            {msg.startsWith('✅') ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg}
          </div>
        )}
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Buscar por REF, descripción o EAN13..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: '#111827', border: '1px solid #1f2937', color: '#f1f5f9' }} />
        </div>
        <span className="text-xs text-gray-600">{filtrados.length} mostrados</span>
      </div>

      {/* Tabla */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-orange-400" /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Package size={36} strokeWidth={1} className="mx-auto mb-2" />
            <p className="text-sm">{total === 0 ? 'Sin productos. Carga el catálogo desde Excel.' : 'Sin resultados.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0a1117', borderBottom: '1px solid #1f2937' }}>
                {['REF','DESCRIPCIÓN','TIPO','EAN13',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr key={p.referencia} style={{ background: i % 2 === 0 ? '#0d1117' : '#111827', borderBottom: '1px solid #1a2535' }}>
                  <td className="px-4 py-2.5 font-mono text-orange-300 font-bold text-xs">{p.referencia}</td>
                  <td className="px-4 py-2.5 text-white font-medium max-w-xs truncate">{p.descripcion}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{p.tipo ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{p.ean13 ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${p.activo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
