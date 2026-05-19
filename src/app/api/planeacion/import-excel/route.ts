import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Mapeo flexible de nombres de columnas al formato interno
const COL_MAP: Record<string, string> = {
  // proceso
  proceso: 'proceso', process: 'proceso',
  // trip / personal
  trip: 'personal_planeado', 'personal planeado': 'personal_planeado', personal: 'personal_planeado',
  // turno
  turno: 'turno', shift: 'turno',
  // sku / ref
  ref: 'sku', sku: 'sku', referencia: 'sku', código: 'sku', codigo: 'sku',
  // producto
  descripcion: 'producto', descripción: 'producto', producto: 'producto', 'nombre producto': 'producto',
  // lote
  lote: 'lote', batch: 'lote',
  // unidad
  unidad: 'unidad', 'und de medida': 'unidad', 'und medida': 'unidad', und: 'unidad',
  'unidad de medida': 'unidad', medida: 'unidad',
  // cantidad
  meta: 'cantidad', cantidad: 'cantidad', target: 'cantidad',
  // notas
  notas: 'notas', observaciones: 'notas', obs: 'notas',
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('archivo') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  }

  try {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

    if (rows.length < 2) {
      return NextResponse.json({ error: 'El archivo no tiene datos suficientes' }, { status: 422 })
    }

    // Detectar fila de encabezados (buscar la primera fila con texto reconocible)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i] as string[]
      const normalized = row.map(c => normalizeHeader(String(c ?? '')))
      if (normalized.some(h => Object.keys(COL_MAP).includes(h))) {
        headerRowIdx = i
        break
      }
    }

    const headers = (rows[headerRowIdx] as string[]).map(h => normalizeHeader(String(h ?? '')))
    const dataRows = rows.slice(headerRowIdx + 1)

    // Mapear cada columna a su campo interno
    const colIdx: Record<string, number> = {}
    headers.forEach((h, i) => {
      const mapped = COL_MAP[h]
      if (mapped && !(mapped in colIdx)) colIdx[mapped] = i
    })

    function cell(row: unknown[], field: string): string {
      const idx = colIdx[field]
      if (idx === undefined) return ''
      return String((row as string[])[idx] ?? '').trim()
    }

    const actividades = dataRows
      .filter(row => {
        // Ignorar filas completamente vacías
        return (row as string[]).some(c => String(c ?? '').trim() !== '')
      })
      .map(row => {
        const cantidad = parseFloat(cell(row, 'cantidad').replace(/[.,]/g, (m, o, s) => {
          // manejar separadores de miles con punto o coma
          const dotCount = (s.match(/\./g) || []).length
          const commaCount = (s.match(/,/g) || []).length
          if (dotCount > 1) return '' // puntos como separador de miles
          if (commaCount > 1) return '' // comas como separador de miles
          if (m === ',' && dotCount === 0) return '.' // coma decimal
          if (m === '.' && commaCount === 0) return '.' // punto decimal
          return '' // separador de miles
        }))
        const personal = cell(row, 'personal_planeado')
        const turnoRaw = cell(row, 'turno').toUpperCase()
        const turno = ['MAÑANA', 'MANANA', 'TARDE', 'NOCHE'].includes(turnoRaw)
          ? turnoRaw.replace('MANANA', 'MAÑANA')
          : turnoRaw || 'MAÑANA'

        return {
          sku: cell(row, 'sku') || null,
          producto: cell(row, 'producto') || 'Sin descripción',
          proceso: cell(row, 'proceso') || 'OTRO',
          turno,
          personal_planeado: personal ? parseInt(personal) : null,
          cantidad: isNaN(cantidad) ? 0 : Math.round(cantidad),
          unidad: cell(row, 'unidad') || null,
          lote: cell(row, 'lote') || null,
          notas: cell(row, 'notas') || null,
        }
      })
      .filter(a => a.producto !== 'Sin descripción' || a.sku)

    return NextResponse.json({ actividades, total: actividades.length })
  } catch (err) {
    return NextResponse.json({ error: 'Error al procesar el archivo: ' + String(err) }, { status: 422 })
  }
}
