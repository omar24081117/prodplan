import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

// ── Extraer texto del PDF con múltiples métodos ───────────────────────────
async function extractTextFromPdf(buffer: Buffer): Promise<string> {

  // Método 1: pdfjs-dist legacy (mejor soporte de fuentes personalizadas)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js')
    pdfjs.GlobalWorkerOptions.workerSrc = ''
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true })
    const doc = await loadingTask.promise
    let text = ''
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent({ includeMarkedContent: false })
      text += content.items.map((i: { str: string }) => i.str ?? '').join(' ') + '\n'
    }
    if (text.trim()) return text
  } catch { /* siguiente método */ }

  // Método 2: pdf-parse clásico
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const parsed = await pdfParse(buffer)
    if (parsed.text?.trim()) return parsed.text
  } catch { /* siguiente método */ }

  // Método 3: Extracción directa del binario PDF (fuentes Type1/CID)
  try {
    const str = buffer.toString('latin1')
    let text = ''
    // BT...ET blocks
    const btRe = /BT([\s\S]{0,2000}?)ET/g
    let btMatch
    while ((btMatch = btRe.exec(str)) !== null) {
      const block = btMatch[1]
      // Operador Tj
      const tjRe = /\(([^)\\]|\\.){1,200}\)\s*Tj/g
      let m
      while ((m = tjRe.exec(block)) !== null) {
        const raw = m[0].slice(1, m[0].lastIndexOf(')'))
        text += raw.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
                   .replace(/\\n/g, ' ').replace(/\\\\/g, '\\').replace(/\\(.)/g, '$1') + ' '
      }
      // Operador TJ (array)
      const arrRe = /\[([^\]]{1,500})\]\s*TJ/g
      while ((m = arrRe.exec(block)) !== null) {
        const partes = m[1].match(/\(([^)\\]|\\.){0,100}\)/g) ?? []
        text += partes.map(p => p.slice(1,-1).replace(/\\(\d{3})/g,(_, o)=>String.fromCharCode(parseInt(o,8)))).join('') + ' '
      }
    }
    if (text.trim().length > 20) return text
  } catch { /* siguiente método */ }

  return '' // No se pudo extraer
}

// ── Enriquecer con EAN desde catálogo ────────────────────────────────────
async function enrichItems(items: { referencia: string; descripcion: string; cantidad: number }[]) {
  try {
    const supabase = await createClient()
    const refs = [...new Set(items.map(i => i.referencia))]
    const { data } = refs.length
      ? await supabase.from('productos_ean').select('referencia, descripcion, ean13').in('referencia', refs)
      : { data: [] }
    const map: Record<string, { descripcion: string; ean13: string | null }> = {}
    for (const p of data ?? []) map[p.referencia] = { descripcion: p.descripcion, ean13: p.ean13 }
    return items.map(i => ({ ...i, descripcion: map[i.referencia]?.descripcion ?? i.descripcion, ean13: map[i.referencia]?.ean13 ?? null }))
  } catch { return items.map(i => ({ ...i, ean13: null })) }
}

export async function POST(request: NextRequest) {
  let file: File | null = null
  let doc: string | null = null

  try {
    const fd = await request.formData()
    file = fd.get('file') as File | null
    doc  = fd.get('doc') as string | null
  } catch { return NextResponse.json({ error: 'Error leyendo el archivo' }, { status: 400 }) }

  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  let buffer: Buffer
  try { buffer = Buffer.from(await file.arrayBuffer()) }
  catch { return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 }) }

  if (buffer.length < 4 || !(buffer[0] === 0x25 && buffer[1] === 0x50)) {
    return NextResponse.json({ error: 'El archivo no parece ser un PDF válido' }, { status: 400 })
  }

  const text = await extractTextFromPdf(buffer)

  if (!text.trim()) {
    // Último recurso: Google Cloud Vision OCR
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY
    if (apiKey) {
      try {
        const base64 = buffer.toString('base64')
        const visionRes = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64 },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
              }],
            }),
          }
        )
        if (visionRes.ok) {
          const vData = await visionRes.json()
          const visionText = vData.responses?.[0]?.fullTextAnnotation?.text ?? ''
          if (visionText.trim()) {
            const isPV  = (doc ?? '').toUpperCase().includes('PV')  || visionText.includes('PEDIDO')
            const isREQ = (doc ?? '').toUpperCase().includes('REQ') || visionText.toUpperCase().includes('REQUISICI')
            const items = extractItems(visionText, isPV, isREQ)
            if (items.length > 0) {
              const enriched = await enrichItems(items)
              return NextResponse.json({ items: enriched, total: enriched.length, metodo: 'ocr' })
            }
          }
        }
      } catch { /* Vision no disponible */ }
    }

    return NextResponse.json({
      error: 'El PDF no tiene texto extraíble. Para habilitarlo: en Google Cloud Console → Habilitar "Cloud Vision API" con la misma API Key.',
      items: [],
      tip: 'Ve a console.cloud.google.com → APIs → Biblioteca → busca "Cloud Vision API" → Habilitar',
    }, { status: 422 })
  }

  const isPV  = (doc ?? '').toUpperCase().includes('PV')  || text.includes('PEDIDO')
  const isREQ = (doc ?? '').toUpperCase().includes('REQ') || text.toUpperCase().includes('REQUISICI')
  const items = extractItems(text, isPV, isREQ)

  if (items.length === 0) {
    const sample = text.split('\n').filter((l: string) => l.trim()).slice(0, 15)
    return NextResponse.json({
      error: 'PDF leído pero ítems no reconocidos. El formato podría ser diferente.',
      sample,
      items: [],
    }, { status: 422 })
  }

  const enriched = await enrichItems(items)
  return NextResponse.json({ items: enriched, total: enriched.length, metodo: 'texto' })
}

function extractItems(text: string, isPV: boolean, isREQ: boolean) {
  const items: { referencia: string; descripcion: string; cantidad: number }[] = []
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

  for (const line of lines) {
    if (isPV || !isREQ) {
      const m1 = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]+?)\s+\d{3}\s+(?:UND|UNI|GR|KG|LT|ML|CC|BOL|GAL)\s+([\d.,]+)/i)
      if (m1) { const q = pc(m1[3]); if (q>0) { items.push({ referencia:m1[1], descripcion:m1[2].trim(), cantidad:q }); continue } }
      const m2 = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]+?)\s+([\d.,]+)\s+\$/)
      if (m2) { const q = pc(m2[3]); if (q>0&&q<999999) { items.push({ referencia:m2[1], descripcion:m2[2].trim(), cantidad:q }); continue } }
    }
    if (isREQ || !isPV) {
      const m3 = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]+?)\s+\d{3}-\d+\s+\d{3}\s+(?:UND|UNI|GR|KG|LT|ML|CC|BOL)\s+(\d+)/i)
      if (m3) { const q=parseInt(m3[3]); if (q>0) { items.push({ referencia:m3[1], descripcion:m3[2].trim(), cantidad:q }); continue } }
    }
    const mg = line.match(/^(\d{4,6})\s+([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9 .,\-\/&×()\[\]]{8,60}?)\s+([\d.,]+)\s*$/)
    if (mg) { const q=pc(mg[3]); if (q>0&&q<99999) { items.push({ referencia:mg[1], descripcion:mg[2].trim(), cantidad:q }); continue } }
  }

  const map: Record<string, typeof items[0]> = {}
  for (const i of items) { if (map[i.referencia]) map[i.referencia].cantidad+=i.cantidad; else map[i.referencia]={...i} }
  return Object.values(map)
}

function pc(s: string): number {
  return Math.round(parseFloat(s.replace(/\.(?=\d{3})/g,'').replace(',','.')) || 0)
}
