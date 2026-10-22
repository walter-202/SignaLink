-- Migración inicial para "La Voz de tus Manos"
-- Módulos: Sesiones de atención (procedimientos), mensajes de conversación y catálogo LSB

-- 1. Tabla de Procedimientos / Sesiones de Atención
CREATE TABLE IF NOT EXISTS public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_type TEXT NOT NULL DEFAULT 'Registro ciudadano',
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  notes TEXT DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Índices para búsqueda de historial
CREATE INDEX IF NOT EXISTS idx_procedures_status ON public.procedures(status);
CREATE INDEX IF NOT EXISTS idx_procedures_started_at ON public.procedures(started_at DESC);

-- 2. Tabla de Mensajes de Conversación (Bidireccional LSB <-> Español)
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('citizen', 'staff')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('reviewed-sign', 'typed', 'frequent-phrase', 'dictation', 'demo')) DEFAULT 'typed',
  state TEXT NOT NULL CHECK (state IN ('confirmed', 'sent', 'pending')) DEFAULT 'sent',
  time_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_messages_procedure_id ON public.conversation_messages(procedure_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.conversation_messages(created_at ASC);

-- 3. Tabla de Catálogo Oficial de Señas LSB (Basado en el Corpus de los 4 Módulos)
CREATE TABLE IF NOT EXISTS public.lsb_signs_catalog (
  id TEXT PRIMARY KEY, -- Ej: M1-01-001
  module_id TEXT NOT NULL CHECK (module_id IN ('M1', 'M2', 'M3', 'M4')),
  level TEXT NOT NULL, -- Básico 1, Básico 2, Intermedio, Avanzado
  category TEXT NOT NULL, -- Saludos, Familia, Alimentos, etc.
  category_idx INTEGER NOT NULL,
  number_in_category INTEGER NOT NULL,
  label_es TEXT NOT NULL,
  gloss TEXT NOT NULL, -- Glosa normalizada (HOLA, GRACIAS)
  has_variants BOOLEAN DEFAULT false,
  pdf_page INTEGER,
  num_frames INTEGER DEFAULT 1,
  is_multiphase BOOLEAN DEFAULT false,
  frames JSONB DEFAULT '[]'::jsonb, -- Coordenadas bounding boxes y fotogramas
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_lsb_signs_gloss ON public.lsb_signs_catalog(gloss);
CREATE INDEX IF NOT EXISTS idx_lsb_signs_category ON public.lsb_signs_catalog(category);
CREATE INDEX IF NOT EXISTS idx_lsb_signs_module ON public.lsb_signs_catalog(module_id);

-- 4. Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lsb_signs_catalog ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para uso público durante atención presencial (anon / authenticated)
CREATE POLICY "Lectura pública de catálogo LSB" ON public.lsb_signs_catalog
  FOR SELECT TO public USING (true);

CREATE POLICY "Lectura pública de procedimientos" ON public.procedures
  FOR SELECT TO public USING (true);

CREATE POLICY "Inserción pública de procedimientos" ON public.procedures
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Actualización pública de procedimientos" ON public.procedures
  FOR UPDATE TO public USING (true);

CREATE POLICY "Lectura pública de mensajes de conversación" ON public.conversation_messages
  FOR SELECT TO public USING (true);

CREATE POLICY "Inserción pública de mensajes de conversación" ON public.conversation_messages
  FOR INSERT TO public WITH CHECK (true);
