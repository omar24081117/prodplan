'use client'

import { useRouter } from 'next/navigation'
import { Leaf, Factory } from 'lucide-react'
import LeafBackground from '@/components/LeafBackground'

export default function Home() {
  const router = useRouter()

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center p-6 gap-8"
      style={{ background: '#d4e8b8' }}
    >
      <LeafBackground />
      {/* Marca */}
      <div className="relative z-10 text-center mb-4">
        <div className="flex items-center justify-center mb-3">
          <div className="p-4 rounded-full" style={{ background: 'rgba(60,130,40,0.25)', border: '1px solid rgba(90,170,60,0.4)' }}>
            <Leaf size={52} strokeWidth={1.5} className="text-green-300" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-wide">PRODPLAN</h1>
        <p className="text-gray-400 text-sm mt-2">Sistema de planeación de producción natural</p>
      </div>

      {/* Dos botones principales */}
      <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">

        {/* Asistencia */}
        <button
          onClick={() => router.push('/asistencia')}
          className="w-full rounded-2xl p-6 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #2e6e20, #3d8830)', border: '1px solid #5aaa40', boxShadow: '0 4px 20px rgba(60,140,40,0.3)' }}
        >
          <div className="text-left">
            <p className="text-white font-bold text-xl">Asistencia</p>
            <p className="text-green-200/70 text-sm mt-0.5">Registra tu entrada y salida</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <polyline points="16 11 18 13 22 9"/>
            </svg>
          </div>
        </button>

        {/* Producción */}
        <button
          onClick={() => router.push('/produccion')}
          className="w-full rounded-2xl p-6 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #3d5c18, #527820)', border: '1px solid #7aaa30', boxShadow: '0 4px 20px rgba(90,140,20,0.3)' }}
        >
          <div className="text-left">
            <p className="text-white font-bold text-xl">Producción</p>
            <p className="text-lime-200/70 text-sm mt-0.5">Ejecución y administración</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <Factory size={36} strokeWidth={1.5} className="text-white" />
          </div>
        </button>
      </div>

      <p className="relative z-10 text-gray-600 text-xs mt-4">Producción natural · Trazabilidad real</p>
    </main>
  )
}
