// Script de importación: reporte julio 2026 → overrides + aprobaciones + cierres
// Ejecutar: node scripts/import-julio.mjs

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const SUPABASE_URL = 'https://wmxcumqecagjniakkpjp.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGN1bXFlY2Fnam5pYWtrcGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1NzA5OCwiZXhwIjoyMDk0NDMzMDk4fQ.gw4_FozqJcgys8r7YWuYXOM92eWcgd5xFtn5Wde4tDA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const MESES = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }

function parseFecha(str) {
  // "01/Jul/2026" → "2026-07-01"
  const [d, m, y] = str.split('/')
  return `${y}-${MESES[m]}-${d.padStart(2,'0')}`
}

function parseHora(v) {
  if (!v || v === '—' || v === '') return null
  return String(v).trim()
}

function parseNum(v) {
  if (!v || v === '—' || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

const EXCEL = 'C:/Users/PT/Desktop/reporte-asistencia-fijo_2026-07-01_2026-07-15.xlsx'

const wb   = XLSX.readFile(EXCEL)
const ws   = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const header = rows[0]
console.log('Columnas:', header)

const data = rows.slice(1).filter(r => r[0]) // saltar fila vacía

// Separar por tipo
const overrides   = []
const aprobaciones = []
const fechasUnicas = new Set()

for (const r of data) {
  const fecha         = parseFecha(r[0])
  const cedula        = String(r[1]).trim()
  const nombre        = String(r[2]).trim()
  const entReal       = parseHora(r[4])
  const salidaNorm    = parseHora(r[6])
  const salidaEfec    = parseHora(r[7])
  const minExtra      = parseNum(r[8])
  const hrsExtra      = parseNum(r[9])
  const estadoHE      = String(r[12]).trim()

  if (!cedula || !fecha) continue
  fechasUnicas.add(fecha)

  // Override: cualquier fila con HE aprobadas en el Excel
  // Congelar S.EFEC., MIN+ y HRS+ exactamente como aprobados en el reporte
  const recNocturno = parseNum(r[10])  // columna K = REC.
  if (entReal && hrsExtra != null && hrsExtra > 0) {
    overrides.push({
      cedula,
      fecha,
      hora_ingreso:             entReal,
      salida_efectiva:          salidaEfec,   // S.EFEC. del Excel
      horas_extra_manual:       hrsExtra,      // HRS+ del Excel — congela el valor aprobado
      recargo_nocturno_manual:  recNocturno,   // REC. del Excel (nocturno si aplica)
      configurado_por_nombre: 'Importación Julio 2026',
      configurado_en: new Date().toISOString(),
    })
  }

  // Aprobación
  if (estadoHE === 'Aprobado') {
    aprobaciones.push({ cedula, fecha, aprobado_por_cedula: '0', aprobado_por_nombre: 'Julio 2026 (Importado)', aprobado_en: new Date().toISOString() })
  }
}

// Cierres: uno por fecha
const cierres = [...fechasUnicas].map(fecha => ({
  fecha,
  cerrado_por_nombre: 'Importación Julio 2026',
  cerrado_en: new Date().toISOString(),
}))

console.log(`\nResumen:`)
console.log(`  Overrides a insertar : ${overrides.length}`)
console.log(`  Aprobaciones         : ${aprobaciones.length}`)
console.log(`  Cierres de día       : ${cierres.length}`)
console.log(`  Fechas               : ${[...fechasUnicas].sort().join(', ')}`)

// ── Insertar overrides ────────────────────────────────────────────────────────
console.log('\n→ Insertando overrides...')
if (overrides.length > 0) {
  const { error } = await supabase
    .from('horas_extra_overrides')
    .upsert(overrides, { onConflict: 'cedula,fecha' })
  if (error) { console.error('  ✗ Error overrides:', error.message); process.exit(1) }
  console.log(`  ✓ ${overrides.length} overrides guardados`)
}

// ── Insertar aprobaciones ─────────────────────────────────────────────────────
console.log('→ Insertando aprobaciones...')
if (aprobaciones.length > 0) {
  const { error } = await supabase
    .from('horas_extra_aprobaciones')
    .upsert(aprobaciones, { onConflict: 'cedula,fecha' })
  if (error) { console.error('  ✗ Error aprobaciones:', error.message); process.exit(1) }
  console.log(`  ✓ ${aprobaciones.length} aprobaciones guardadas`)
}

// ── Insertar cierres ──────────────────────────────────────────────────────────
console.log('→ Cerrando días...')
if (cierres.length > 0) {
  const { error } = await supabase
    .from('horas_extra_cierres')
    .upsert(cierres, { onConflict: 'fecha' })
  if (error) { console.error('  ✗ Error cierres:', error.message); process.exit(1) }
  console.log(`  ✓ ${cierres.length} días cerrados`)
}

console.log('\n✅ Importación completada')
