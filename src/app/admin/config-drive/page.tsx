'use client'

import { useState } from 'react'
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react'

const SCRIPT_CODE = `// ═══════════════════════════════════════════════════════════════
// PRODPLAN — Google Apps Script para acceso automático a Drive
// Instrucciones: Ver más abajo
// ═══════════════════════════════════════════════════════════════

const FOLDER_ID = '19jEydHTzraB4z_ghR-vdk7LGPT--KFHB';

function doGet(e) {
  try {
    const doc = e.parameter.doc;
    if (!doc) {
      return json({ error: 'Parámetro doc requerido' });
    }

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files  = folder.searchFiles('title contains "' + doc + '"');

    if (!files.hasNext()) {
      return json({ found: false, mensaje: 'Archivo no encontrado: ' + doc });
    }

    const file    = files.next();
    const blob    = file.getBlob();
    const bytes   = blob.getBytes();
    const base64  = Utilities.base64Encode(bytes);

    return json({
      found:    true,
      name:     file.getName(),
      content:  base64,
      mimeType: file.getMimeType()
    });
  } catch(err) {
    return json({ error: String(err) });
  }
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`

export default function ConfigDrivePage() {
  const [copied, setCopied] = useState(false)

  function copiar() {
    navigator.clipboard.writeText(SCRIPT_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">⚙️ Configurar Google Drive</h1>
      <p className="text-gray-500 text-sm mb-6">Sigue estos pasos para conectar el módulo de Picking con tu carpeta de Drive. Solo se hace una vez.</p>

      <div className="flex flex-col gap-6">

        {/* PASO 1 */}
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black" style={{ background: '#1d4ed8', color: 'white' }}>1</span>
            <p className="text-white font-bold">Abre Google Apps Script</p>
          </div>
          <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: '#1a4060', color: '#60a5fa', border: '1px solid #2563eb' }}>
            <ExternalLink size={14} /> Crear proyecto en script.google.com
          </a>
        </div>

        {/* PASO 2 */}
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black" style={{ background: '#1d4ed8', color: 'white' }}>2</span>
            <p className="text-white font-bold">Pega este código (reemplaza todo el contenido)</p>
          </div>
          <div className="relative">
            <pre className="text-xs rounded-xl p-4 overflow-x-auto" style={{ background: '#0a1117', border: '1px solid #1e293b', color: '#a3e635', fontFamily: 'monospace' }}>
              {SCRIPT_CODE}
            </pre>
            <button onClick={copiar}
              className="absolute top-2 right-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-110"
              style={{ background: copied ? '#166534' : '#1e293b', color: copied ? '#4ade80' : '#94a3b8', border: '1px solid #334155' }}>
              {copied ? <><CheckCircle2 size={12} /> Copiado</> : <><Copy size={12} /> Copiar código</>}
            </button>
          </div>
        </div>

        {/* PASO 3 */}
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black" style={{ background: '#1d4ed8', color: 'white' }}>3</span>
            <p className="text-white font-bold">Despliega como aplicación web</p>
          </div>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>En el editor, clic en <span className="text-white font-semibold">Implementar</span> → <span className="text-white font-semibold">Nueva implementación</span></li>
            <li>Tipo: <span className="text-blue-300 font-semibold">Aplicación web</span></li>
            <li>Ejecutar como: <span className="text-blue-300 font-semibold">Yo (tu cuenta de Google)</span></li>
            <li>Quién tiene acceso: <span className="text-green-300 font-semibold">Cualquier persona</span></li>
            <li>Clic en <span className="text-white font-semibold">Implementar</span> → Autorizar → Copiar la <span className="text-yellow-300 font-semibold">URL de la aplicación web</span></li>
          </ol>
        </div>

        {/* PASO 4 */}
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black" style={{ background: '#1d4ed8', color: 'white' }}>4</span>
            <p className="text-white font-bold">Agrega la URL en Vercel</p>
          </div>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside mb-4">
            <li>Ve a <a href="https://vercel.com" target="_blank" className="text-blue-400 underline">vercel.com</a> → tu proyecto <span className="text-white font-mono">prodplan</span></li>
            <li>Settings → Environment Variables</li>
            <li>Agrega: <span className="font-mono text-yellow-300">GOOGLE_SCRIPT_URL</span> = <span className="text-gray-300">la URL copiada en paso 3</span></li>
            <li>Redeploy (o espera al próximo deploy)</li>
          </ol>
          <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-green-300 font-semibold mb-1">✅ Resultado esperado</p>
            <p className="text-gray-500">Cuando abras el Picking de cualquier PV o REQ, el sistema encontrará automáticamente el PDF en tu carpeta de Drive y extraerá los ítems sin necesidad de pegar ningún enlace.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
