'use client'

import { useState } from 'react'

export default function ConfigPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setMsg('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setMsg('La contraseña debe tener al menos 8 caracteres'); return }
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setMsg(res.ok ? '✅ Contraseña actualizada' : data.error || 'Error al actualizar')
    if (res.ok) { setPassword(''); setConfirm('') }
    setSaving(false)
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Configuración</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-4">Cambiar contraseña admin</h2>
        <form onSubmit={cambiarPassword} className="flex flex-col gap-3">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Nueva contraseña</label>
            <input type="password" required minLength={8} value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Confirmar contraseña</label>
            <input type="password" required value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
          {msg && <p className={`text-sm ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg">
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Accesos del sistema</h2>
        <div className="flex flex-col gap-2 text-sm">
          {[
            { label: 'Panel admin', desc: 'Email: admin@prodplan.com + contraseña', icon: '🔐' },
            { label: 'Pantalla operario', desc: 'Solo requiere número de cédula registrada', icon: '🪪' },
            { label: 'Asistencia', desc: 'Acceso público — sin login requerido', icon: '✅' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3 bg-gray-800 rounded-lg px-4 py-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-white font-medium">{item.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
