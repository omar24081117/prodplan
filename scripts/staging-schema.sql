CREATE TABLE IF NOT EXISTS personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula text NOT NULL UNIQUE,
  nombre text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  nombre text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  semana text,
  personal_disponible integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid REFERENCES jornadas(id) ON DELETE CASCADE,
  sku text,
  producto text NOT NULL,
  proceso text NOT NULL,
  turno text DEFAULT 'MAÑANA',
  personal_planeado integer,
  cantidad integer NOT NULL,
  lote text,
  notas text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_id uuid REFERENCES actividades(id) ON DELETE CASCADE,
  hora text NOT NULL,
  cantidad integer NOT NULL,
  operario_cedula text,
  operario_nombre text,
  tiempo_improductivo integer,
  observacion text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(actividad_id, hora)
);

CREATE TABLE IF NOT EXISTS asistencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula text NOT NULL,
  nombre text NOT NULL,
  fecha date NOT NULL,
  turno text DEFAULT 'MAÑANA',
  hora_ingreso text,
  hora_salida text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cedula, fecha)
);

CREATE TABLE IF NOT EXISTS actividad_operarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_id uuid REFERENCES actividades(id) ON DELETE CASCADE,
  cedula text NOT NULL,
  nombre text NOT NULL,
  hora_asignacion text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(actividad_id, cedula)
);
