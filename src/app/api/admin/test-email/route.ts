import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function clean(v: string | undefined) {
  const s = v ?? ''
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

function fechaLegible(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`
}

function buildHtml(
  registros: { cedula: string; nombre: string; hora_ingreso: string; hora_salida: string | null }[],
  fecha: string,
  horaEnvio: string
): string {
  const enPlanta   = registros.filter(r => !r.hora_salida)
  const conSalida  = registros.filter(r =>  r.hora_salida)

  const rowsEnPlanta = enPlanta.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827">${r.nombre}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;color:#6b7280;font-size:13px">${r.cedula}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;color:#059669;font-weight:700">${r.hora_ingreso}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;color:#6b7280">${r.hora_salida ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">
        <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">EN PLANTA</span>
      </td>
    </tr>`).join('')

  const rowsConSalida = conSalida.map(r => `
    <tr style="opacity:0.7">
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151">${r.nombre}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;color:#9ca3af;font-size:13px">${r.cedula}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;color:#9ca3af">${r.hora_ingreso}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;color:#f97316">${r.hora_salida}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center">
        <span style="background:#fff7ed;color:#c2410c;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">SALIDA</span>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#166534,#15803d);padding:28px 32px">
      <p style="margin:0;color:#bbf7d0;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase">Control de Asistencia · CORREO DE PRUEBA</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:24px;font-weight:800">${fechaLegible(fecha)}</h1>
      <p style="margin:4px 0 0;color:#86efac;font-size:13px">Reporte generado a las ${horaEnvio} COT</p>
    </div>
    <div style="display:flex;gap:0;border-bottom:1px solid #e5e7eb">
      <div style="flex:1;padding:20px 24px;text-align:center;border-right:1px solid #e5e7eb">
        <p style="margin:0;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Total registros</p>
        <p style="margin:4px 0 0;color:#111827;font-size:32px;font-weight:900">${registros.length}</p>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center;border-right:1px solid #e5e7eb;background:#f0fdf4">
        <p style="margin:0;color:#166534;font-size:11px;font-weight:600;text-transform:uppercase">En planta</p>
        <p style="margin:4px 0 0;color:#166534;font-size:32px;font-weight:900">${enPlanta.length}</p>
      </div>
      <div style="flex:1;padding:20px 24px;text-align:center">
        <p style="margin:0;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Con salida</p>
        <p style="margin:4px 0 0;color:#ea580c;font-size:32px;font-weight:900">${conSalida.length}</p>
      </div>
    </div>
    <div style="padding:24px 24px 8px">
      ${enPlanta.length > 0 ? `
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.08em">Personal en planta (${enPlanta.length})</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f0fdf4">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Nombre</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Cédula</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Ingreso</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Salida</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase">Estado</th>
        </tr></thead>
        <tbody>${rowsEnPlanta}</tbody>
      </table>` : ''}
      ${conSalida.length > 0 ? `
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em">Con salida registrada (${conSalida.length})</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f9fafb">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Nombre</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Cédula</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Ingreso</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Salida</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Estado</th>
        </tr></thead>
        <tbody>${rowsConSalida}</tbody>
      </table>` : ''}
      ${registros.length === 0 ? `<p style="text-align:center;color:#9ca3af;padding:32px">No hay registros de asistencia para esta fecha.</p>` : ''}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center">Este correo fue generado automáticamente por el sistema ProdPlan · Justo Pago</p>
    </div>
  </div>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const svcKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (authHeader !== `Bearer ${svcKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const resendKey = clean(process.env.RESEND_API_KEY)
  const destinatarios = clean(process.env.EMAIL_ASISTENCIA)
  if (!resendKey || !destinatarios) {
    return NextResponse.json({ error: 'RESEND_API_KEY o EMAIL_ASISTENCIA no configurados' }, { status: 500 })
  }

  const supabase = createClient(clean(process.env.NEXT_PUBLIC_SUPABASE_URL), svcKey)
  const { data: registros, error } = await supabase
    .from('asistencia')
    .select('cedula, nombre, hora_ingreso, hora_salida')
    .eq('fecha', fecha)
    .not('hora_ingreso', 'is', null)
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const horaEnvio = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false })
  const html = buildHtml(registros ?? [], fecha, horaEnvio)
  const resend = new Resend(resendKey)
  const to = destinatarios.split(',').map(e => e.trim()).filter(Boolean)

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: 'ProdPlan Asistencia <onboarding@resend.dev>',
    to,
    subject: `[PRUEBA] Asistencia ${fecha} · ${(registros ?? []).length} registros`,
    html,
  })

  if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 })
  return NextResponse.json({ ok: true, fecha, emailId: emailData?.id, destinatarios: to, total: (registros ?? []).length })
}
