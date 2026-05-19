'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

type Producto = { id: string; sku: string; nombre: string }

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ sku: '', nombre: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargaMsg, setCargaMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/catalogo')
    const data = await res.json()
    setProductos(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = productos.filter(p =>
    p.sku.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: form.sku.trim(), nombre: form.nombre.trim() }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al guardar')
    else { setShowForm(false); setForm({ sku: '', nombre: '' }); cargar() }
    setSaving(false)
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    await fetch(`/api/catalogo/${id}`, { method: 'DELETE' })
    cargar()
  }

  async function eliminarTodo() {
    if (!confirm(`¿Eliminar todos los ${productos.length} productos del catálogo? Esta acción no se puede deshacer.`)) return
    const res = await fetch('/api/catalogo', { method: 'DELETE' })
    if (res.ok) { setCargaMsg('✓ Catálogo eliminado'); cargar() }
    else { const d = await res.json(); setCargaMsg('❌ ' + (d.error || 'Error al eliminar')) }
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCargando(true)
    setCargaMsg('')
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws)
      const raw = rows
        .filter(r => r.SKU || r.sku)
        .map(r => ({ sku: String(r.SKU || r.sku).trim(), nombre: String(r.Nombre || r.nombre || '').trim() }))
        .filter(r => r.sku)

      // Deduplicar por SKU (quedarse con la última aparición)
      const seen = new Map<string, { sku: string; nombre: string }>()
      for (const r of raw) seen.set(r.sku, r)
      const payload = Array.from(seen.values())

      if (payload.length === 0) { setCargaMsg('❌ No se encontraron filas válidas. Verifica que tenga columnas SKU y Nombre.'); return }

      const res = await fetch('/api/catalogo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setCargaMsg(`✓ ${payload.length} productos cargados correctamente`)
        cargar()
      } else {
        const d = await res.json()
        setCargaMsg('❌ ' + (d.error || 'Error al cargar'))
      }
    } catch {
      setCargaMsg('❌ Error al leer el archivo')
    } finally {
      setCargando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function descargarPlantilla() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Nombre'],
      ['1001', 'NAT CREM HUME COCO GUAY X 1LT'],
      ['10005', 'NAT JABO LIQU COCO GUAY X 1LT'],
      ['9081', 'BLK JABON LIQ COC GUAY'],
    ])
    ws['!cols'] = [{ wch: 10 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Catalogo')
    XLSX.writeFile(wb, 'plantilla_catalogo.xlsx')
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">Catálogo de productos</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={descargarPlantilla}
            className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm px-3 py-2 rounded-lg transition-colors"
            style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
            ⬇ Descargar plantilla
          </button>
          <label className="cursor-pointer flex items-center gap-1.5 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#2e6e20,#3d8830)', border: '1px solid #5aaa40' }}>
            ⬆ Cargar
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importarExcel} className="hidden" />
          </label>
          <button onClick={() => setShowForm(!showForm)}
            className="text-gray-300 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
            + Agregar
          </button>
          <button onClick={eliminarTodo}
            className="text-red-400 hover:text-red-300 text-sm px-3 py-2 rounded-lg transition-colors"
            style={{ background: '#1e1010', border: '1px solid #6a2020' }}>
            🗑 Eliminar lista actual
          </button>
        </div>
      </div>

      {cargando && <p className="text-gray-400 text-sm mt-2">Cargando productos...</p>}
      {cargaMsg && !cargando && (
        <p className={`text-sm mt-2 ${cargaMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{cargaMsg}</p>
      )}

      {showForm && (
        <form onSubmit={guardar} className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-gray-400 text-xs block mb-1">SKU *</label>
            <input type="text" required value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
              placeholder="Ej: 1001"
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm w-28 focus:outline-none" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-gray-400 text-xs block mb-1">Nombre *</label>
            <input type="text" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre del producto"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
          {error && <p className="text-red-400 text-xs w-full">{error}</p>}
          <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-sm px-2">Cancelar</button>
        </form>
      )}

      <input
        type="text"
        placeholder="Buscar por SKU o nombre..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-blue-500"
      />

      <p className="text-gray-500 text-xs mb-2">{filtrados.length} productos</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No hay productos</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">SKU</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-gray-300 font-mono">{p.sku}</td>
                  <td className="px-4 py-2.5 text-white">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => eliminar(p.id, p.nombre)} className="text-gray-500 hover:text-red-400 text-xs">🗑️</button>
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
