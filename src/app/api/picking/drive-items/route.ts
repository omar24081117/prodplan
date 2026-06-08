import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const FOLDER_ID = '19jEydHTzraB4z_ghR-vdk7LGPT--KFHB'

function extractDriveId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

// Descarga un archivo de Drive usando la API Key (método correcto para carpetas compartidas)
async function downloadWithApiKey(fileId: string, apiKey: string): Promise<Buffer | null> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
  const res  = await fetch(url, { headers: { 'Accept': 'application/pdf,*/*' } })
  if (!res.ok) return null
  const bytes = Buffer.from(await res.arrayBuffer())
  // Verificar magic bytes %PDF
  if (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50) return bytes
  return null
}

// Parsear PDF y extraer ítems
async function parsePdfBuffer(buffer: Buffer, doc: string | null) {
  let text = ''
  try {
    const parsed = await pdfParse(buffer)
    text = parsed.text ?? ''
  } catch {
    // fallback: extractor básico de texto PDF
    const str = buffer.toString('latin1')
    const tjRe = /\(([^)\\]|\\.)*\)\s*Tj/g
    let m: RegExpExecArray | null
    while ((m = tjRe.exec(str)) !== null) {
      text += m[0].slice(1, m[0].lastIndexOf(')')).replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))) + ' '
    }
  }
  if (!text.trim()) return null
  const isPV  = (doc ?? '').toUpperCase().includes('PV')  || text.includes('PEDIDO')
  const isREQ = (doc ?? '').toUpperCase().includes('REQ') || text.toUpperCase().includes('REQUISICI')
  return extractItems(text, isPV, isREQ)
}

// Enriquecer con catálogo EAN
async function enrichItems(items: { referencia: string; descripcion: string; cantidad: number }[]) {
  try {
    const supabase = await createClient()
    const refs = [...new Set(items.map(i => i.referencia))]
    const { data: productos } = refs.length
      ? await supabase.from('productos_ean').select('referencia, descripcion, ean13').in('referencia', refs)
      : { data: [] }
    const prodMap: Record<string, { descripcion: string; ean13: string | null }> = {}
    for (const p of productos ?? []) prodMap[p.referencia] = { descripcion: p.descripcion, ean13: p.ean13 }
    return items.map(i => ({ ...i, descripcion: prodMap[i.referencia]?.descripcion ?? i.descripcion, ean13: prodMap[i.referencia]?.ean13 ?? null }))
  } catch { return items.map(i => ({ ...i, ean13: null })) }
}

// ── ROUTE HANDLER ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const doc      = searchParams.get('doc')?.trim()
  const driveUrl = searchParams.get('url')?.trim()
  const apiKey   = process.env.GOOGLE_DRIVE_API_KEY

  // ── MODO: URL directa pegada por el usuario ──────────────────────────────
  if (driveUrl) {
    const fileId = extractDriveId(driveUrl)
    if (!fileId) return NextResponse.json({ error: 'URL inválida. Copia el enlace directamente desde Google Drive.' }, { status: 400 })

    let buffer: Buffer | null = null

    // Primero intentar con API Key (más confiable)
    if (apiKey) {
      buffer = await downloadWithApiKey(fileId, apiKey)
    }

    // Si no funcionó, intentar descarga pública
    if (!buffer) {
      for (const dlUrl of [
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
        `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      ]) {
        try {
          const r = await fetch(dlUrl, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } })
          if (!r.ok) continue
          const b = Buffer.from(await r.arrayBuffer())
          if (b.length > 4 && b[0] === 0x25 && b[1] === 0x50) { buffer = b; break }
        } catch { continue }
      }
    }

    if (!buffer) {
      return NextResponse.json({
        error: 'No se pudo descargar el archivo. Asegúrate de que el archivo esté compartido como "Cualquiera con el enlace puede ver" en Drive.',
      }, { status: 400 })
    }

    const items = await parsePdfBuffer(buffer, doc ?? null)
    if (!items || items.length === 0) return NextResponse.json({ modo: 'sin_items', error: 'PDF leído pero sin ítems reconocibles.' }, { status: 422 })
    const enriched = await enrichItems(items)
    return NextResponse.json({ modo: 'automatico', items: enriched, total: enriched.length })
  }

  if (!doc) return NextResponse.json({ error: 'Parámetro doc requerido' }, { status: 400 })

  // ── MODO: Sin API Key ────────────────────────────────────────────────────
  if (!apiKey) {
    return NextResponse.json({ modo: 'pedir_url', mensaje: 'Pega el enlace del archivo desde Drive' })
  }

  // ── MODO: Búsqueda automática con API Key ────────────────────────────────
  try {
    // 1. Buscar el archivo en la carpeta por nombre
    const q = encodeURIComponent(`'${FOLDER_ID}' in parents and name contains '${doc}' and trashed=false`)
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&key=${apiKey}`
    const listRes = await fetch(listUrl)

    if (!listRes.ok) {
      const err = await listRes.text()
      // Si el error es de permisos o API desactivada
      if (err.includes('accessNotConfigured') || err.includes('disabled')) {
        return NextResponse.json({ modo: 'pedir_url', mensaje: 'La Google Drive API no está habilitada. Ve a Google Cloud Console → APIs → Habilitar Google Drive API.' })
      }
      return NextResponse.json({ modo: 'pedir_url', mensaje: `Error API: ${err.slice(0, 100)}` })
    }

    const listData   = await listRes.json()
    const files: { id: string; name: string }[] = listData.files ?? []

    if (files.length === 0) {
      return NextResponse.json({
        modo: 'no_encontrado',
        mensaje: `No se encontró "${doc}" en la carpeta. Verifica que el PDF esté subido con ese nombre.`,
      })
    }

    const file = files[0] // Tomar el primero que coincida

    // 2. Descargar el PDF con la API Key
    const buffer = await downloadWithApiKey(file.id, apiKey)
    if (!buffer) {
      return NextResponse.json({
        modo: 'sin_acceso',
        mensaje: `Archivo "${file.name}" encontrado pero sin acceso para descargar. Asegúrate de que la carpeta PEDIDOS esté compartida como "Cualquiera con el enlace puede ver".`,
        file_name: file.name,
      })
    }

    // 3. Parsear y devolver ítems
    const items = await parsePdfBuffer(buffer, doc ?? null)
    if (!items || items.length === 0) {
      return NextResponse.json({ modo: 'sin_items', archivo: file.name, mensaje: 'PDF encontrado pero sin ítems reconocibles.' })
    }

    const enriched = await enrichItems(items)
    return NextResponse.json({ modo: 'automatico', archivo: file.name, items: enriched, total: enriched.length })

  } catch (err) {
    return NextResponse.json({ modo: 'error', mensaje: String(err) }, { status: 500 })
  }
}

// ── Parser de texto ────────────────────────────────────────────────────────
function extractItems(text: string, isPV: boolean, isREQ: boolean) {
  const items: { referencia: string; descripcion: string; cantidad: number }[] = []
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

  for (const line of lines) {
    if (isPV || !isREQ) {
      const m1 = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]+?)\s+\d{3}\s+(?:UND|UNI|GR|KG|LT|ML|CC|BOL|GAL)\s+([\d.,]+)/i)
      if (m1) { const q = parseCant(m1[3]); if (q > 0) { items.push({ referencia: m1[1], descripcion: m1[2].trim(), cantidad: q }); continue } }
      const m2 = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]+?)\s+([\d.,]+)\s+\$/)
      if (m2) { const q = parseCant(m2[3]); if (q > 0 && q < 999999) { items.push({ referencia: m2[1], descripcion: m2[2].trim(), cantidad: q }); continue } }
    }
    if (isREQ || !isPV) {
      const m3 = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]+?)\s+\d{3}-\d+\s+\d{3}\s+(?:UND|UNI|GR|KG|LT|ML|CC|BOL)\s+(\d+)/i)
      if (m3) { const q = parseInt(m3[3]); if (q > 0) { items.push({ referencia: m3[1], descripcion: m3[2].trim(), cantidad: q }); continue } }
    }
    const mg = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]{8,60}?)\s+([\d.,]+)\s*$/)
    if (mg) { const q = parseCant(mg[3]); if (q > 0 && q < 99999) { items.push({ referencia: mg[1], descripcion: mg[2].trim(), cantidad: q }); continue } }
  }

  const map: Record<string, typeof items[0]> = {}
  for (const i of items) { if (map[i.referencia]) map[i.referencia].cantidad += i.cantidad; else map[i.referencia] = { ...i } }
  return Object.values(map)
}

function parseCant(s: string): number {
  return Math.round(parseFloat(s.replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0)
}
