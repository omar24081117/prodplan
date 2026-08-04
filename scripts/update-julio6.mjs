// Actualiza todos los empleados con asistencia el 6 de julio:
// horas_extra_manual = 2.5, recargo_diurno_manual = 8.75
// Ejecutar: node scripts/update-julio6.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmxcumqecagjniakkpjp.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGN1bXFlY2Fnam5pYWtrcGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1NzA5OCwiZXhwIjoyMDk0NDMzMDk4fQ.gw4_FozqJcgys8r7YWuYXOM92eWcgd5xFtn5Wde4tDA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const FECHA = '2026-07-06'
const HRS_EXTRA  = 2.5
const REC_DIURNO = 8.75

// 1. Obtener todos los registros de asistencia del día
const { data: asistencias, error: errAsis } = await supabase
  .from('asistencia')
  .select('cedula, nombre, hora_ingreso')
  .eq('fecha', FECHA)
  .not('hora_ingreso', 'is', null)

if (errAsis) { console.error('Error leyendo asistencia:', errAsis.message); process.exit(1) }
console.log(`Empleados con asistencia el ${FECHA}: ${asistencias.length}`)

// 2. Obtener overrides existentes para mantener hora_ingreso y salida_efectiva
const { data: ovExistentes } = await supabase
  .from('horas_extra_overrides')
  .select('cedula, hora_ingreso, salida_efectiva')
  .eq('fecha', FECHA)

const ovMap = {}
for (const ov of ovExistentes ?? []) ovMap[ov.cedula] = ov

// 3. Construir upserts
const upserts = asistencias.map(a => ({
  cedula:               a.cedula,
  fecha:                FECHA,
  hora_ingreso:         ovMap[a.cedula]?.hora_ingreso ?? a.hora_ingreso,
  salida_efectiva:      ovMap[a.cedula]?.salida_efectiva ?? null,
  horas_extra_manual:   HRS_EXTRA,
  recargo_diurno_manual: REC_DIURNO,
  configurado_por_nombre: 'Actualización Jul-6',
  configurado_en:       new Date().toISOString(),
}))

console.log(`\nUpserts a aplicar: ${upserts.length}`)
upserts.forEach(u => console.log(`  ${u.cedula} → HRS+: ${u.horas_extra_manual}  REC.D.: ${u.recargo_diurno_manual}`))

const { error } = await supabase
  .from('horas_extra_overrides')
  .upsert(upserts, { onConflict: 'cedula,fecha' })

if (error) { console.error('\n✗ Error:', error.message); process.exit(1) }
console.log(`\n✅ ${upserts.length} registros actualizados`)
