---
name: lsb-corpus-entrenamiento
description: Plan and document an authorized, reproducible corpus of Lengua de Señas Boliviana recordings and annotations for research and model training.
---

# Entrenamiento del corpus LSB

## Objetivo y activación

Usa esta guía al definir vocabulario, grabar señas, etiquetar material o preparar datos de entrenamiento para modelos de Lengua de Señas Boliviana (LSB). El corpus debe representar expresiones y personas con autorización verificable; no se debe completar con datos inventados para cubrir clases.

> Estado: guía de trabajo del proyecto. Las notas técnicas vinculadas abajo son propuestas para investigación, no reglas lingüísticas validadas ni parámetros aprobados para producción.

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

## Separación de tareas de IA

Trata como tareas distintas la clasificación de señas aisladas (ISLR), el reconocimiento continuo a glosas (CSLR) y la generación de español desde glosas (Gloss-to-Text). No presentes una métrica de una etapa como resultado de traducción completa.

Para el MVP, el modelo entrega candidatos revisables. La persona usuaria debe poder confirmar, corregir o descartar el texto. El entrenamiento y el post-procesamiento quedan fuera del runtime de la PWA y se evalúan con particiones y datos autorizados.

## Material disponible de Apaza

- Notas de gramática y morfosintaxis en references/gramatica_y_morfosintaxis_lsb.md.
- Notas de preparación y evaluación de modelos en references/guia_pre_post_entrenamiento_lsb.md.
- Notas de parámetros formacionales en references/parametros_formacionales_y_simbologia.md.
- Ejemplos heurísticos sin aprobación lingüística en examples/ejemplos_traduccion_glosa_a_espanol.json.
- Herramientas experimentales en scripts/.
- Procedencia, estado de licencia y auditoría del vocabulario en references/README.md.

## Restricciones

- No incluyas videos, audio, rostros identificables ni datos de consentimiento en Git.
- No publiques el vocabulario extraído de los módulos hasta documentar permisos de redistribución y corregir los hallazgos de calidad descritos en references/README.md.
- No infieras una seña oficial a partir de una traducción literal, un diccionario de otra lengua o una salida de un modelo.
- No mezcles datos de entrenamiento, validación y evaluación sin registrar el origen y la regla de partición.
- No prometas anonimato absoluto para video: el rostro, cuerpo y forma de señar pueden identificar a una persona.
- No uses una cifra de fotogramas por segundo o características por cuadro como regla universal; documenta y justifica la configuración de cada experimento.
- No conviertas las notas de gramática en una regla del modelo sin validación lingüística con fuente y página.

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

Los scripts de scripts/ son experimentales. El extractor requiere archivos PDF autorizados y puede generar metadatos incorrectos; revisa el resultado antes de usarlo. El buscador requiere un vocabulario local generado y autorizado, no incluido en este repositorio. El traductor por reglas es solo un baseline ilustrativo y no puede producir traducciones LSB garantizadas.

## Fuentes y fundamentos

- Fichas oficiales de los módulos, con atribución y estado de derechos, en references/README.md.
- Protocolo institucional de ética y tratamiento de datos aplicable al proyecto.
- skill/lsb-linguistic-validation/SKILL.md y skill/sign-dataset-quality/SKILL.md.
