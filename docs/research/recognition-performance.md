# Reconocimiento: medición y primera optimización

## Objetivo y alcance

Reducir al menos 50% la mediana y el percentil 95 del tiempo entre inicio real de
una seña y propuesta, comparando las mismas muestras, participantes, navegador y
equipo. No es todavía un resultado demostrado. La duración física de una seña,
la carga inicial de artefactos y la confirmación humana se reportan por separado.

La primera entrega conserva el ONNX LSB v4, su hash, las 58 etiquetas, el tensor
`[1,30,138]`, la extracción de características y el umbral experimental 0.50.
No introduce traducción de frases, recorte de secuencias ni modelos LSA como LSB.

## Cambios del pipeline continuous-v2

- El detector entrega cada fotograma procesado directamente al pipeline, sin
  esperar un render de React. La vista de landmarks se publica como máximo cada
  100 ms; eso no reduce la frecuencia del reconocimiento.
- Se agenda con `requestVideoFrameCallback` si está disponible, con fallback a
  `requestAnimationFrame`. Se conserva el intervalo solicitado de 33 ms y se
  evita procesar dos veces el mismo tiempo de video. No se garantizan 30 FPS.
- La recuperación por reposo empieza al completar la ventana, en paralelo a la
  inferencia. Sus umbrales de movimiento y espera siguen sin cambios.
- Se permite una inferencia activa y una secuencia pendiente. El clasificador
  nunca recibe dos llamadas simultáneas, incluso al detener y reiniciar.
- Ante saturación o una secuencia pendiente de más de 2 s se avisa y la UI
  detiene el reconocimiento para revisar; no se acumula una cola creciente.
- Una interrupción de fotogramas superior a 1 s reinicia la segmentación para
  no unir fragmentos separados por una pausa de la pestaña o de la cámara.
- Detener, cambiar de atención o desmontar invalida resultados tardíos.
- Las propuestas siguen siendo texto editable; este pipeline no confirma ni
  guarda mensajes automáticamente.

El baseline conserva MediaPipe síncrono en el hilo principal. Existe un
[Worker optativo con fallback al iniciar](landmark-worker.md), con una sola
imagen en tránsito, descarte de resultados de más de 1 s o de una pestaña oculta
y liberación de recursos al detener. No cambia las 30 observaciones ni las 138
características. La [carga verificada y caché de Holistic](holistic-assets.md) está
implementada; falta provisionar el archivo real revisado. Reutilizar detectores
entre rutas sigue pendiente.

## Diagnóstico local

En **Ajustes de captura → Rendimiento de esta sesión**, actualizar o exportar el
informe. La descarga JSON es manual. No se envían métricas a Supabase ni a
analítica. Cada etapa conserva como máximo 120 valores en memoria y exporta
agregados: total observado, número de muestras retenidas, media, p50 y p95.
Los percentiles usan el método de rango más próximo sobre las muestras retenidas.
El informe incluye ID, versión, hash del modelo, esquema de características y dimensiones de entrada para identificar el contrato medido. No se incluyen imágenes, landmarks, tensores, etiquetas, mensajes ni IDs de atención. Al cambiar de modelo se reinicia la medición y se descartan resultados tardíos del anterior.
El esquema JSON v4 incluye `landmarkRuntime`, soporte de medición de fluidez,
intervalo solicitado y umbrales del clasificador. Conserva modo realmente usado,
delegado GPU/CPU, fallback y metadatos de integridad/lectura de los pesos, sin rutas
ni detalles de excepciones. La [comparación local](recognition-comparison.md)
valida estos contratos sin aprobar automáticamente la meta del 50%.
La memoria se libera al desmontar el panel; reiniciar la medición limpia contadores.

| Medición | Qué representa |
| --- | --- |
| modelLoadMs | Importación, lectura, hash e inicialización del clasificador |
| modelDownloadMs | Lectura completa del ONNX; puede proceder de caché |
| modelIntegrityMs | Verificación SHA-256 |
| modelSessionMs | Creación de sesión ONNX y validación de entrada |
| landmarkLoadMs | Inicialización del detector MediaPipe |
| landmarkAssetReadMs | Lectura de los pesos de Holistic, incluida búsqueda en caché; HTTP puede usar caché del navegador |
| landmarkAssetIntegrityMs | Verificación del tamaño y SHA-256 de Holistic cuando está fijado |
| landmarkMs | Tiempo hasta recibir landmarks; en Worker incluye preparar/transferir la imagen, cómputo y entrega de respuesta |
| landmarkWorkerMs | Cómputo de `detectForVideo` dentro del Worker; no incluye la transferencia |
| framePreparationMs | Preparación de ImageBitmap antes de transferirlo |
| uiDelayMs / uiLongTaskMs | Retraso del hilo de interfaz y duración de tareas largas; se miden por separado del reconocimiento |
| featuresMs | Extracción de las 138 características |
| frameIntervalMs / processedFps | Intervalo y FPS reales de fotogramas procesados; excluye pausas ≥1 s |
| observationMs | Tiempo de la ventana de 30 observaciones |
| queueMs | Espera de una secuencia completa antes de clasificar |
| inferenceMs | Ejecución del clasificador, incluida su preparación de entrada |
| segmentToPredictionMs | Desde el primer fotograma retenido del segmento hasta resolver la predicción |

`segmentToPredictionMs` **no mide** el comienzo lingüístico anotado de una seña,
el render visible de la propuesta ni su confirmación humana. Incluye predicciones
que después pueden rechazarse por incertidumbre. `accepted` cuenta propuestas
que pasan el umbral y la supresión de duplicados, no confirmaciones humanas.
Los contadores también distinguen incertidumbre, duplicados, manos ausentes,
saturación, atraso, interrupciones de fotogramas y fallos de inferencia.
`landmarkBusy` cuenta oportunidades omitidas mientras una detección asíncrona
sigue en curso, sin guardar imágenes pendientes. `landmarkStale` cuenta resultados
descartados por atraso o pestaña oculta. Estos descartes deben incluirse en la
comparación: no basta con informar solo los fotogramas rápidos.

## Protocolo de comparación

1. Mantener un conjunto autorizado de clips, incluidos reposo, movimientos que no
   son señas y repeticiones legítimas. Anotar comienzo/fin y etiqueta esperada.
2. Separar participantes entre entrenamiento y evaluación. No ajustar umbrales
   con el conjunto de evaluación.
3. Registrar versión de app/modelo, equipo, navegador y condiciones de iluminación.
4. Medir carga fría y caliente por separado. Calentar la inferencia y ejecutar
   varias repeticiones del mismo conjunto en baseline y candidato.
5. Comparar latencia por equipo, F1 macro, falsos positivos por minuto,
   abstención, correcciones y tiempo hasta confirmar. No excluir los rechazos
   para aparentar menor latencia.
6. Promoción propuesta: p50 y p95 de latencia ≤50% del baseline; caída de F1 macro
   ≤1 punto porcentual; falsos positivos sin aumento. Estos criterios deben
   acordarse antes de la evaluación representativa, con tamaño e incertidumbre
   de la muestra explícitos.

## Verificación reutilizando esta sesión

Se usa el mismo workspace, dependencias, servidor Next y `/usr/bin/chromium`.
No se crean contenedores, worktrees, instalaciones de navegadores ni copias de modelos.
Con el servidor ya abierto en el puerto 3100:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
pnpm e2e:web --workers=1
```

Las pruebas de navegador importan los módulos originales mediante interceptación
local de Playwright: no agregan rutas públicas de laboratorio ni omiten Auth.
Una prueba usa un clasificador sintético deliberadamente lento para comprobar
concurrencia/cancelación. Otra carga el ONNX real y el WASM local, verifica su hash
y ejecuta seis tensores de ceros (primera inferencia y cinco calientes). El informe
adjunto a Playwright mide ese smoke test; no evalúa exactitud lingüística ni incluye
el coste de MediaPipe/cámara. Los tests de login móvil y protección de rutas se
mantienen. Falta un benchmark completo con señas LSB autorizadas en equipos reales.
