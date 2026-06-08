'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, ChevronRight } from 'lucide-react'

type Usuario = { cedula: string; nombre: string; rol: string }
const SESSION_KEY = 'almacen_usuario'

export default function CargaPage() {
  const router    = useRouter()
  const fileRef   = useRef<HTMLInputElement>(null)
  const [usuario,   setUsuario]   = useState<Usuario | null>(null)
  const [checking,  setChecking]  = useState(true)
  const [archivo,   setArchivo]   = useState<File | null>(null)
  const [cargando,  setCargando]  = useState(false)
  const [resultado, setResultado] = useState<{ cargados: number; total_filas: number; total_items: number; bodegas: string[]; mensaje: string } | null>(null)
  const [error,     setError]     = useState('')
  const [drag,      setDrag]      = useState(false)

  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUsuario(JSON.parse(s)) } catch { /* noop */ }
    setChecking(false)
  }, [])

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: '#f59e0b' }} />
    </div>
  )

  if (!usuario) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <div className="text-center">
        <p className="mb-3" style={{ color: '#ef4444' }}>Sesión no válida</p>
        <button onClick={() => router.push('/almacen')} className="text-sm underline" style={{ color: '#f59e0b' }}>
          Ir al inicio de Almacén
        </button>
      </div>
    </div>
  )

  async function cargar(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) return
    setCargando(true); setError(''); setResultado(null)
    const fd = new FormData(); fd.append('file', archivo)
    try {
      const res  = await fetch('/api/almacen/cargar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al cargar'); return }
      setResultado(data)
    } catch { setError('Error de conexión') }
    finally { setCargando(false) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setArchivo(f); setResultado(null); setError('')
    }
  }

  const cols = ['Referencia','Desc. item','Bodega','U.M.','Cant. existencia','Costo prom. uni.','Desc. tipo Inventario']
  const sample = ['11101','ACEITE ESENCIAL BERGAMOTA','001','GR','2.972,00','$235,56','MATERIAS PRIMAS']

  return (
    <main className="min-h-screen" style={{ background: '#070b14' }}>

      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid #0f1e2e', background: 'rgba(7,11,20,0.9)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => router.push('/almacen')}
          className="p-2 rounded-lg transition-all hover:bg-white/5" style={{ color: '#64748b' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="w-px h-5" style={{ background: '#1a2640' }} />
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
          <Upload size={16} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">Carga de Inventario</p>
          <p className="text-xs" style={{ color: '#475569' }}>Importar desde Excel ERP</p>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-8 pb-16">

        {/* Formato */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: '#0d1525', border: '1px solid #1a2640' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ background: '#f59e0b' }} />
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
              Formato esperado del archivo
            </p>
          </div>

          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1a2640' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#0f1e2e' }}>
                    {cols.map(h => (
                      <th key={h} className="px-3 py-2 text-left font-bold whitespace-nowrap"
                        style={{ color: '#f59e0b', borderBottom: '1px solid #1a2640' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#070b14' }}>
                    {sample.map((v, i) => (
                      <td key={i} className="px-3 py-2 whitespace-nowrap font-mono" style={{ color: '#64748b' }}>{v}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['✦', 'Mismo ítem en varias bodegas → existencias sumadas automáticamente'],
              ['✦', 'Números colombianos ($2.500,00) convertidos correctamente'],
              ['✦', 'MATERIAS PRIMAS · MATERIAL DE EMPAQUE · PRODUCTOS MANUFACTURADOS'],
              ['✦', 'Mano de Obra y Ajustes en Costo se omiten automáticamente'],
            ].map(([icon, text], i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#475569' }}>
                <span style={{ color: '#f59e0b', flexShrink: 0 }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        <form onSubmit={cargar} className="flex flex-col gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className="rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
            style={{
              background: drag ? 'rgba(245,158,11,0.05)' : '#0d1525',
              border: `2px dashed ${archivo ? '#f59e0b' : drag ? '#d97706' : '#1a2640'}`,
              minHeight: '200px',
              boxShadow: drag ? '0 0 30px rgba(245,158,11,0.1)' : 'none',
            }}>
            <div className="p-4 rounded-2xl"
              style={{ background: archivo ? 'rgba(245,158,11,0.1)' : '#070b14', border: `1px solid ${archivo ? 'rgba(245,158,11,0.3)' : '#1a2640'}` }}>
              <FileSpreadsheet size={36} style={{ color: archivo ? '#f59e0b' : '#334155' }} />
            </div>
            {archivo ? (
              <div className="text-center">
                <p className="font-bold" style={{ color: '#f59e0b' }}>{archivo.name}</p>
                <p className="text-xs mt-1" style={{ color: '#475569' }}>{(archivo.size / 1024).toFixed(1)} KB · listo para cargar</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-semibold" style={{ color: '#94a3b8' }}>Arrastra tu archivo aquí</p>
                <p className="text-xs mt-1" style={{ color: '#334155' }}>o haz clic para seleccionar · .xlsx · .xls</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); setError('') }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              <AlertTriangle size={14} className="flex-shrink-0" /> {error}
            </div>
          )}

          {resultado && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                <p className="font-bold" style={{ color: '#10b981' }}>Carga completada</p>
              </div>
              <p className="text-sm" style={{ color: '#cbd5e1' }}>{resultado.mensaje}</p>
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: '#10b981' }}>{resultado.total_items}</p>
                  <p className="text-xs" style={{ color: '#475569' }}>productos únicos</p>
                </div>
                <div className="w-px" style={{ background: '#1a2640' }} />
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: '#94a3b8' }}>{resultado.total_filas}</p>
                  <p className="text-xs" style={{ color: '#475569' }}>filas procesadas</p>
                </div>
                <div className="w-px" style={{ background: '#1a2640' }} />
                <div className="text-center">
                  <p className="text-2xl font-black" style={{ color: '#f59e0b' }}>{resultado.bodegas?.length ?? 0}</p>
                  <p className="text-xs" style={{ color: '#475569' }}>bodegas</p>
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={!archivo || cargando}
            className="flex items-center justify-center gap-2 font-black rounded-xl py-4 transition-all hover:brightness-110 disabled:opacity-30 uppercase tracking-wider text-sm"
            style={{ background: 'linear-gradient(135deg,#92400e,#b45309,#d97706)', color: 'white', boxShadow: '0 4px 20px rgba(245,158,11,0.2)' }}>
            {cargando ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {cargando ? 'Procesando archivo...' : 'Cargar al sistema'}
            {!cargando && <ChevronRight size={16} className="ml-1" />}
          </button>
        </form>
      </div>
    </main>
  )
}
