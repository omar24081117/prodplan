# Configuración de Supabase para PRODPLAN
### Desde cero hasta tener la conexión lista en el frontend

---

## Paso 1 — Crear cuenta en Supabase

1. Ve a **[supabase.com](https://supabase.com)**
2. Clic en **"Start your project"**
3. Inicia sesión con tu **cuenta de Google corporativa**
4. Autoriza el acceso cuando Google lo solicite

---

## Paso 2 — Crear el proyecto

1. Una vez dentro del dashboard, clic en **"New project"**
2. Completa el formulario:

   | Campo | Valor |
   |---|---|
   | **Name** | `prodplan` |
   | **Database Password** | Crea una contraseña segura y **guárdala** |
   | **Region** | `South America (São Paulo)` — la más cercana a Colombia |
   | **Plan** | Free |

3. Clic en **"Create new project"**
4. Espera **2-3 minutos** mientras Supabase aprovisiona la base de datos
   > La pantalla mostrará un spinner. No cierres la pestaña.

---

## Paso 3 — Crear las tablas

Una vez el proyecto esté listo, ve al **SQL Editor**:

1. En el menú izquierdo busca el ícono **`</>`** que dice **SQL Editor**
2. Clic en **"New query"**
3. Copia y pega el siguiente bloque completo y presiona **"Run"** (o `Ctrl + Enter`)

```sql
-- ─────────────────────────────────────────────
-- PRODPLAN — Creación de tablas
-- Ejecutar todo de una sola vez
-- ─────────────────────────────────────────────

-- 1. PERSONAL (operarios registrados)
create table if not exists personal (
  id uuid primary key default gen_random_uuid(),
  cedula text unique not null,
  nombre text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

-- 2. CATÁLOGO DE PRODUCTOS
create table if not exists catalogo (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  nombre text not null,
  created_at timestamptz default now()
);

-- 3. JORNADAS (encabezado del día)
create table if not exists jornadas (
  id uuid primary key default gen_random_uuid(),
  fecha date unique not null,
  semana text,
  personal_disponible integer not null,
  created_at timestamptz default now()
);

-- 4. ACTIVIDADES (planeación por jornada)
create table if not exists actividades (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid references jornadas(id) on delete cascade,
  sku text,
  producto text not null,
  proceso text not null,
  turno text default 'MAÑANA',
  personal_planeado integer,
  cantidad integer not null,
  lote text,
  notas text,
  created_at timestamptz default now()
);

-- 5. OPERARIOS ASIGNADOS a cada actividad
create table if not exists actividad_operarios (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid references actividades(id) on delete cascade,
  cedula text not null,
  nombre text not null,
  hora_asignacion text,
  created_at timestamptz default now(),
  unique(actividad_id, cedula)
);

-- 6. REPORTES HORA A HORA
create table if not exists reportes (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid references actividades(id) on delete cascade,
  hora text not null,
  cantidad integer not null,
  operario_cedula text,
  operario_nombre text,
  created_at timestamptz default now(),
  unique(actividad_id, hora)
);

-- 7. ASISTENCIA
create table if not exists asistencia (
  id uuid primary key default gen_random_uuid(),
  cedula text not null,
  nombre text not null,
  fecha date not null,
  turno text default 'MAÑANA',
  hora_ingreso text,
  hora_salida text,
  created_at timestamptz default now(),
  unique(cedula, fecha)
);
```

4. Verifica que aparezca el mensaje **"Success. No rows returned"** en verde
5. En el menú izquierdo ve a **Table Editor** y confirma que aparecen las 7 tablas

---

## Paso 4 — Configurar permisos (RLS)

Las tablas de Supabase por defecto bloquean todo el acceso. Necesitas abrir los permisos para que la app pueda leer y escribir.

1. Sigue en el **SQL Editor**
2. Clic en **"New query"**
3. Pega y ejecuta este bloque:

```sql
-- ─────────────────────────────────────────────
-- PRODPLAN — Políticas de acceso (RLS)
-- ─────────────────────────────────────────────

-- Activar RLS en todas las tablas
alter table personal enable row level security;
alter table catalogo enable row level security;
alter table jornadas enable row level security;
alter table actividades enable row level security;
alter table actividad_operarios enable row level security;
alter table reportes enable row level security;
alter table asistencia enable row level security;

-- ── LECTURA PÚBLICA (cualquier usuario puede leer) ──
create policy "leer personal"
  on personal for select using (true);

create policy "leer catalogo"
  on catalogo for select using (true);

create policy "leer jornadas"
  on jornadas for select using (true);

create policy "leer actividades"
  on actividades for select using (true);

create policy "leer actividad_operarios"
  on actividad_operarios for select using (true);

create policy "leer reportes"
  on reportes for select using (true);

create policy "leer asistencia"
  on asistencia for select using (true);

-- ── ESCRITURA PÚBLICA (cualquier usuario puede escribir) ──
-- Nota: esto es suficiente para empezar.
-- En producción avanzada se restringe por rol de usuario.

create policy "escribir personal"
  on personal for all using (true) with check (true);

create policy "escribir catalogo"
  on catalogo for all using (true) with check (true);

create policy "escribir jornadas"
  on jornadas for all using (true) with check (true);

create policy "escribir actividades"
  on actividades for all using (true) with check (true);

create policy "escribir actividad_operarios"
  on actividad_operarios for all using (true) with check (true);

create policy "escribir reportes"
  on reportes for all using (true) with check (true);

create policy "escribir asistencia"
  on asistencia for all using (true) with check (true);
```

4. Confirma que aparece **"Success"** en verde

---

## Paso 5 — Obtener las credenciales

Estas dos claves son las que conectan tu app con Supabase.

1. En el menú izquierdo clic en el ícono de engranaje **⚙️ Settings**
2. Luego clic en **"API"**
3. Verás dos valores que necesitas copiar:

```
Project URL
─────────────────────────────────────────────
https://xxxxxxxxxxxxxxxxxxx.supabase.co
                  ↑
          Tu URL única del proyecto

anon public
─────────────────────────────────────────────
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx...
                  ↑
         Tu clave pública (es seguro exponerla)
```

> **Importante:**
> - La clave **`anon public`** es segura para usar en el frontend
> - La clave **`service_role`** es secreta — NUNCA la pongas en el frontend
> - No compartas estas claves por WhatsApp o correo sin cifrar

4. Guarda ambos valores en un lugar seguro (un bloc de notas por ahora)

---

## Paso 6 — Activar Realtime (actualizaciones en vivo)

Para que los reportes hora a hora se sincronicen entre dispositivos sin recargar:

1. En el menú izquierdo clic en **"Database"**
2. Luego clic en **"Replication"**
3. Busca la sección **"Tables"**
4. Activa el toggle para estas tablas:
   - ✅ `reportes`
   - ✅ `asistencia`
   - ✅ `actividad_operarios`
5. Las demás las puedes dejar desactivadas por ahora

---

## Paso 7 — Conectar desde el frontend

### Opción A — Si usas el prototipo actual (React / Claude Artifacts)

Agrega estas dos constantes al inicio del archivo `.jsx`:

```js
// ─── SUPABASE CONFIG ───────────────────────────────────────────────
const SUPABASE_URL = "https://xxxxxxxxxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx...";

// Cliente de Supabase (sin instalación, usando CDN)
const { createClient } = supabase; // disponible si cargas el script CDN
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Para cargar Supabase sin npm (en HTML puro o artifacts):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

### Opción B — Si usas Next.js (recomendado para producción)

```bash
# En la terminal del proyecto
npm install @supabase/supabase-js
```

Crea el archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx...
```

Crea el archivo `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

Uso en cualquier componente:

```typescript
import { supabase } from "@/lib/supabase";

// Leer jornadas
const { data, error } = await supabase
  .from("jornadas")
  .select("*")
  .order("fecha", { ascending: false });

// Insertar una jornada
const { data, error } = await supabase
  .from("jornadas")
  .insert({ fecha: "2026-05-15", personal_disponible: 20, semana: "Semana 20" });

// Insertar una actividad
const { data, error } = await supabase
  .from("actividades")
  .insert({
    jornada_id: "uuid-de-la-jornada",
    producto: "Crema de Manos 200ml",
    sku: "1001",
    proceso: "Envasado",
    turno: "MAÑANA",
    cantidad: 5000,
  });

// Registrar reporte hora a hora
const { data, error } = await supabase
  .from("reportes")
  .upsert({
    actividad_id: "uuid-de-la-actividad",
    hora: "08:00 - 09:00",
    cantidad: 350,
    operario_cedula: "1234567890",
    operario_nombre: "Juan Pérez",
  });

// Marcar asistencia
const { data, error } = await supabase
  .from("asistencia")
  .insert({
    cedula: "1234567890",
    nombre: "Juan Pérez",
    fecha: "2026-05-15",
    turno: "MAÑANA",
    hora_ingreso: "07:05",
  });
```

---

## Paso 8 — Verificar que todo funciona

Haz esta prueba rápida desde el **SQL Editor** de Supabase:

```sql
-- Insertar un operario de prueba
insert into personal (cedula, nombre)
values ('1234567890', 'Juan Pérez de Prueba');

-- Verificar que se insertó
select * from personal;

-- Insertar un producto de prueba
insert into catalogo (sku, nombre)
values ('9999', 'PRODUCTO DE PRUEBA');

-- Verificar catálogo
select * from catalogo;

-- Limpiar los datos de prueba
delete from personal where cedula = '1234567890';
delete from catalogo where sku = '9999';
```

Si ves los datos aparecer y desaparecer correctamente, **Supabase está listo**.

---

## Resumen de lo que hiciste

```
✅ Paso 1 — Cuenta creada con Google corporativa
✅ Paso 2 — Proyecto "prodplan" en São Paulo
✅ Paso 3 — 7 tablas creadas (personal, catalogo, jornadas,
            actividades, actividad_operarios, reportes, asistencia)
✅ Paso 4 — Permisos de lectura y escritura activados (RLS)
✅ Paso 5 — Credenciales copiadas (URL + anon key)
✅ Paso 6 — Realtime activado para reportes, asistencia y operarios
✅ Paso 7 — Cliente de Supabase configurado en el frontend
✅ Paso 8 — Prueba exitosa de inserción y lectura
```

---

## Próximo paso

Con Supabase configurado, el siguiente paso es reemplazar el estado local
(`useState`) del prototipo actual por llamadas reales a Supabase.

Cada `setJornadas(...)` se convierte en un `supabase.from("jornadas").insert(...)`.
Cada carga inicial se convierte en un `supabase.from("jornadas").select("*")`.

Esto lo hace Claude Code automáticamente con el prompt:

```
Tengo este componente React con useState para manejar jornadas.
Reemplaza toda la lógica de estado local por llamadas a Supabase.
URL: https://xxx.supabase.co
Las tablas son: jornadas, actividades, reportes, asistencia, personal, catalogo.
Mantén el mismo diseño visual, solo cambia la fuente de datos.
[pegar el componente]
```

---

## Solución de problemas frecuentes

| Error | Causa probable | Solución |
|---|---|---|
| `relation "X" does not exist` | La tabla no se creó | Volver al Paso 3 y ejecutar el SQL |
| `new row violates row-level security` | RLS sin políticas | Volver al Paso 4 y ejecutar el SQL de permisos |
| `duplicate key value violates unique constraint` | Ya existe ese registro | Usar `upsert` en vez de `insert` |
| `JWT expired` | La sesión venció | Volver a obtener la anon key del dashboard |
| `Failed to fetch` | URL incorrecta o red | Verificar la URL en Settings → API |
| Los datos no aparecen en tiempo real | Realtime no activado | Volver al Paso 6 y activar las tablas |
