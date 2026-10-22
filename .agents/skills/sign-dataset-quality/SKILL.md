---
name: sign-dataset-quality
description: Audit provenance, annotation consistency, class coverage, privacy, and leakage in sign-language datasets.
---

# Calidad de datasets de señas

## Objetivo y activación

Activa esta guía al recibir datos anotados, preparar particiones, aplicar aumentos o publicar un conjunto derivado. La revisión debe evaluar tanto la calidad técnica como la validez lingüística, el consentimiento y el riesgo de identificar participantes.

## Entradas necesarias

- Manifiesto de muestras con identificadores seudonimizados.
- Procedencia, licencias, consentimiento y finalidad autorizada.
- Esquema de etiquetas y estados de validación lingüística.
- Código y parámetros de preprocesamiento.
- Plan de partición y tarea experimental.

## Procedimiento

1. Comprueba que todas las muestras tengan etiquetas válidas, rangos temporales, formato legible y fuente rastreable.
2. Busca archivos duplicados, repeticiones idénticas, datos corruptos, recortes vacíos y etiquetas incompatibles.
3. Resume cobertura por etiqueta, participante, sesión, variante, entorno y dispositivo. Identifica celdas ausentes y clases con poco soporte.
4. Revisa que personas de evaluación no aparezcan en entrenamiento o validación. Para evaluación de generalización, separa por participante y, cuando corresponda, por sesión.
5. Ajusta balanceo y aumentos usando solo el conjunto de entrenamiento. Registra las transformaciones y evita duplicar muestras en particiones diferentes.
6. Revisa que etiquetas dudosas o pendientes no se hayan mezclado con ejemplos validados.
7. Verifica que los datos identificables estén en almacenamiento privado autorizado y que las exportaciones públicas no permitan reidentificar personas.
8. Emite un informe con hallazgos bloqueantes, correcciones, exclusiones y versión del dataset.

## Restricciones

- No corrijas etiquetas lingüísticas por intuición técnica; deriva el caso a lsb-linguistic-validation.
- No reportes solo un total de muestras: incluye distribución y procedencia.
- No uses particiones aleatorias por fotograma para evaluar generalización entre personas.
- No publiques datos sensibles, enlaces de acceso privado, consentimientos ni identificadores de identidad.
- No borres muestras dudosas sin dejar registro de la exclusión y su motivo.

## Resultados esperados

- Informe de calidad y cobertura.
- Manifiesto depurado con datos personales fuera del repositorio.
- Particiones reproducibles y asignadas por participante.
- Registro de exclusiones, transformaciones y versión del conjunto.

## Verificación

- No hay cruces entre las personas de entrenamiento y evaluación cuando la evaluación requiere separación por participante.
- Las clases minoritarias y ausentes están identificadas.
- Las transformaciones pueden repetirse a partir de configuración versionada.
- El conjunto solo incluye material con permiso aplicable a su finalidad.
- Un revisor puede reconstruir qué muestras entraron en cada partición.

## Ejemplo

Si una misma persona aparece en varias sesiones, todas sus sesiones quedan en una sola partición para una evaluación por participante. Si una muestra no tiene consentimiento verificable, se excluye y se registra el motivo.

## Scripts asociados

No hay un analizador automático de dataset porque el formato aún debe fijarse. Al aprobar el manifiesto, añade un verificador reproducible para duplicados, etiquetas faltantes y cruces de participantes; deja la validez lingüística a revisión humana.

## Fuentes y fundamentos

- Protocolo de datos y consentimientos aprobado para el proyecto.
- Esquema de recolección en .agents/skills/lsb-corpus-entrenamiento/SKILL.md.
- Criterios de validez lingüística en .agents/skills/lsb-linguistic-validation/SKILL.md.
- Plan de medición en .agents/skills/sign-model-benchmark/SKILL.md.
