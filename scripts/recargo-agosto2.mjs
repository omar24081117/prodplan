// Asigna recargo_diurno_manual = 8.25 a todo el personal con asistencia el 2026-08-02
// Ejecutar: node scripts/recargo-agosto2.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmxcumqecagjniakkpjp.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndteGN1bXFlY2Fnam5pYWtrcGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1NzA5OCwiZXhwIjoyMDk0NDMzMDk4fQ.gw4_FozqJcgys8r7YWuYXOM92eWcgd5xFtn5Wde4tDA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const FECHA = '2026-08-02'

const { data: asistencias, error: errAsis } = await supabase
  .from('asistencia')
  .select('cedula, nombre, hora_ingreso')
  .eq('fecha', FECHA)
  .not('hora_ingreso', 'is', null)

if (errAsis) { console.error('Error leyendo asistencia:', errAsis.message); process.exit(1) }
console.log(`Empleados con asistencia el ${FECHA}: ${asistencias.length}`)

// Leer overrides existentes para preservar horas_extra_manual
const { data: ovExistentes } = await supabase
  .from('horas_extra_overrides')
  .select('cedula, hora_ingreso, salida_efectiva, horas_extra_manual')
  .eq('fecha', FECHA)

const ovMap = {}
for (const ov of ovExistentes ?? []) ovMap[ov.cedula] = ov

const upserts = asistencias.map(a => ({
  cedula:                 a.cedula,
  fecha:                  FECHA,
  hora_ingreso:           ovMap[a.cedula]?.hora_ingreso ?? a.hora_ingreso,
  salida_efectiva:        ovMap[a.cedula]?.salida_efectiva ?? null,
  horas_extra_manual:     ovMap[a.cedula]?.horas_extra_manual ?? null,
  recargo_diurno_manual:  8.25,
  configurado_por_nombre: 'Recargo diurno ago-02',
  configurado_en:         new Date().toISOString(),
}))

console.log(`\nAplicando recargo_diurno_manual = 8.25 a ${upserts.length} empleados:`)
upserts.forEach(u => {
  const nombre = asistencias.find(a => a.cedula === u.cedula)?.nombre ?? ''
  console.log(`  ${u.cedula}  ${nombre}`)
})

const { error } = await supabase
  .from('horas_extra_overrides')
  .upsert(upserts, { onConflict: 'cedula,fecha' })

if (error) { console.error('\n✗ Error:', error.message); process.exit(1) }
console.log(`\n✅ ${upserts.length} registros actualizados — recargo diurno = 8.25 h para el ${FECHA}`)
