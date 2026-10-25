# Comparación local del baseline y Worker

## Alcance

Esta entrega prepara la evaluación; no contiene un corpus LSB autorizado ni
demuestra la reducción global del 50%. Los informes agregados sirven para
investigar etapas lentas y fluidez. No contienen anotaciones de inicio de seña,
propuestas visibles emparejadas ni resultados lingüísticos de referencia.

## Comparar sin reiniciar Next

En **Atención → Ajustes de captura → Motor de landmarks** elegir:

- **Compatible · hilo de la interfaz**, para el baseline.
- **Worker · experimental**, para el candidato.

La elección vive en memoria del proveedor. No modifica `.env.local`, no necesita
otro servidor y no se guarda como preferencia permanente. La variable
`NEXT_PUBLIC_MEDIAPIPE_WORKER` determina solamente la selección inicial.

Cambiar cierra el detector anterior, invalida sus resultados y reinicia la
medición/segmentación. Conserva la sesión ONNX y el borrador. El selector está
bloqueado durante captura continua, procesamiento y revisión pendiente. Un
detector inyectado por un integrador controla su propio motor y deshabilita el
selector. Se sigue mostrando el modo real y el fallback en el diagnóstico;
seleccionar Worker no garantiza que el navegador pueda ejecutarlo.

Para una comparación descriptiva:

1. Mantener equipo, navegador, modelo, tamaño de ventana, umbrales y condiciones
   de carga equivalentes. Separar arranque frío de ejecución caliente. Cuando
   exista el corpus, usar exactamente las mismas muestras autorizadas.
2. Seleccionar Compatible, esperar la carga, reiniciar la medición si se quiere
   medir solo ejecución caliente, realizar la prueba y exportar el diagnóstico.
   Guardar manualmente el archivo como `baseline.json`.
3. Fuera de captura/revisión, seleccionar Worker y repetir las mismas condiciones.
   Guardar el informe como `worker.json`. Actualizar el diagnóstico permite ver
   las muestras sin timers de render de React.
4. Ejecutar desde el mismo workspace:

```sh
pnpm --filter @la-voz/web compare:recognition /ruta/baseline.json /ruta/worker.json
```

El comando solo lee archivos locales de hasta 128 KiB. No carga video, no envía
informes a un servicio ni escribe en Supabase. La salida es JSON con etapas y
diferencias porcentuales de p50/p95; una reducción negativa significa mayor
latencia. Si el baseline es cero, la reducción es `null`, no infinito.

Solo acepta exportaciones v4 y comprueba contrato del modelo, esquema,
dimensiones, intervalo solicitado, umbrales y pesos de Holistic verificados e
idénticos. Detecta fallback y un candidato que realmente siguió en el hilo
principal. Salida 0 indica coincidencia de contratos técnicos, 2 discrepancias o
integridad insuficiente, y 1 archivos inválidos. Ninguna salida aprueba un modelo.

Las etapas con menos de 30 muestras llevan `few-samples`. Es una advertencia
descriptiva, no un tamaño de muestra validado estadísticamente. Los agregados
retienen como máximo las últimas 120 observaciones de cada etapa: no son datos
emparejados, un promedio de todos los usuarios ni intervalos de confianza.
Equipo, corpus, anotaciones, F1 y falsos positivos no se comprueban con estos JSON;
`latencyGoal50Percent` y `promotion` siempre quedan como `not-evaluated`.

## Medir respuesta de la interfaz

Mientras la cámara y los landmarks están activos, un monitor local registra:

| Dato | Interpretación |
| --- | --- |
| `uiDelayMs` | Retraso de un temporizador de 100 ms sobre el momento esperado; incluye trabajo de toda la página, no solo MediaPipe |
| `uiLongTaskMs` / `uiLongTasks` | Duración y cantidad de tareas del hilo principal mayores a 50 ms, si el navegador soporta Long Tasks |
| `uiMeasurementGaps` | Intervalos de 1 s o más excluidos del temporizador; no se presentan como muestras rápidas |
| `responsiveness.longTasksSupported` | Distingue ausencia de soporte de un resultado sin tareas largas |

La pestaña oculta no produce muestras. Detener cámara/landmarks o cambiar de
motor desconecta el observador y temporizador. Reiniciar la medición descarta
observaciones pendientes de la época anterior. Solo se conservan duraciones y
contadores; no se recopilan nombres de tareas, URLs ni atribuciones.

Una tarea sintética de 180 ms en Chromium comprueba que el monitor detecta un
bloqueo real. El test del Worker usa cómputo sintético para comprobar transporte y
respuesta de la página. Esas pruebas no ejecutan reconocimiento lingüístico ni
demuestran mejor rendimiento de Holistic en un dispositivo de oficina.

El protocolo preparatorio para el siguiente corpus está en
[`public-service-benchmark.yaml`](../../model-lab/configs/public-service-benchmark.yaml).
