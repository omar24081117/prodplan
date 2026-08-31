'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

const ROLES = [
  'Operario',
  'Administrativo',
  'Analista',
  'Supervisor',
  'Almacenista',
  'Mensajero',
  'Comercial',
  'Director',
  'Gerencia',
] as const
type Rol = typeof ROLES[number]

const ROL_COLORS: Record<string, string> = {
  Operario:       'bg-blue-900/50 text-blue-300',
  Administrativo: 'bg-purple-900/50 text-purple-300',
  Analista:       'bg-cyan-900/50 text-cyan-300',
  Supervisor:     'bg-yellow-900/50 text-yellow-300',
  Almacenista:    'bg-orange-900/50 text-orange-300',
  Mensajero:      'bg-teal-900/50 text-teal-300',
  Comercial:      'bg-pink-900/50 text-pink-300',
  Director:       'bg-red-900/50 text-red-300',
  Gerencia:       'bg-emerald-900/50 text-emerald-300',
}

type TipoContrato = 'Fijo' | 'Temporal'
const TIPOS_CONTRATO: TipoContrato[] = ['Fijo', 'Temporal']
const CONTRATO_COLORS: Record<string, string> = {
  Fijo:     'bg-emerald-900/50 text-emerald-300',
  Temporal: 'bg-amber-900/50 text-amber-300',
}

type Operario = { id: string; cedula: string; nombre: string; activo: boolean; rol: Rol; rol_secundario: Rol | null; tipo_contrato: TipoContrato | null }

export default function PersonalPage() {
  const [personal, setPersonal]   = useState<Operario[]>([])
  const [busqueda, setBusqueda]   = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [form, setForm]           = useState({ cedula: '', nombre: '', rol: 'Operario' as Rol, tipo_contrato: 'Fijo' as TipoContrato })
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [editandoRol, setEditandoRol]                   = useState<string | null>(null)
  const [editandoRolSec, setEditandoRolSec]             = useState<string | null>(null)
  const [editandoContrato, setEditandoContrato]         = useState<string | null>(null)
  const [filtroContrato, setFiltroContrato]       = useState('')
  const [esDirector, setEsDirector]               = useState(false)
  const [editandoNombre, setEditandoNombre]       = useState<string | null>(null)
  const [nombreTemp, setNombreTemp]               = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEsDirector(true) // RRHH tiene permisos completos
  }, [])

  const cargar = useCallback(async () => {
    const res  = await fetch('/api/personal')
    const data = await res.json()
    setPersonal(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = personal.filter(p => {
    const matchBusqueda  = p.cedula.includes(busqueda) || p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchRol       = !filtroRol      || p.rol === filtroRol
    const matchContrato  = !filtroContrato || (p.tipo_contrato ?? 'Fijo') === filtroContrato
    return matchBusqueda && matchRol && matchContrato
  })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: form.cedula.trim(), nombre: form.nombre.trim(), rol: form.rol, tipo_contrato: form.tipo_contrato }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Error al guardar')
    else { setShowForm(false); setForm({ cedula: '', nombre: '', rol: 'Operario', tipo_contrato: 'Fijo' }); cargar() }
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

  async function cambiarRol(op: Operario, nuevoRol: Rol) {
    setEditandoRol(op.id)
    await fetch(`/api/personal/${op.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol: nuevoRol }),
    })
    setPersonal(prev => prev.map(p => p.id === op.id ? { ...p, rol: nuevoRol } : p))
    setEditandoRol(null)
  }

  async function cambiarRolSecundario(op: Operario, valor: string) {
    const rolSec = valor === '' ? null : valor as Rol
    setEditandoRolSec(op.id)
    await fetch(`/api/personal/${op.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol_secundario: rolSec }),
    })
    setPersonal(prev => prev.map(p => p.id === op.id ? { ...p, rol_secundario: rolSec } : p))
    setEditandoRolSec(null)
  }

  async function cambiarContrato(op: Operario, nuevoTipo: TipoContrato) {
    setEditandoContrato(op.id)
    const res = await fetch(`/api/personal/${op.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_contrato: nuevoTipo }),
    })
    if (res.ok) {
      setPersonal(prev => prev.map(p => p.id === op.id ? { ...p, tipo_contrato: nuevoTipo } : p))
    } else {
      const err = await res.json().catch(() => ({}))
      setError(err.error || 'No se pudo guardar. Ejecuta el SQL de migración en Supabase.')
    }
    setEditandoContrato(null)
  }

  async function cambiarNombre(op: Operario, nuevoNombre: string) {
    const nombre = nuevoNombre.trim()
    if (!nombre || nombre === op.nombre) { setEditandoNombre(null); return }
    await fetch(`/api/personal/${op.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    setPersonal(prev => prev.map(p => p.id === op.id ? { ...p, nombre } : p))
    setEditandoNombre(null)
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await file.arrayBuffer()
    const wb   = XLSX.read(data)
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws)

    const payload = rows
      .filter(r => r.Cédula || r.cedula || r.CEDULA)
      .map(r => {
        const rolRaw      = String(r.Rol || r.rol || r.ROL || 'Operario').trim()
        const rol         = ROLES.includes(rolRaw as Rol) ? rolRaw : 'Operario'
        const contratoRaw = String(r.Contrato || r.contrato || r.CONTRATO || 'Fijo').trim()
        const tipo_contrato = TIPOS_CONTRATO.includes(contratoRaw as TipoContrato) ? contratoRaw : 'Fijo'
        return {
          cedula: String(r.Cédula || r.cedula || r.CEDULA).trim(),
          nombre: String(r.Nombre  || r.nombre  || r.NOMBRE  || '').trim(),
          rol,
          tipo_contrato,
          activo: true,
        }
      })

    if (payload.length === 0) {
      alert('No se encontraron filas válidas (columnas: Cédula, Nombre, Rol)')
      return
    }

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
      personal.filter(p => p.activo).map(p => ({
        Cédula:    p.cedula,
        Nombre:    p.nombre,
        Rol:       p.rol,
        Contrato:  p.tipo_contrato ?? 'Fijo',
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personal')
    XLSX.writeFile(wb, 'personal_prodplan.xlsx')
  }

  const activos   = filtrados.filter(p => p.activo)
  const inactivos = filtrados.filter(p => !p.activo)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">Personal</h1>
        <div className="flex gap-2 flex-wrap">
          <label className="cursor-pointer text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">
            📥 Importar Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
          </label>
          <button onClick={exportar} className="text-gray-400 hover:text-white text-sm px-3 py-2 bg-gray-800 rounded-lg">
            📤 Exportar
          </button>
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-lg">
            + Agregar
          </button>
        </div>
      </div>

      {/* Formulario nuevo empleado */}
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
          <div>
            <label className="text-gray-400 text-xs block mb-1">Rol</label>
            <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value as Rol }))}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Contrato</label>
            <select value={form.tipo_contrato} onChange={e => setForm(f => ({ ...f, tipo_contrato: e.target.value as TipoContrato }))}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer">
              <option value="Fijo">Fijo</option>
              <option value="Temporal">Temporal</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-xs w-full">{error}</p>}
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-sm px-2">
            Cancelar
          </button>
        </form>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre o cédula..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none cursor-pointer">
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filtroContrato} onChange={e => setFiltroContrato(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none cursor-pointer">
          <option value="">Fijo / Temporal</option>
          <option value="Fijo">Fijo</option>
          <option value="Temporal">Temporal</option>
        </select>
      </div>

      <p className="text-gray-500 text-xs mb-2">{activos.length} activos · {inactivos.length} inactivos</p>

      {error && !showForm && (
        <div className="flex items-center justify-between bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5 mb-2">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-400 text-xs ml-4">✕</button>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No hay personal</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Cédula</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Nombre</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Rol</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Rol 2</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Contrato</th>
                <th className="text-left text-gray-400 px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {[...activos, ...inactivos].map(p => (
                <tr key={p.id} className={`border-b border-gray-800/50 ${!p.activo ? 'opacity-50' : 'hover:bg-gray-800/30'}`}>
                  <td className="px-4 py-2.5 text-gray-300 font-mono">{p.cedula}</td>
                  <td className="px-4 py-2.5">
                    {esDirector && editandoNombre === p.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={nombreTemp}
                        onChange={e => setNombreTemp(e.target.value)}
                        onBlur={() => cambiarNombre(p, nombreTemp)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') cambiarNombre(p, nombreTemp)
                          if (e.key === 'Escape') setEditandoNombre(null)
                        }}
                        className="bg-gray-800 border border-blue-500 text-white rounded px-2 py-0.5 text-sm w-full focus:outline-none"
                      />
                    ) : (
                      <span
                        className={`text-white${esDirector ? ' cursor-pointer hover:text-blue-300' : ''}`}
                        title={esDirector ? 'Clic para editar nombre' : undefined}
                        onClick={() => {
                          if (!esDirector) return
                          setNombreTemp(p.nombre)
                          setEditandoNombre(p.id)
                        }}
                      >
                        {p.nombre}
                      </span>
                    )}
                  </td>

                  {/* Rol editable inline */}
                  <td className="px-4 py-2.5">
                    <select
                      value={p.rol || 'Operario'}
                      onChange={e => cambiarRol(p, e.target.value as Rol)}
                      disabled={editandoRol === p.id}
                      className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${ROL_COLORS[p.rol] || ROL_COLORS['Operario']}`}
                      style={{ background: 'transparent' }}
                    >
                      {ROLES.map(r => <option key={r} value={r} className="bg-gray-800 text-white">{r}</option>)}
                    </select>
                    {editandoRol === p.id && (
                      <span className="ml-1 text-[10px] text-gray-500">...</span>
                    )}
                  </td>

                  {/* Rol secundario editable inline */}
                  <td className="px-4 py-2.5">
                    <select
                      value={p.rol_secundario ?? ''}
                      onChange={e => cambiarRolSecundario(p, e.target.value)}
                      disabled={editandoRolSec === p.id}
                      className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${p.rol_secundario ? ROL_COLORS[p.rol_secundario] : 'text-gray-600'}`}
                      style={{ background: 'transparent' }}
                    >
                      <option value="" className="bg-gray-800 text-gray-400">— sin rol 2 —</option>
                      {ROLES.map(r => <option key={r} value={r} className="bg-gray-800 text-white">{r}</option>)}
                    </select>
                    {editandoRolSec === p.id && <span className="ml-1 text-[10px] text-gray-500">...</span>}
                  </td>

                  {/* Contrato editable inline */}
                  <td className="px-4 py-2.5">
                    <select
                      value={p.tipo_contrato ?? 'Fijo'}
                      onChange={e => cambiarContrato(p, e.target.value as TipoContrato)}
                      disabled={editandoContrato === p.id}
                      className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${CONTRATO_COLORS[p.tipo_contrato ?? 'Fijo']}`}
                      style={{ background: 'transparent' }}
                    >
                      {TIPOS_CONTRATO.map(t => <option key={t} value={t} className="bg-gray-800 text-white">{t}</option>)}
                    </select>
                    {editandoContrato === p.id && <span className="ml-1 text-[10px] text-gray-500">...</span>}
                  </td>

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

      {/* Nota Excel */}
      <p className="text-gray-600 text-xs mt-3">
        💡 El Excel acepta columnas: <span className="text-gray-500">Cédula, Nombre, Rol, Contrato</span> (valores de Contrato: Fijo o Temporal — por defecto Fijo)
      </p>
    </div>
  )
}
