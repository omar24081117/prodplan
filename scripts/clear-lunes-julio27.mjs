// Pone horas_extra_manual = 0 para todos los empleados con asistencia el lunes 27 de julio.
// Esto congela el valor en 0 e impide que el app recalcule horas automáticas (día libre).
// El recargo se ingresará manual desde la app.
// Ejecutar: node scripts/clear-lunes-julio27.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmxcumqecagjniakkpjp.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGN1bXFlY2Fnam5pYWtrcGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1NzA5OCwiZXhwIjoyMDk0NDMzMDk4fQ.gw4_FozqJcgys8r7YWuYXOM92eWcgd5xFtn5Wde4tDA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const FECHA = '2026-07-27'

// 1. Empleados con asistencia ese día
const { data: asistencias, error: errAsis } = await supabase
  .from('asistencia')
  .select('cedula, nombre, hora_ingreso')
  .eq('fecha', FECHA)
  .not('hora_ingreso', 'is', null)

if (errAsis) { console.error('Error leyendo asistencia:', errAsis.message); process.exit(1) }
console.log(`Empleados con asistencia el ${FECHA}: ${asistencias.length}`)

// 2. Overrides existentes para conservar hora_ingreso guardada si la hay
const { data: ovExistentes } = await supabase
  .from('horas_extra_overrides')
  .select('cedula, hora_ingreso, salida_efectiva')
  .eq('fecha', FECHA)

const ovMap = {}
for (const ov of ovExistentes ?? []) ovMap[ov.cedula] = ov

// 3. Upsert con horas_extra_manual = 0 (congela en 0, sin recalcular)
const upserts = asistencias.map(a => ({
  cedula:             a.cedula,
  fecha:              FECHA,
  hora_ingreso:       ovMap[a.cedula]?.hora_ingreso ?? a.hora_ingreso,
  salida_efectiva:    ovMap[a.cedula]?.salida_efectiva ?? null,
  horas_extra_manual: 0,
  configurado_por_nombre: 'Lunes libre Jul-27',
  configurado_en:     new Date().toISOString(),
}))

console.log(`\nAplicando a ${upserts.length} empleados:`)
upserts.forEach(u => console.log(`  ${u.cedula} → HRS+: 0`))

const { error } = await supabase
  .from('horas_extra_overrides')
  .upsert(upserts, { onConflict: 'cedula,fecha' })

if (error) { console.error('\n✗ Error:', error.message); process.exit(1) }
console.log(`\n✅ ${upserts.length} registros actualizados — horas extras = 0`)
console.log('   Ahora ingresa los recargos manualmente desde la app.')
