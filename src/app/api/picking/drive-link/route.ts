import { NextRequest, NextResponse } from 'next/server'

const FOLDER_ID = '19jEydHTzraB4z_ghR-vdk7LGPT--KFHB'

// GET /api/picking/drive-link?doc=PV+10382
// Devuelve la URL directa del archivo en Drive, o la URL de búsqueda como fallback
export async function GET(request: NextRequest) {
  const doc    = new URL(request.url).searchParams.get('doc')?.trim()
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (!doc) return NextResponse.json({ url: `https://drive.google.com/drive/folders/${FOLDER_ID}` })

  // Sin API Key: abrir carpeta
  if (!apiKey) {
    return NextResponse.json({
      url: `https://drive.google.com/drive/folders/${FOLDER_ID}`,
      tipo: 'carpeta',
    })
  }

  try {
    // Buscar el archivo por nombre
    const q       = encodeURIComponent(`'${FOLDER_ID}' in parents and name contains '${doc}' and trashed=false`)
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&orderBy=name&key=${apiKey}`
    const res     = await fetch(listUrl)

    if (res.ok) {
      const data  = await res.json()
      const files: { id: string; name: string; webViewLink: string }[] = data.files ?? []

      if (files.length > 0) {
        return NextResponse.json({
          url:      files[0].webViewLink ?? `https://drive.google.com/file/d/${files[0].id}/view`,
          nombre:   files[0].name,
          tipo:     'archivo',
          file_id:  files[0].id,
        })
      }
    }
  } catch { /* fallback */ }

  // No encontrado: abrir Drive con búsqueda del documento
  return NextResponse.json({
    url:  `https://drive.google.com/drive/search?q=${encodeURIComponent(doc)}`,
    tipo: 'busqueda',
  })
}
