'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, AlertTriangle } from 'lucide-react'

interface Props {
  onDetected: (code: string) => void
  active: boolean
  onToggle: () => void
}

export default function BarcodeScanner({ onDetected, active, onToggle }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [lastCode, setLastCode] = useState('')
  const readerRef   = useRef<unknown>(null)
  const lastRef     = useRef('')
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (!active) {
      stopScanner()
      return
    }
    startScanner()
    return () => stopScanner()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  async function startScanner() {
    setError('')
    try {
      // Dynamic import to avoid SSR issues
      const zxing = await import('@zxing/browser')
      const BrowserMultiFormatReader = zxing.BrowserMultiFormatReader
      // NotFoundException is exported from @zxing/library
      let NotFoundException: unknown
      try { const lib = await import('@zxing/library'); NotFoundException = lib.NotFoundException } catch { /* noop */ }
      const codeReader = new BrowserMultiFormatReader()
      readerRef.current = codeReader

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      // Prefer back camera
      const backCam = devices.find(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('trasera') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      ) ?? devices[devices.length - 1] ?? devices[0]

      if (!backCam) { setError('No se encontró cámara'); return }

      await codeReader.decodeFromVideoDevice(
        backCam.deviceId,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const code = result.getText()
            if (code && code !== lastRef.current && !cooldownRef.current) {
              lastRef.current = code
              cooldownRef.current = true
              setLastCode(code)
              onDetected(code)
              setTimeout(() => { cooldownRef.current = false; lastRef.current = '' }, 2500)
            }
          }
          if (err && NotFoundException && !(err instanceof (NotFoundException as new() => Error))) {
            // ignore frame errors
          }
        }
      )
    } catch (e) {
      setError('Cámara no disponible: ' + String(e))
    }
  }

  function stopScanner() {
    try {
      if (readerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(readerRef.current as any).reset?.()
      }
    } catch { /* noop */ }
    readerRef.current = null
    lastRef.current = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={onToggle}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
        style={{
          background: active ? '#450a0a' : 'linear-gradient(135deg,#0c3a6e,#0d4e9e)',
          border: `1px solid ${active ? '#7f1d1d' : '#2563eb'}`,
          color: active ? '#fca5a5' : 'white'
        }}>
        {active ? <><CameraOff size={16} /> Detener cámara</> : <><Camera size={16} /> 📷 Activar cámara</>}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {active && (
        <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '4/3', background: '#000' }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {/* Visor */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-32">
              <div className="absolute inset-0 rounded-lg" style={{ border: '2.5px solid #38bdf8', boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
              {/* Línea animada */}
              <div className="absolute left-2 right-2 h-0.5 rounded animate-pulse" style={{ background: '#38bdf8', top: '50%' }} />
            </div>
          </div>
          {lastCode && (
            <div className="absolute bottom-0 inset-x-0 text-center text-sm font-bold px-3 py-2"
              style={{ background: 'rgba(14,165,233,0.92)', color: 'white' }}>
              ✓ {lastCode}
            </div>
          )}
          <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-semibold animate-pulse"
            style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}>
            ● REC
          </div>
        </div>
      )}
    </div>
  )
}
