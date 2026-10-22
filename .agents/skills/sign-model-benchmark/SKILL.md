---
name: sign-model-benchmark
description: Design reproducible, participant-aware benchmarks for sign-recognition models and browser inference.
---

# Benchmark de modelos de señas

## Objetivo y activación

Usa esta guía al comparar modelos, modificar preprocesamiento, cambiar una versión de datos o comunicar resultados de reconocimiento. El benchmark debe dejar claro qué tarea y población se midieron y qué conclusiones no permite extraer.

## Entradas necesarias

- Modelo, manifiesto, código de preprocesamiento y versiones.
- Dataset validado con particiones por participante.
- Pregunta y criterio de comparación definidos antes de observar resultados.
- Dispositivos, navegadores y condiciones de inferencia objetivo.

## Procedimiento

1. Congela los identificadores de modelo, datos, particiones, dependencias, semilla y configuración.
2. Incluye una línea base sencilla y fija el mismo protocolo para cada candidato.
3. Para clasificación aislada reporta al menos exactitud, F1 macro, matriz de confusión y soporte por clase. Añade top-k solo si el producto lo usa.
4. Para reconocimiento continuo, reporta métricas de secuencia como WER o CER junto a la definición de normalización y segmentación.
5. Separa el rendimiento lingüístico del rendimiento de ejecución. Mide tiempo de carga, latencia de inferencia, memoria y errores en dispositivos representativos.
6. Informa resultados por participante o grupo cuando sea posible, además del promedio general. Señala clases o condiciones con baja cobertura.
7. Evalúa umbrales de abstención y calibración antes de mostrar una puntuación de confianza a usuarios.
8. Repite mediciones relevantes y registra dispersión, fallos y diferencias entre el pipeline de referencia y navegador.
9. Guarda resultados estructurados en model-lab y resume configuración, limitaciones y fecha en docs/research.

## Restricciones

- No uses datos de entrenamiento para escoger el modelo y después llamarlos evaluación.
- No compares métricas calculadas con particiones, limpieza o umbrales distintos sin explicarlo.
- No anuncies una cifra única como precisión universal de LSB.
- No afirmes traducción si solo se evaluó clasificación de señas aisladas.
- No ocultes participantes, clases, condiciones o fallos que cambien la interpretación del resultado.

## Resultados esperados

- Configuración versionada del experimento.
- Tabla de métricas por tarea, clase y condiciones relevantes.
- Evidencia de inferencia en navegador y dispositivos objetivo.
- Recomendación de homologación con límites de uso.

## Verificación

- El experimento se puede reproducir con el mismo modelo y particiones.
- La evaluación no contiene participantes del entrenamiento cuando se mide generalización.
- Cada métrica tiene definición, soporte y método de cálculo.
- Las afirmaciones públicas corresponden a las mediciones realizadas.
- Los resultados se vinculan a hashes o versiones de datos y modelo.

## Ejemplo

Al comparar dos clasificadores de señas aisladas, usa las mismas personas de evaluación y reporta F1 macro junto a exactitud y soporte por clase. La latencia en navegador se registra aparte y no se mezcla con la métrica lingüística.

## Scripts asociados

Los experimentos y sus configuraciones pertenecen a model-lab. No hay un comando único todavía; primero deben definirse el esquema de datos y las particiones aprobadas para evitar una evaluación irreproducible.

## Fuentes y fundamentos

- Contratos y candidatos descritos en README.md.
- .agents/skills/sign-dataset-quality/SKILL.md.
- Documentación de ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
