---
name: lsb-corpus-entrenamiento
description: Plan and document an authorized, reproducible corpus of Lengua de Señas Boliviana recordings and annotations for research and model training.
---

# Entrenamiento del corpus LSB

## Objetivo y activación

Usa esta guía al definir vocabulario, grabar señas, etiquetar material o preparar datos de entrenamiento para modelos de Lengua de Señas Boliviana (LSB). El corpus debe representar expresiones y personas con autorización verificable; no se debe completar con datos inventados para cubrir clases.

## Entradas necesarias

- Pregunta de investigación y tarea delimitada: clasificación de señas aisladas, reconocimiento continuo u otra.
- Lista inicial de glosas o expresiones, con fuente y propósito.
- Protocolo de participación, consentimiento y resguardo aprobado por el equipo académico.
- Esquema de anotación acordado con la skill de validación lingüística.
- Destino privado autorizado para videos y datos identificables.

Si falta autorización para grabar o reutilizar material, limita el trabajo a planificar el protocolo y documentar fuentes públicas. No descargues ni copies videos por asumir que su publicación permite reutilizarlos.

## Procedimiento

1. Delimita la tarea, población, región y contexto de uso. Registra qué queda fuera del corpus.
2. Asigna identificadores estables a señas y participantes seudonimizados. Conserva la relación con identidades solo en el sistema restringido que aprobó el equipo.
3. Para cada término registra glosa provisional, significado previsto, variantes conocidas, fuente bibliográfica, página o marca temporal y estado de validación lingüística.
4. Define el protocolo de grabación antes de captar datos: cámara, encuadre, iluminación, fondo, frecuencia de cuadros, repeticiones, descansos, instrucciones y metadatos técnicos.
5. Registra por muestra el identificador de seña, participante seudonimizado, sesión, variante, segmentos temporales, condiciones de captura, consentimiento vigente y anotador.
6. Separa la grabación original de las versiones procesadas. Registra cada transformación y conserva el original solo en el almacenamiento aprobado.
7. Revisa muestras y anotaciones con una persona competente en LSB. Marca discrepancias como pendientes; no las conviertas en etiquetas definitivas por mayoría automática.
8. Entrega a control de calidad un manifiesto de datos sin nombres, contactos ni videos. Coordina con sign-dataset-quality antes de crear particiones.

## Restricciones

- No incluyas videos, audio, rostros identificables ni datos de consentimiento en Git.
- No infieras una seña oficial a partir de una traducción literal, un diccionario de otra lengua o una salida de un modelo.
- No mezcles datos de entrenamiento, validación y evaluación sin registrar el origen y la regla de partición.
- No prometas anonimato absoluto para video: el rostro, cuerpo y forma de señar pueden identificar a una persona.
- No uses una cifra de fotogramas por segundo o características por cuadro como regla universal; documenta y justifica la configuración de cada experimento.

## Resultados esperados

- Protocolo de recolección versionado en docs/research.
- Catálogo de etiquetas y manifiesto de muestras sin datos personales.
- Registro de consentimiento y permisos en el sistema privado aprobado.
- Informe de cobertura, variantes, exclusiones y limitaciones.

## Verificación

- Cada etiqueta tiene fuente y estado lingüístico explícitos.
- Cada muestra tiene consentimiento y procedencia comprobables.
- Los archivos privados no aparecen en el árbol Git.
- La partición de evaluación puede reconstruirse sin mezclar participantes.
- Una persona distinta del anotador puede revisar el esquema y reproducir la preparación.

## Ejemplo

Al proponer una nueva seña, registra primero su fuente y estado como propuesta, solicita revisión lingüística y define el consentimiento y protocolo de captura. Solo después de aprobar esos pasos se graban muestras; los videos permanecen en almacenamiento privado.

## Scripts asociados

No hay un recolector automático: la autorización, el consentimiento y la grabación requieren control humano. Si se define un manifiesto estable, puede añadirse un validador que revise metadatos sin abrir ni copiar videos.

## Fuentes y fundamentos

- Ministerio de Educación de Bolivia, Curso de enseñanza de la Lengua de Señas Boliviana, módulos 1–4, según la bibliografía registrada en el README.
- Protocolo institucional de ética y tratamiento de datos aplicable al proyecto.
- skill/lsb-linguistic-validation/SKILL.md y skill/sign-dataset-quality/SKILL.md.
