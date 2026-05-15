'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

type Operario = { id: string; cedula: string; nombre: string; activo: boolean }

export default function PersonalPage() {
  const [personal, setPersonal] = useState<Operario[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ cedula: '', nombre: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/personal')
    const data = await res.json()
    setPersonal(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = personal.filter(p =>
    p.cedula.includes(busqueda) ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: form.cedula.trim(), nombre: form.nombre.trim() }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al guardar')
    else { setShowForm(false); setForm({ cedula: '', nombre: '' }); cargar() }
    setSaving(false)
  }

  async function toggleActivo(op: Operario) {
    const accion = op.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿${accion} a ${op.nombre}?`)) return
    await fetch(`/api/personal/${op.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !op.activo }),
    })
    cargar()
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws)
    const payload = rows
      .filter(r => r.Cédula || r.cedula || r.CEDULA)
      .map(r => ({
        cedula: String(r.Cédula || r.cedula || r.CEDULA).trim(),
        nombre: String(r.Nombre || r.nombre || r.NOMBRE || '').trim(),
        activo: true,
      }))

    if (payload.length === 0) { alert('No se encontraron filas válidas (columnas: Cédula, Nombre)'); return }

    await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    cargar()
    if (fileRef.current) fileRef.current.value = ''
  }

  function exportar() {
    const ws = XLSX.utils.json_to_sheet(
      personal.filter(p => p.activo).map(p => ({ Cédula: p.cedula, Nombre: p.nombre }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personal')
    XLSX.writeFile(wb, 'personal_prodplan.xlsx')
  }

  const activos = filtrados.filter(p => p.activo)
  const inactivos = filtrados.filter(p => !p.activo)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">Personal</h1>
        <div className="flex gap-2 flex-wrap">
          <label className="cursor-pointer text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">
            📥 Importar Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
          </label>
          <button onClick={exportar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">📤 Exportar</button>
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-lg">+ Agregar</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={guardar} className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Cédula *</label>
            <input type="text" inputMode="numeric" required value={form.cedula}
              onChange={e => setForm(f => ({ ...f, cedula: e.target.value }))}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm w-36 focus:outline-none" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-gray-400 text-xs block mb-1">Nombre completo *</label>
            <input type="text" required value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
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
        placeholder="Buscar por nombre o cédula..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-blue-500"
      />

      <p className="text-gray-500 text-xs mb-2">{activos.length} activos · {inactivos.length} inactivos</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No hay operarios</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Cédula</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Nombre</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {[...activos, ...inactivos].map(p => (
                <tr key={p.id} className={`border-b border-gray-800/50 ${!p.activo ? 'opacity-50' : 'hover:bg-gray-800/30'}`}>
                  <td className="px-4 py-2.5 text-gray-300 font-mono">{p.cedula}</td>
                  <td className="px-4 py-2.5 text-white">{p.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded ${p.activo ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => toggleActivo(p)} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-800">
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
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
