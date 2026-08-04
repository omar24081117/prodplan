'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, Clock, Users, LogOut, Leaf } from 'lucide-react'

const NAV = [
  { href: '/rrhh/asistencia',  icon: <ClipboardCheck size={14} />, label: 'Asistencia' },
  { href: '/rrhh/horas-extra', icon: <Clock size={14} />,          label: 'Horas Extra' },
  { href: '/rrhh/personal',    icon: <Users size={14} />,          label: 'Personal' },
]

export default function RRHHLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (pathname === '/rrhh') { setReady(true); return }
    if (sessionStorage.getItem('rrhh_auth') !== '1') {
      router.replace('/rrhh')
    } else {
      setReady(true)
    }
  }, [pathname, router])

  if (!ready) return null

  if (pathname === '/rrhh') return <>{children}</>

  function salir() {
    sessionStorage.removeItem('rrhh_auth')
    router.push('/rrhh')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/rrhh/asistencia" className="flex items-center gap-2">
            <Leaf size={20} strokeWidth={1.5} className="text-green-400" />
            <span className="text-white font-bold text-base tracking-wide">RRHH</span>
            <span className="text-gray-600 text-xs font-normal hidden sm:inline">· JustoPago</span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            {NAV.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm"
                  style={{
                    color: active ? '#ffffff' : '#9ca3af',
                    background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(34,197,94,0.25)' : '1px solid transparent',
                  }}>
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
        <button onClick={salir}
          className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          <LogOut size={14} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </nav>
      <div className="flex-1 p-4 sm:p-6">
        {children}
      </div>
    </div>
  )
}
