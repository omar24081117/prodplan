'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trash2, KeyRound, RefreshCw, User, Mail, Lock } from 'lucide-react'

type Usuario = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Formulario nuevo usuario
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createOk, setCreateOk] = useState(false)

  // Cambiar contraseña
  const [editId, setEditId] = useState<string | null>(null)
  const [newPass, setNewPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Error cargando usuarios')
      else setUsuarios(data)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    setCreateOk(false)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || 'Error al crear usuario')
      } else {
        setCreateOk(true)
        setEmail('')
        setNombre('')
        setPassword('')
        cargar()
      }
    } catch {
      setCreateError('Error de conexión')
    } finally {
      setCreating(false)
    }
  }

  async function eliminar(id: string, correo: string) {
    if (!confirm(`¿Eliminar al usuario ${correo}?`)) return
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
      if (res.ok) cargar()
      else {
        const d = await res.json()
        alert(d.error || 'Error al eliminar')
      }
    } catch {
      alert('Error de conexión')
    }
  }

  async function cambiarClave(id: string) {
    if (!newPass.trim()) return
    setSavingPass(true)
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass }),
      })
      if (res.ok) {
        setEditId(null)
        setNewPass('')
      } else {
        const d = await res.json()
        alert(d.error || 'Error al actualizar')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setSavingPass(false)
    }
  }

  function formatFecha(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Personal Administrativo</h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona los usuarios con acceso al panel</p>
        </div>
        <button onClick={cargar} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Formulario crear usuario */}
      <div className="rounded-2xl p-6" style={{ background: '#1e3a14', border: '1px solid #3a6228' }}>
        <div className="flex items-center gap-2 mb-5">
          <UserPlus size={20} className="text-green-400" />
          <h2 className="text-white font-semibold text-lg">Nuevo usuario</h2>
        </div>
        <form onSubmit={crearUsuario} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><User size={11} /> Nombre</label>
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><Mail size={11} /> Correo electrónico</label>
            <input
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 flex items-center gap-1"><Lock size={11} /> Contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
              required
            />
          </div>
          <div className="sm:col-span-3 flex flex-col gap-2">
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            {createOk && <p className="text-green-400 text-sm">✓ Usuario creado exitosamente</p>}
            <button type="submit" disabled={creating}
              className="w-full sm:w-auto self-start text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #2e6e20, #3d8830)', border: '1px solid #5aaa40' }}>
              {creating ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #3a6228' }}>
        <div className="px-6 py-4" style={{ background: '#1e3a14' }}>
          <h2 className="text-white font-semibold">Usuarios registrados</h2>
          <p className="text-gray-400 text-xs mt-0.5">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-400" style={{ background: '#162e10' }}>Cargando...</div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-red-400" style={{ background: '#162e10' }}>{error}</div>
        ) : usuarios.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500" style={{ background: '#162e10' }}>
            No hay usuarios registrados. Crea el primero arriba.
          </div>
        ) : (
          <div style={{ background: '#162e10' }}>
            {usuarios.map((u, i) => (
              <div key={u.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid #2a4e20' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.email}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Creado: {formatFecha(u.created_at)}
                    {u.last_sign_in_at && <> · Último acceso: {formatFecha(u.last_sign_in_at)}</>}
                  </p>
                </div>

                {/* Cambiar contraseña */}
                {editId === u.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="Nueva contraseña"
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500 w-44"
                    />
                    <button onClick={() => cambiarClave(u.id)} disabled={savingPass}
                      className="text-white text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50"
                      style={{ background: '#2e6e20', border: '1px solid #5aaa40' }}>
                      {savingPass ? '...' : 'Guardar'}
                    </button>
                    <button onClick={() => { setEditId(null); setNewPass('') }}
                      className="text-gray-400 hover:text-white text-xs px-2 py-1.5">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditId(u.id); setNewPass('') }}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-yellow-400 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                    <KeyRound size={13} /> Cambiar clave
                  </button>
                )}

                <button onClick={() => eliminar(u.id, u.email)}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
