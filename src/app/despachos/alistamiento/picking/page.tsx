'use client'

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Scan, Plus, Trash2, CheckCircle2, Loader2,
  Package, Search, AlertTriangle, ExternalLink, Minus
} from 'lucide-react'

const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner'))

type Usuario    = { cedula: string; nombre: string; rol: string }
type ItemScan   = { id: string; referencia: string | null; ean13: string | null; descripcion: string | null; cantidad: number }

const SESSION_KEY = 'alistamiento_usuario'
const FOLDER_URL  = 'https://drive.google.com/drive/folders/19jEydHTzraB4z_ghR-vdk7LGPT--KFHB'

function PickingContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const despId  = params.get('id')
  const docNum  = params.get('doc')
  const cliente = params.get('cliente') ?? ''

  const [usuario,     setUsuario]     = useState<Usuario | null>(null)
  const [checking,    setChecking]    = useState(true)
  const [items,       setItems]       = useState<ItemScan[]>([])
  const [loading,     setLoading]     = useState(false)

  // Scanner
  const [scanOn,      setScanOn]      = useState(false)
  const [cantidad,    setCantidad]    = useState('1')
  const [inputVal,    setInputVal]    = useState('')
  const [buscando,    setBuscando]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Confirmación pendiente antes de agregar al listado
  type PendingItem = { code: string; referencia: string | null; ean13: string | null; descripcion: string | null; cantidad: number; enCatalogo: boolean }
  const [pending,     setPending]     = useState<PendingItem | null>(null)
  const [guardando,   setGuardando]   = useState(false)

  // Drive link
  const [driveUrl,    setDriveUrl]    = useState<string | null>(null)
  const [driveChecked, setDriveChecked] = useState(false) // ya buscó en Drive

  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUsuario(JSON.parse(s)) } catch { /* noop */ }
    setChecking(false)
  }, [])

  // Cargar items ya registrados + link de Drive
  const cargar = useCallback(async () => {
    if (!despId) return
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch(`/api/picking?despacho_id=${despId}`),
      docNum ? fetch(`/api/picking/drive-link?doc=${encodeURIComponent(docNum)}`) : Promise.resolve(null),
    ])
    const data = await r1.json()
    setItems(Array.isArray(data) ? data : [])
    if (r2?.ok) {
      const d = await r2.json()
      setDriveUrl(d?.tipo === 'archivo' ? d.url : null)
    }
    setDriveChecked(true)
    setLoading(false)
  }, [despId, docNum])

  useEffect(() => { if (!checking && usuario) cargar() }, [checking, usuario, cargar])

  // ── Procesar código: buscar y MOSTRAR CONFIRMACIÓN ───────────────────────
  async function procesarCodigo(code: string) {
    const val = code.trim(); if (!val || !despId) return
    setBuscando(true); setInputVal('')

    let ref: string | null  = null
    let desc: string | null = null
    let ean: string | null  = null

    // 1. Mapeo físico
    const mapRes  = await fetch(`/api/picking/ean-mapping?ean=${encodeURIComponent(val)}`)
    const mapData = await mapRes.json()
    if (mapData?.referencia) { ref = mapData.referencia; desc = mapData.descripcion }

    // 2. Catálogo EAN (con variantes EAN-14)
    if (!ref) {
      const isEan   = /^\d{8,14}$/.test(val)
      const variants = [val, ...(val.length === 14 ? [val.slice(1)] : [])]
      for (const v of variants) {
        const res  = await fetch(`/api/productos-ean?${isEan ? 'ean' : 'ref'}=${encodeURIComponent(v)}`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          ref = data[0].referencia; desc = data[0].descripcion; ean = data[0].ean13; break
        }
      }
    }

    setBuscando(false)

    // Mostrar tarjeta de confirmación en lugar de guardar directo
    setPending({
      code:        val,
      referencia:  ref ?? (!/^\d{8,14}$/.test(val) ? val : null),
      ean13:       ean ?? (/^\d{8,14}$/.test(val) ? val : null),
      descripcion: desc,
      cantidad:    parseInt(cantidad) || 1,
      enCatalogo:  !!ref,
    })
  }

  // ── Confirmar y guardar en el listado ─────────────────────────────────────
  async function confirmar() {
    if (!pending || !despId) return
    setGuardando(true)
    await fetch('/api/picking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        despacho_id:   despId, documento: docNum,
        referencia:    pending.referencia,
        ean13:         pending.ean13,
        descripcion:   pending.descripcion,
        cantidad:      pending.cantidad,
        usuario_cedula: usuario?.cedula,
        usuario_nombre: usuario?.nombre,
      }),
    })
    setPending(null)
    setGuardando(false)
    cargar()
    inputRef.current?.focus()
  }

  async function eliminar(id: string) {
    await fetch(`/api/picking?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}><Loader2 size={28} className="animate-spin text-orange-400" /></div>
  if (!usuario) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}><button onClick={() => router.push('/despachos/alistamiento')} className="text-orange-400 underline">Ir al alistamiento</button></div>

  const total = items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#0d1a2a', color: '#e2e8f0' }}>

      {/* HEADER */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #1a4060', background: '#0a1525' }}>
        <button onClick={() => router.push('/despachos/alistamiento')}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800"><ArrowLeft size={18} /></button>
        <Scan size={18} className="text-orange-400" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Picking · <span className="text-orange-300">{docNum}</span></p>
          <p className="text-gray-500 text-xs truncate">{cliente}</p>
        </div>
        {/* Estado Drive */}
        {driveChecked && (
          driveUrl
            ? <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.3)', color: '#4285f4' }}>
                <ExternalLink size={13} /> Ver en Drive
              </a>
            : <span className="text-xs px-3 py-2 rounded-lg font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                📄 Documento no registrado
              </span>
        )}
        <span className="text-sm font-black px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.4)', color: '#fb923c' }}>
          {total} uds
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* ═══ IZQUIERDA: Scanner ═══════════════════════════════════════════ */}
        <div className="lg:w-[360px] flex-shrink-0 border-r border-gray-800 flex flex-col gap-0 overflow-y-auto">

          {/* Scanner */}
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Scan size={14} className="text-sky-400" /> Escanear producto
            </p>

            {typeof window !== 'undefined' && (
              <Suspense fallback={<div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-sky-400" /></div>}>
                <BarcodeScanner active={scanOn} onToggle={() => setScanOn(v => !v)} onDetected={procesarCodigo} />
              </Suspense>
            )}

            {/* ── TARJETA DE CONFIRMACIÓN ── */}
            {buscando && (
              <div className="mt-3 rounded-xl p-4 flex items-center gap-3" style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
                <Loader2 size={20} className="animate-spin text-sky-400 flex-shrink-0" />
                <p className="text-sky-300 text-sm font-semibold">Identificando producto...</p>
              </div>
            )}

            {pending && !buscando && (
              <div className="mt-3 rounded-2xl overflow-hidden"
                style={{ border: `2px solid ${pending.enCatalogo ? '#22c55e' : '#f59e0b'}`, background: pending.enCatalogo ? '#052e16' : '#1c1000' }}>

                {/* Header */}
                <div className="px-4 py-2 flex items-center gap-2"
                  style={{ background: pending.enCatalogo ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', borderBottom: `1px solid ${pending.enCatalogo ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                  {pending.enCatalogo
                    ? <CheckCircle2 size={14} className="text-green-400" />
                    : <AlertTriangle size={14} className="text-yellow-400" />}
                  <p className="text-xs font-bold" style={{ color: pending.enCatalogo ? '#4ade80' : '#fbbf24' }}>
                    {pending.enCatalogo ? 'Producto identificado' : 'No está en catálogo — se registrará igual'}
                  </p>
                </div>

                {/* Producto */}
                <div className="px-4 py-3">
                  <p className="text-white font-black text-base leading-tight">
                    {pending.descripcion ?? pending.referencia ?? pending.code}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    {pending.referencia && <span className="font-mono">REF: <span className="text-gray-300">{pending.referencia}</span></span>}
                    {pending.ean13 && <span className="font-mono">EAN: <span className="text-gray-400">{pending.ean13}</span></span>}
                  </div>

                  {/* Cantidad */}
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-sm text-gray-400 font-semibold">Cantidad:</span>
                    <button onClick={() => setPending(p => p ? { ...p, cantidad: Math.max(1, p.cantidad - 1) } : p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg transition-all hover:brightness-125"
                      style={{ background: '#1e293b', color: '#94a3b8' }}>—</button>
                    <span className="text-3xl font-black text-orange-300 w-12 text-center">{pending.cantidad}</span>
                    <button onClick={() => setPending(p => p ? { ...p, cantidad: p.cantidad + 1 } : p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg transition-all hover:brightness-125"
                      style={{ background: '#1e293b', color: '#94a3b8' }}>+</button>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-2 px-4 pb-4">
                  <button onClick={() => setPending(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
                    Cancelar
                  </button>
                  <button onClick={confirmar} disabled={guardando}
                    className="flex-[2] py-2.5 rounded-xl text-base font-black flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80', color: 'white' }}>
                    {guardando
                      ? <><Loader2 size={18} className="animate-spin" /> Guardando...</>
                      : <><CheckCircle2 size={18} /> OK — Agregar</>}
                  </button>
                </div>
              </div>
            )}

            {/* Input manual / Bluetooth */}
            <div className="mt-3">
              <label className="text-xs text-gray-500 block mb-1.5">Manual / Lector Bluetooth</label>
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={inputVal} inputMode="numeric" autoComplete="off"
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && inputVal.trim()) procesarCodigo(inputVal) }}
                  placeholder="EAN13 o REF → Enter"
                  className="flex-1 rounded-xl px-4 py-3 text-base font-mono font-bold focus:outline-none"
                  style={{ background: '#070d18', border: `2px solid ${inputVal ? '#0ea5e9' : '#1a4060'}`, color: '#f1f5f9' }}
                />
                <button onClick={() => { if (inputVal.trim()) procesarCodigo(inputVal) }} disabled={buscando || !inputVal.trim()}
                  className="px-3 rounded-xl disabled:opacity-40 transition-all hover:brightness-110"
                  style={{ background: '#1a4060', color: '#60a5fa' }}>
                  {buscando ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </div>

            {/* Cantidad */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-gray-500">Cantidad por escaneo:</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCantidad(c => String(Math.max(1, parseInt(c)-1)))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: '#1e293b', color: '#94a3b8' }}>
                  <Minus size={13} />
                </button>
                <span className="text-lg font-black w-8 text-center text-orange-300">{cantidad}</span>
                <button onClick={() => setCantidad(c => String(parseInt(c)+1))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: '#1e293b', color: '#94a3b8' }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ DERECHA: Lista de ítems escaneados ══════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-[250px]">
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{ background: '#0a1525', borderBottom: '1px solid #1a3050' }}>
            <p className="text-sm font-bold text-white">Ítems alistados</p>
            <span className="text-xs text-gray-500">{items.length} productos · {total} uds</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-orange-400" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-16">
                <Scan size={48} strokeWidth={1} className="mx-auto mb-3 text-gray-800" />
                <p className="text-gray-600 text-sm font-semibold">Empieza a escanear</p>
                <p className="text-gray-700 text-xs mt-1">Activa la cámara o usa el lector Bluetooth</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: i%2===0 ? '#0f2035' : '#0d1a2a', border: '1px solid #1a3050' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-base flex-shrink-0"
                      style={{ background: 'rgba(234,88,12,0.2)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
                      {item.cantidad}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {item.descripcion ?? item.referencia ?? item.ean13 ?? '—'}
                      </p>
                      <div className="flex gap-2 text-xs text-gray-600 mt-0.5">
                        {item.referencia && <span className="font-mono">REF: {item.referencia}</span>}
                        {item.ean13 && <span className="font-mono">{item.ean13}</span>}
                      </div>
                    </div>
                    <button onClick={() => eliminar(item.id)}
                      className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-900/20 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="p-3 border-t border-gray-800 flex items-center justify-between flex-shrink-0"
              style={{ background: '#0a1525' }}>
              <div>
                <p className="text-xs text-gray-500">Total alistado</p>
                <p className="text-xl font-black text-orange-300">{total} <span className="text-gray-600 text-sm font-normal">uds · {items.length} refs</span></p>
              </div>
              <div className="flex gap-2">
                {driveUrl && (
                  <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.3)', color: '#4285f4' }}>
                    <ExternalLink size={14} /> Ver pedido Drive
                  </a>
                )}
                <button onClick={() => router.push('/despachos/alistamiento')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm"
                  style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80', color: '#86efac' }}>
                  <CheckCircle2 size={16} /> Finalizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function PickingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}><Loader2 size={28} className="animate-spin text-orange-400" /></div>}>
      <PickingContent />
    </Suspense>
  )
}
