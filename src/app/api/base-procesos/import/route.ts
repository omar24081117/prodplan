import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

// ─── Mapeo de nombres de proceso del Excel al sistema ─────────────────────────
const PROCESO_MAP: Record<string, string> = {
  'ENVASADO': 'ENVASAR',
  'ENVASADO/TROQUELADO': 'ENVASAR',
  'ENVASAR': 'ENVASAR',
  'ENVASAR/TROQUELAR': 'ENVASAR',
  'ENVASADO / TROQUELADO': 'ENVASAR',
  'TROQUELADO': 'TROQUELAR',
  'TROQUELAR': 'TROQUELAR',
  'ETIQUETADO': 'ETIQUETAR',
  'ETIQUETAR': 'ETIQUETAR',
  'ETIQUETADO/ENVOLVER': 'ETIQUETAR',
  'ETIQUETADO / ENVOLVER': 'ETIQUETAR',
  'ETIQUETADO/ENVOLTURA': 'ETIQUETAR',
  'ENVOLVER': 'ETIQUETAR',
  'EMPACAR': 'EMPACAR',
  'EMPAQUE': 'EMPACAR',
  'EMPACADO': 'EMPACAR',
  'FABRICAR': 'FABRICAR',
  'FABRICADO': 'FABRICAR',
  'FABRICACION': 'FABRICAR',
  'FABRICACIÓN': 'FABRICAR',
  'SOPLAR': 'SOPLAR ENV',
  'SOPLAR ENV': 'SOPLAR ENV',
  'SOPLADO': 'SOPLAR ENV',
  'LAVAR': 'LAVAR',
  'LAVADO': 'LAVAR',
  'ACONDICIONAR': 'ACONDICIONAR',
  'ACONDICIONADO': 'ACONDICIONAR',
  'ACONDICIONADO/TERMO': 'ACONDICIONAR',
  'ACONDICIONADO / TERMO': 'ACONDICIONAR',
  'ACONDICIONAMIENTO/TERMO': 'ACONDICIONAR',
  'ACONDICIONAMIENTO / TERMO': 'ACONDICIONAR',
  'ACONDICIONAMIENTO': 'ACONDICIONAR',
  'TERMO': 'ACONDICIONAR',
  'PESAJE': 'PESAJE',
  'PESADO': 'PESAJE',
  'MEZCLADO': 'MEZCLADO',
  'MEZCLA': 'MEZCLADO',
  'CONTROL CALIDAD': 'CONTROL CALIDAD',
  'CONTROL DE CALIDAD': 'CONTROL CALIDAD',
  'CC': 'CONTROL CALIDAD',
  'C.C': 'CONTROL CALIDAD',
}

function mapProceso(raw: string): string {
  const upper = raw.toUpperCase().trim().replace(/\s+/g, ' ')
  return PROCESO_MAP[upper] || upper
}

function normalize(s: unknown): string {
  return String(s ?? '').toUpperCase().trim().replace(/\s+/g, ' ')
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isFinite(n) && n > 0 ? n : null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    // Leer todas las filas como arrays crudos
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    }) as (string | number | null)[][]

    if (rows.length < 3) {
      return NextResponse.json({ error: 'Archivo muy corto o sin datos' }, { status: 400 })
    }

    // ─── 1. Encontrar la fila de sub-encabezados (UND/H, UND/D, UND/M) ────────
    //       y la fila de procesos (una o dos filas arriba)
    let subheaderRowIdx = -1
    let processRowIdx = -1

    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cells = rows[i].map(normalize)
      const undHCount = cells.filter(c => c === 'UND/H').length
      if (undHCount >= 1) {
        subheaderRowIdx = i
        // Buscar fila de procesos: la primera fila anterior que tenga texto en columnas > 1
        for (let j = i - 1; j >= 0; j--) {
          const prevCells = rows[j].map(normalize)
          // Si alguna celda después de la col 1 tiene texto que no es empty y no es el header gigante
          const hasProcessName = prevCells.slice(1).some(c =>
            c.length > 2 &&
            c !== 'TIEMPO REAL UND/H' &&
            c !== 'TIEMPO REAL' &&
            c !== 'DESC. ITEM' &&
            c !== 'DESCRIPCION' &&
            c !== 'REFERENCIA'
          )
          if (hasProcessName) {
            processRowIdx = j
            break
          }
        }
        break
      }
    }

    if (subheaderRowIdx === -1) {
      return NextResponse.json({
        error: 'No se encontraron columnas UND/H en el archivo. Verifica el formato de la plantilla.'
      }, { status: 400 })
    }

    // ─── 2. Construir mapa de columnas → proceso ─────────────────────────────
    // Las celdas combinadas dejan el valor solo en la primera celda; propagamos hacia adelante
    const processRow = processRowIdx >= 0 ? rows[processRowIdx] : []
    const subheaderRow = rows[subheaderRowIdx]

    // Propagar nombres de proceso (celdas combinadas)
    const processPerCol: string[] = []
    let currentProcess = ''
    for (let c = 0; c < subheaderRow.length; c++) {
      const pCell = normalize(processRow[c] ?? null)
      if (pCell && pCell.length > 2 &&
          pCell !== 'DESC. ITEM' &&
          pCell !== 'DESCRIPCION' &&
          pCell !== 'REFERENCIA' &&
          !pCell.startsWith('TIEMPO')) {
        currentProcess = pCell
      }
      processPerCol[c] = currentProcess
    }

    // Columnas que son UND/H con proceso conocido
    type ColInfo = { colIdx: number; proceso: string }
    const undhCols: ColInfo[] = []

    // Encontrar las columnas de Referencia y Descripción
    let colRef = -1
    let colDesc = -1

    for (let c = 0; c < subheaderRow.length; c++) {
      const cell = normalize(subheaderRow[c] ?? null)
      if (colRef === -1 && (cell === 'REFERENCIA' || cell === 'REF' || cell === 'SKU' || cell === 'CODIGO' || cell === 'CÓDIGO')) {
        colRef = c
      } else if (colDesc === -1 && (cell === 'DESC. ITEM' || cell === 'DESCRIPCION' || cell === 'DESCRIPCIÓN' || cell === 'PRODUCTO' || cell === 'NOMBRE')) {
        colDesc = c
      } else if (cell === 'UND/H' && processPerCol[c]) {
        undhCols.push({ colIdx: c, proceso: mapProceso(processPerCol[c]) })
      }
    }

    // Si no encontramos col de referencia, buscar en primeras columnas de los datos
    if (colRef === -1) colRef = 0
    if (colDesc === -1) colDesc = 1

    if (undhCols.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron columnas UND/H con proceso asignado. Revisa que los encabezados de proceso estén en la fila correcta.'
      }, { status: 400 })
    }

    // ─── 3. Leer filas de datos ──────────────────────────────────────────────
    const dataStartIdx = subheaderRowIdx + 1
    type ExtractedRow = { sku: string; nombre: string; proceso: string; estandar: number }
    const extracted: ExtractedRow[] = []

    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i]
      const rawSku = String(row[colRef] ?? '').trim()
      const rawDesc = String(row[colDesc] ?? '').trim()

      if (!rawSku || rawSku === '' || normalize(rawSku) === 'REFERENCIA') continue
      // Saltar filas de totales o subtotales
      if (normalize(rawSku).startsWith('TOTAL') || normalize(rawDesc).startsWith('TOTAL')) continue

      for (const { colIdx, proceso } of undhCols) {
        const val = toNum(row[colIdx])
        if (val !== null) {
          extracted.push({ sku: rawSku, nombre: rawDesc, proceso, estandar: val })
        }
      }
    }

    if (extracted.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron datos válidos en el archivo.'
      }, { status: 400 })
    }

    // ─── 4. Buscar productos en catálogo y hacer upsert ─────────────────────
    const supabase = await createClient()

    // Obtener todos los SKUs únicos
    const skus = [...new Set(extracted.map(r => r.sku))]
    const { data: catalogoItems } = await supabase
      .from('catalogo')
      .select('id, sku, nombre')
      .in('sku', skus)

    const skuMap = new Map((catalogoItems || []).map(c => [c.sku, c]))

    // Productos no encontrados en catálogo → crear automáticamente
    const skusNuevos = skus.filter(s => !skuMap.has(s))
    if (skusNuevos.length > 0) {
      // Agregar al catálogo con el nombre del Excel
      const nuevos = skusNuevos.map(sku => {
        const row = extracted.find(r => r.sku === sku)
        return { sku, nombre: row?.nombre || sku }
      })
      const { data: insertados } = await supabase
        .from('catalogo')
        .upsert(nuevos, { onConflict: 'sku' })
        .select('id, sku, nombre')
      ;(insertados || []).forEach(c => skuMap.set(c.sku, c))
    }

    // Preparar registros para upsert en base_procesos
    type BaseProcRow = { catalogo_id: string; proceso: string; estandar: number; unidad: string }
    const registros: BaseProcRow[] = []
    const skipped: string[] = []

    for (const row of extracted) {
      const cat = skuMap.get(row.sku)
      if (!cat) { skipped.push(row.sku); continue }
      registros.push({
        catalogo_id: cat.id,
        proceso: row.proceso,
        estandar: row.estandar,
        unidad: 'UND',
      })
    }

    if (registros.length === 0) {
      return NextResponse.json({ error: 'Ningún producto encontrado en el catálogo' }, { status: 400 })
    }

    const { data: upserted, error } = await supabase
      .from('base_procesos')
      .upsert(registros, { onConflict: 'catalogo_id,proceso' })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Resumen por proceso importado
    const resumenProcesos: Record<string, number> = {}
    registros.forEach(r => { resumenProcesos[r.proceso] = (resumenProcesos[r.proceso] || 0) + 1 })

    return NextResponse.json({
      ok: true,
      total: upserted?.length ?? registros.length,
      productosNuevos: skusNuevos.length,
      skipped: skipped.length,
      procesosEncontrados: undhCols.map(c => c.proceso),
      resumenProcesos,
    })
  } catch (err) {
    console.error('[base-procesos/import]', err)
    return NextResponse.json({ error: 'Error al procesar el archivo: ' + String(err) }, { status: 500 })
  }
}
