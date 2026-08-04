'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'

const RRHH_PASSWORD = 'RRHH2026@JP'

export default function RRHHLoginPage() {
  const router = useRouter()
  const [pass, setPass]     = useState('')
  const [show, setShow]     = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (sessionStorage.getItem('rrhh_auth') === '1') {
      router.replace('/rrhh/asistencia')
    }
  }, [router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pass === RRHH_PASSWORD) {
      sessionStorage.setItem('rrhh_auth', '1')
      router.push('/rrhh/asistencia')
    } else {
      setError('Clave incorrecta')
      setPass('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0d1f0d 0%, #071207 100%)' }}>
      <div className="w-full max-w-sm px-4">
        <div className="rounded-2xl p-8" style={{ background: '#111f11', border: '1px solid #1e3a1e' }}>
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <Lock size={26} className="text-green-400" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-wide">RRHH</h1>
            <p className="text-gray-500 text-sm mt-1">Recursos Humanos · JustoPago</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                placeholder="Clave de acceso"
                value={pass}
                onChange={e => { setPass(e.target.value); setError('') }}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none pr-10"
                style={{ background: '#1a2e1a', border: '1px solid #2d4a2d' }}
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button type="submit"
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #166534, #14532d)' }}>
              Ingresar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
