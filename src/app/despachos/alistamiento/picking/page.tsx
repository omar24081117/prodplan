'use client'

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Scan, Trash2, CheckCircle2, Loader2,
  Search, AlertTriangle, ExternalLink, Minus, Plus,
  FileText, RefreshCw,
} from 'lucide-react'

const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner'))

type Usuario    = { cedula: string; nombre: string; rol: string }
type ItemScan   = { id: string; referencia: string | null; ean13: string | null; descripcion: string | null; cantidad: number }
type ItemPedido = { referencia: string; ean13: string | null; descripcion: string; cantidad: number; escaneado: number }

const SESSION_KEY = 'alistamiento_usuario'

function PickingContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const despId  = params.get('id')
  const docNum  = params.get('doc')
  const cliente = params.get('cliente') ?? ''

  const [usuario,      setUsuario]      = useState<Usuario | null>(null)
  const [checking,     setChecking]     = useState(true)
  const [items,        setItems]        = useState<ItemScan[]>([])
  const [loading,      setLoading]      = useState(false)

  // Scanner
  const [scanOn,       setScanOn]       = useState(false)
  const [cantidad,     setCantidad]     = useState('1')
  const [inputVal,     setInputVal]     = useState('')
  const [buscando,     setBuscando]     = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Refs para closures sin stale values
  const pendingRef  = useRef<PendingItem | null>(null)
  const procesarRef = useRef<(code: string) => void>(() => {})

  // Confirmación pendiente
  type PendingItem = { code: string; referencia: string | null; ean13: string | null; descripcion: string | null; cantidad: number; enCatalogo: boolean }
  const [pending,    setPending]    = useState<PendingItem | null>(null)
  const [guardando,  setGuardando]  = useState(false)

  // Drive link
  const [driveUrl,     setDriveUrl]     = useState<string | null>(null)
  const [driveChecked, setDriveChecked] = useState(false)

  // ── Pick list desde PDF del Drive ────────────────────────────────────────
  const [itemsPedido,    setItemsPedido]    = useState<ItemPedido[]>([])
  const [cargandoPedido, setCargandoPedido] = useState(false)
  const [pedidoError,    setPedidoError]    = useState<string | null>(null)
  const pedidoCargadoRef = useRef(false)

  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUsuario(JSON.parse(s)) } catch { /* noop */ }
    setChecking(false)
  }, [])

  // ── Cargar pick list del PDF (solo primera vez) ───────────────────────
  const cargarPedido = useCallback(async (itemsActuales: ItemScan[]) => {
    if (pedidoCargadoRef.current || !docNum) return
    pedidoCargadoRef.current = true
    setCargandoPedido(true)
    setPedidoError(null)
    try {
      const res = await fetch(`/api/picking/drive-items?doc=${encodeURIComponent(docNum)}`)
      let d: Record<string, unknown> = {}
      try { d = await res.json() } catch { /* json parse fail */ }

      if (!res.ok) {
        setPedidoError(
          (d?.mensaje as string) ?? (d?.error as string) ??
          `Error ${res.status} al leer el pedido desde Drive`
        )
        return
      }

      if (d?.modo === 'no_encontrado') {
        setPedidoError('El documento no está en la carpeta de Drive')
        return
      }
      if (d?.modo === 'sin_acceso') {
        setPedidoError('Archivo encontrado pero sin acceso para descargarlo — verifica permisos de la carpeta Drive')
        return
      }
      if (d?.modo === 'sin_items' || (d?.items && (d.items as unknown[]).length === 0)) {
        setPedidoError(
          (d?.mensaje as string) ??
          'PDF leído pero no se reconocieron ítems (puede ser un PDF con imagen, no texto)'
        )
        return
      }

      if (d?.items && Array.isArray(d.items) && d.items.length > 0) {
        setItemsPedido((d.items as { referencia: string; ean13: string | null; descripcion: string; cantidad: number }[]).map(pi => ({
          ...pi,
          escaneado: itemsActuales
            .filter(i => i.referencia === pi.referencia || (pi.ean13 && i.ean13 && pi.ean13 === i.ean13))
            .reduce((s, i) => s + i.cantidad, 0),
        })))
      } else {
        setPedidoError((d?.mensaje as string) ?? (d?.error as string) ?? 'PDF sin ítems reconocibles')
      }
    } catch (err) {
      setPedidoError(`Error de conexión: ${String(err).slice(0, 80)}`)
    } finally {
      setCargandoPedido(false)
    }
  }, [docNum])

  // ── Recargar pick list manualmente ───────────────────────────────────
  async function recargarPedido() {
    pedidoCargadoRef.current = false
    setItemsPedido([])
    setPedidoError(null)
    await cargarPedido(items)
  }

  // ── Cargar items escaneados + link Drive ──────────────────────────────
  const cargar = useCallback(async () => {
    if (!despId) return
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch(`/api/picking?despacho_id=${despId}`),
      docNum ? fetch(`/api/picking/drive-link?doc=${encodeURIComponent(docNum)}`) : Promise.resolve(null),
    ])
    const data = await r1.json()
    const itemsList: ItemScan[] = Array.isArray(data) ? data : []
    setItems(itemsList)
    if (r2?.ok) {
      const d = await r2.json()
      setDriveUrl(d?.tipo === 'archivo' ? d.url : null)
    }
    setDriveChecked(true)
    setLoading(false)
    // Cargar pedido PDF tras tener la lista de escaneados (solo primera vez)
    cargarPedido(itemsList)
  }, [despId, docNum, cargarPedido])

  useEffect(() => { if (!checking && usuario) cargar() }, [checking, usuario, cargar])

  // Mantener refs actualizados
  useEffect(() => { pendingRef.current = pending }, [pending])
  useEffect(() => { procesarRef.current = procesarCodigo }, [procesarCodigo])

  // ── Captura global de teclado (lector USB / Bluetooth) ───────────────
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (!inputRef.current) return
      const active = document.activeElement as HTMLElement | null
      const enOtroInput = active && active !== inputRef.current &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
      if (enOtroInput) return
      if (pendingRef.current) return  // hay confirmación pendiente

      if (e.key === 'Enter') {
        const val = inputRef.current.value.trim()
        if (val) { e.preventDefault(); procesarRef.current(val); setInputVal('') }
        return
      }
      if (e.key === 'Backspace') {
        if (active !== inputRef.current) { e.preventDefault(); setInputVal(p => p.slice(0, -1)); inputRef.current.focus() }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (active !== inputRef.current) { e.preventDefault(); setInputVal(p => p + e.key); inputRef.current.focus() }
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [])

  // Re-foco tras confirmar / cancelar
  useEffect(() => {
    if (!pending && !buscando) setTimeout(() => inputRef.current?.focus(), 80)
  }, [pending, buscando])

  // ── Procesar código escaneado ─────────────────────────────────────────
  async function procesarCodigo(code: string) {
    const val = code.trim(); if (!val || !despId) return
    setBuscando(true); setInputVal('')

    let ref: string | null  = null
    let desc: string | null = null
    let ean: string | null  = null

    const mapRes  = await fetch(`/api/picking/ean-mapping?ean=${encodeURIComponent(val)}`)
    const mapData = await mapRes.json()
    if (mapData?.referencia) { ref = mapData.referencia; desc = mapData.descripcion }

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

    // Si la referencia existe en el pick list, usar su descripción
    if (ref && itemsPedido.length > 0) {
      const enPedido = itemsPedido.find(p => p.referencia === ref || (p.ean13 && p.ean13 === ean))
      if (enPedido) desc = enPedido.descripcion
    }

    setBuscando(false)
    setPending({
      code:        val,
      referencia:  ref ?? (!/^\d{8,14}$/.test(val) ? val : null),
      ean13:       ean ?? (/^\d{8,14}$/.test(val) ? val : null),
      descripcion: desc,
      cantidad:    parseInt(cantidad) || 1,
      enCatalogo:  !!ref,
    })
  }

  // ── Confirmar y guardar ───────────────────────────────────────────────
  async function confirmar() {
    if (!pending || !despId) return
    setGuardando(true)
    await fetch('/api/picking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        despacho_id:    despId, documento: docNum,
        referencia:     pending.referencia,
        ean13:          pending.ean13,
        descripcion:    pending.descripcion,
        cantidad:       pending.cantidad,
        usuario_cedula: usuario?.cedula,
        usuario_nombre: usuario?.nombre,
      }),
    })
    // Actualizar contadores del pick list
    if (itemsPedido.length > 0) {
      setItemsPedido(prev => prev.map(item => {
        const match =
          (pending.referencia && item.referencia === pending.referencia) ||
          (pending.ean13 && item.ean13 && pending.ean13 === item.ean13)
        return match ? { ...item, escaneado: item.escaneado + pending.cantidad } : item
      }))
    }
    setPending(null)
    setGuardando(false)
    cargar()
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function eliminar(id: string) {
    await fetch(`/api/picking?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}><Loader2 size={28} className="animate-spin text-orange-400" /></div>
  if (!usuario)  return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1a2a' }}><button onClick={() => router.push('/despachos/alistamiento')} className="text-orange-400 underline">Ir al alistamiento</button></div>

  const total = items.reduce((s, i) => s + i.cantidad, 0)

  // Estadísticas del pick list
  const totalEsperado = itemsPedido.reduce((s, i) => s + i.cantidad, 0)
  const totalEscaneado = itemsPedido.reduce((s, i) => s + Math.min(i.escaneado, i.cantidad), 0)
  const pctPedido = totalEsperado > 0 ? Math.round((totalEscaneado / totalEsperado) * 100) : 0
  const itemsCompletos = itemsPedido.filter(i => i.escaneado >= i.cantidad).length

  // Extras: escaneados que no están en el pedido
  const extrasEscaneados = itemsPedido.length > 0
    ? items.filter(i => !itemsPedido.some(p =>
        p.referencia === i.referencia || (p.ean13 && i.ean13 && p.ean13 === i.ean13)))
    : []

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

        {/* Progreso pick list */}
        {itemsPedido.length > 0 && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-20 bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full transition-all"
                style={{ width: `${pctPedido}%`, background: pctPedido === 100 ? '#4ade80' : '#3b82f6' }} />
            </div>
            <span className="text-xs font-black" style={{ color: pctPedido === 100 ? '#4ade80' : '#60a5fa' }}>
              {pctPedido}%
            </span>
          </div>
        )}

        {/* Estado Drive */}
        {driveChecked && (
          driveUrl
            ? <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold"
                style={{ background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.3)', color: '#4285f4' }}>
                <ExternalLink size={13} /> Drive
              </a>
            : <span className="text-xs px-2 py-1.5 rounded-lg font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                📄 No registrado
              </span>
        )}
        <span className="text-sm font-black px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(234,88,12,0.2)', border: '1px solid rgba(234,88,12,0.4)', color: '#fb923c' }}>
          {total} uds
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* ═══ IZQUIERDA: Scanner ══════════════════════════════════════════ */}
        <div className="lg:w-[340px] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-y-auto">

          <div className="p-4 border-b border-gray-800">
            <p className="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Scan size={14} className="text-sky-400" /> Escanear producto
            </p>

            {typeof window !== 'undefined' && (
              <Suspense fallback={<div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-sky-400" /></div>}>
                <BarcodeScanner active={scanOn} onToggle={() => setScanOn(v => !v)} onDetected={procesarCodigo} />
              </Suspense>
            )}

            {/* Buscando */}
            {buscando && (
              <div className="mt-3 rounded-xl p-4 flex items-center gap-3"
                style={{ background: '#0f2035', border: '1px solid #1a4060' }}>
                <Loader2 size={20} className="animate-spin text-sky-400 flex-shrink-0" />
                <p className="text-sky-300 text-sm font-semibold">Identificando producto...</p>
              </div>
            )}

            {/* Tarjeta de confirmación */}
            {pending && !buscando && (() => {
              const enPedido = itemsPedido.length > 0
                ? itemsPedido.find(p =>
                    (pending.referencia && p.referencia === pending.referencia) ||
                    (pending.ean13 && p.ean13 && pending.ean13 === p.ean13))
                : null
              const yaCompleto = enPedido && enPedido.escaneado >= enPedido.cantidad
              return (
                <div className="mt-3 rounded-2xl overflow-hidden"
                  style={{ border: `2px solid ${yaCompleto ? '#f59e0b' : pending.enCatalogo ? '#22c55e' : '#f59e0b'}`, background: yaCompleto ? '#1c0a00' : pending.enCatalogo ? '#052e16' : '#1c1000' }}>

                  <div className="px-4 py-2 flex items-center gap-2"
                    style={{ background: yaCompleto ? 'rgba(245,158,11,0.15)' : pending.enCatalogo ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {yaCompleto
                      ? <AlertTriangle size={14} className="text-yellow-400" />
                      : pending.enCatalogo
                        ? <CheckCircle2 size={14} className="text-green-400" />
                        : <AlertTriangle size={14} className="text-yellow-400" />}
                    <p className="text-xs font-bold" style={{ color: yaCompleto ? '#fbbf24' : pending.enCatalogo ? '#4ade80' : '#fbbf24' }}>
                      {yaCompleto
                        ? '⚠ Ya completado en pedido'
                        : pending.enCatalogo
                          ? enPedido ? `En pedido: ${enPedido.escaneado}/${enPedido.cantidad} uds` : 'Producto identificado'
                          : 'No está en catálogo — se registrará igual'}
                    </p>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-white font-black text-base leading-tight">
                      {pending.descripcion ?? pending.referencia ?? pending.code}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      {pending.referencia && <span className="font-mono">REF: <span className="text-gray-300">{pending.referencia}</span></span>}
                      {pending.ean13 && <span className="font-mono">EAN: <span className="text-gray-400">{pending.ean13}</span></span>}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-sm text-gray-400 font-semibold">Cantidad:</span>
                      <button onClick={() => setPending(p => p ? { ...p, cantidad: Math.max(1, p.cantidad - 1) } : p)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg"
                        style={{ background: '#1e293b', color: '#94a3b8' }}>—</button>
                      <span className="text-3xl font-black text-orange-300 w-12 text-center">{pending.cantidad}</span>
                      <button onClick={() => setPending(p => p ? { ...p, cantidad: p.cantidad + 1 } : p)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg"
                        style={{ background: '#1e293b', color: '#94a3b8' }}>+</button>
                    </div>
                  </div>

                  <div className="flex gap-2 px-4 pb-4">
                    <button onClick={() => setPending(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
                      Cancelar
                    </button>
                    <button onClick={confirmar} disabled={guardando}
                      className="flex-[2] py-2.5 rounded-xl text-base font-black flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#14532d,#166534)', border: '1px solid #4ade80', color: 'white' }}>
                      {guardando ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : <><CheckCircle2 size={18} /> OK — Agregar</>}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Input manual / USB / Bluetooth */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-500">Manual / Lector USB · Bluetooth</label>
                <span className={`flex items-center gap-1 text-xs font-semibold ${inputFocused ? 'text-green-400' : 'text-gray-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${inputFocused ? 'bg-green-400 animate-pulse' : 'bg-gray-700'}`} />
                  {inputFocused ? 'Listo' : 'Sin foco'}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef} type="text" value={inputVal} autoFocus
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && inputVal.trim()) { e.preventDefault(); procesarCodigo(inputVal) } }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="EAN13 o REF → Enter"
                  className="flex-1 rounded-xl px-4 py-3 text-base font-mono font-bold focus:outline-none"
                  style={{
                    background: '#070d18',
                    border: `2px solid ${inputFocused ? '#22c55e' : inputVal ? '#0ea5e9' : '#1a4060'}`,
                    color: '#f1f5f9',
                    boxShadow: inputFocused ? '0 0 0 3px rgba(34,197,94,0.12)' : 'none',
                  }}
                />
                <button onClick={() => { if (inputVal.trim()) procesarCodigo(inputVal) }} disabled={buscando || !inputVal.trim()}
                  className="px-3 rounded-xl disabled:opacity-40" style={{ background: '#1a4060', color: '#60a5fa' }}>
                  {buscando ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-700 mt-1.5">
                💡 El campo debe estar en verde para que el lector funcione
              </p>
            </div>

            {/* Cantidad por escaneo */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-gray-500">Cantidad por escaneo:</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCantidad(c => String(Math.max(1, parseInt(c)-1)))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1e293b', color: '#94a3b8' }}>
                  <Minus size={13} />
                </button>
                <span className="text-lg font-black w-8 text-center text-orange-300">{cantidad}</span>
                <button onClick={() => setCantidad(c => String(parseInt(c)+1))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1e293b', color: '#94a3b8' }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ DERECHA: Pick list / Ítems escaneados ══════════════════════ */}
        <div className="flex-1 flex flex-col min-h-[250px] overflow-hidden">

          {/* ── Cabecera del panel derecho ── */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{ background: '#0a1525', borderBottom: '1px solid #1a3050' }}>
            {itemsPedido.length > 0 ? (
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <FileText size={14} className="text-sky-400" />
                    Pedido · <span className="text-sky-300">{docNum}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {itemsCompletos}/{itemsPedido.length} ítems completos · {totalEscaneado}/{totalEsperado} uds
                  </p>
                </div>
                {/* Barra progreso */}
                <div className="flex-1 flex items-center gap-2 max-w-[140px]">
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${pctPedido}%`, background: pctPedido === 100 ? '#4ade80' : '#3b82f6' }} />
                  </div>
                  <span className="text-xs font-black whitespace-nowrap"
                    style={{ color: pctPedido === 100 ? '#4ade80' : '#60a5fa' }}>{pctPedido}%</span>
                </div>
              </div>
            ) : cargandoPedido ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-sky-400" />
                <p className="text-sm text-sky-300 font-semibold">Leyendo pedido desde Drive...</p>
              </div>
            ) : pedidoError ? (
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-orange-400 flex-shrink-0" />
                  <p className="text-xs text-orange-300 font-semibold">No se pudo leer el pedido</p>
                  <button onClick={recargarPedido}
                    className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-sky-400 hover:text-sky-300 flex-shrink-0"
                    style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    <RefreshCw size={11} /> Reintentar
                  </button>
                </div>
                <p className="text-[10px] text-orange-600 line-clamp-2 pl-5">{pedidoError}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <p className="text-sm font-bold text-white">Ítems alistados</p>
                {driveUrl && (
                  <button onClick={recargarPedido}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-sky-400 hover:text-sky-300"
                    style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    <FileText size={11} /> Cargar pedido
                  </button>
                )}
              </div>
            )}
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap flex-shrink-0">
              {items.length} refs · {total} uds
            </span>
          </div>

          {/* ── Contenido ── */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading && itemsPedido.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-orange-400" /></div>

            ) : itemsPedido.length > 0 ? (
              /* ── MODO PICK LIST ─────────────────────────────────────── */
              <div className="flex flex-col gap-1.5">
                {itemsPedido.map(item => {
                  const completo  = item.escaneado >= item.cantidad
                  const parcial   = item.escaneado > 0 && item.escaneado < item.cantidad
                  const exceso    = item.escaneado > item.cantidad
                  const pctItem   = item.cantidad > 0 ? Math.min(100, Math.round((item.escaneado / item.cantidad) * 100)) : 0
                  return (
                    <div key={item.referencia}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{
                        background: completo ? '#052e16' : parcial ? '#1c1000' : '#0f1e30',
                        border: `1px solid ${completo ? '#166534' : parcial ? '#92400e' : '#1a3050'}`,
                      }}>
                      {/* Indicador */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                        style={{
                          background: completo ? 'rgba(34,197,94,0.2)' : parcial ? 'rgba(234,88,12,0.15)' : '#0d1a2a',
                          color: completo ? '#4ade80' : parcial ? '#fb923c' : '#475569',
                          border: `1px solid ${completo ? 'rgba(34,197,94,0.3)' : parcial ? 'rgba(234,88,12,0.25)' : '#1a3050'}`,
                        }}>
                        {completo ? <CheckCircle2 size={18} /> : item.escaneado > 0 ? item.escaneado : '—'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{item.descripcion}</p>
                        <div className="flex gap-2 text-xs mt-0.5">
                          <span className="text-gray-500 font-mono">REF: <span className="text-gray-400">{item.referencia}</span></span>
                          {item.ean13 && <span className="text-gray-600 font-mono">{item.ean13}</span>}
                        </div>
                        {/* Mini barra */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 bg-gray-800 rounded-full h-1">
                            <div className="h-1 rounded-full transition-all"
                              style={{ width: `${pctItem}%`, background: completo ? '#4ade80' : '#3b82f6' }} />
                          </div>
                          <span className="text-[10px] text-gray-600">{pctItem}%</span>
                        </div>
                      </div>

                      {/* Cantidad */}
                      <div className="text-right flex-shrink-0 pl-2">
                        <p className={`text-base font-black ${completo ? 'text-green-400' : exceso ? 'text-orange-400' : parcial ? 'text-yellow-400' : 'text-gray-600'}`}>
                          {item.escaneado}
                          <span className="text-gray-600 text-xs font-normal">/{item.cantidad}</span>
                        </p>
                        <p className="text-xs text-gray-700">uds</p>
                      </div>
                    </div>
                  )
                })}

                {/* Extras — no estaban en el pedido */}
                {extrasEscaneados.length > 0 && (
                  <>
                    <div className="mt-3 mb-1 px-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-400">
                      <AlertTriangle size={11} /> Extras — no están en el pedido ({extrasEscaneados.length})
                    </div>
                    {extrasEscaneados.map(item => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.2)' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                          style={{ background: 'rgba(234,88,12,0.15)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
                          {item.cantidad}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-orange-200 text-sm font-semibold truncate">{item.descripcion ?? item.referencia ?? item.ean13}</p>
                          <div className="flex gap-2 text-xs mt-0.5">
                            {item.referencia && <span className="text-orange-600 font-mono">REF: {item.referencia}</span>}
                            {item.ean13 && <span className="text-orange-700 font-mono">{item.ean13}</span>}
                          </div>
                        </div>
                        <button onClick={() => eliminar(item.id)}
                          className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-900/20">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

            ) : items.length === 0 ? (
              /* ── SIN ÍTEMS AÚN ──────────────────────────────────────── */
              <div className="text-center py-16">
                <Scan size={48} strokeWidth={1} className="mx-auto mb-3 text-gray-800" />
                <p className="text-gray-600 text-sm font-semibold">Empieza a escanear</p>
                <p className="text-gray-700 text-xs mt-1">Activa la cámara o usa el lector Bluetooth</p>
              </div>

            ) : (
              /* ── MODO SOLO ESCANEADOS (sin pedido PDF) ──────────────── */
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
                      className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-900/20">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {(items.length > 0 || itemsPedido.length > 0) && (
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
                    <ExternalLink size={14} /> Ver pedido
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
