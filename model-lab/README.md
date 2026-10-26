# Model Lab: corpus y evaluación local

Preparación y evaluación separadas de la PWA. La auditoría y el evaluador JSON
usan Node sin paquetes. El runner opcional de navegador reproduce clips locales
autorizados con MediaPipe y ONNX del proyecto; no sube video, landmarks ni
conversaciones. Ninguna herramienta certifica permisos o validez lingüística.

## Probar los ejemplos

Desde la raíz:

```sh
pnpm test:model-lab
pnpm validate:corpus model-lab/examples/synthetic-corpus.json
pnpm evaluate:recognition model-lab/examples/synthetic-corpus.json model-lab/examples/synthetic-run.json
```

Son **registros sintéticos**: no contienen clips, resultados de un modelo,
identidades o permisos reales. `label-a`/`label-b` no son glosas. Los estados
`verified`/`validated` ejercitan el formato, no representan revisión real.
La salida conserva `evidence: synthetic` y `promotion: not-evaluated`; sus cifras
no pueden citarse como precisión o velocidad de SignaLink.

## Preparar el corpus real

El esquema v1 es una propuesta para **clasificación aislada**. La plantilla
`configs/corpus.template.json` está vacía y el auditor la declara no lista.

1. Acordar vocabulario, protocolo y autorización antes de grabar o reutilizar.
2. Usar IDs seudonimizados; conservar permisos, fuentes e identidades en el
   sistema privado autorizado. Esos IDs no garantizan anonimato del video.
3. Mantener datos reales en almacenamiento privado. `datasets/private/` y
   `reports/private/` se ignoran en Git; eso no sustituye controles de acceso.
4. Documentar fuente, variante y revisión lingüística por etiqueta. Las referencias
   del JSON son códigos opacos, no nombres, contactos ni enlaces de acceso.
5. Separar por participante: todas sus sesiones pertenecen a una sola partición.
6. Auditar y corregir hallazgos conservando un registro privado de exclusiones y
   versiones. El comando no elimina ni modifica muestras silenciosamente.

```sh
pnpm validate:corpus model-lab/datasets/private/corpus-v1.json
```

El auditor devuelve cobertura por clase/partición, cantidad de participantes,
distribuciones de muestras por sesión/variante/región/condición/equipo, duplicados
y cruces de participantes. Los hallazgos usan índices de filas **desde cero**
para localizar problemas sin imprimir IDs personales.

El hash de cada muestra corresponde al **archivo recortado exacto del clip**, no
al archivo original de sesión con muchos segmentos. El auditor compara hashes
declarados; no abre videos ni detecta todas las duplicaciones visuales, archivos
corruptos o errores lingüísticos.

## Manifiesto del corpus v1

No admite campos desconocidos. El parser está en `src/evaluation/contracts.mjs`;
`examples/synthetic-corpus.json` muestra un documento completo.

| Campo | Significado |
| --- | --- |
| `schemaVersion`, `datasetId` | Versión 1 e ID de la versión congelada del corpus |
| `language`, `task`, `evidence` | `LSB`, `isolated-sign`, `synthetic`/`recorded` |
| `labels` | Catálogo con `id`, `sourceRef`, `validation` (`pending`/`validated`) |
| `clips[].id`, `participantId`, `sessionId` | IDs opacos estables, sin nombres/contactos |
| `split`, `assetSha256`, `durationMs` | `train`/`validation`/`test`, SHA-256 del clip, duración hasta 60 s |
| `kind` | `sign`, `rest`, `non-sign` |
| `labelId`, `onsetMs`, `endMs` | Para seña: clase e intervalo no vacío dentro del clip; para negativos: los tres `null` |
| `sourceRef`, `authorizationRef` | Referencias a procedencia y autorización; no sus contenidos |
| `authorizationStatus`, `annotationStatus` | `pending`/`verified`/`withdrawn`; `pending`/`reviewed` |
| `regionId`, `variantId`, `conditionId`, `deviceId` | Códigos del protocolo privado, no identificadores físicos del equipo |

Límites: 256 etiquetas, 10.000 clips, JSON de hasta 8 MiB. Los arrays vacíos sirven
para auditar borradores. No se deducen glosas de español u otras lenguas de señas.

## Registro de ejecución v1

El auditor devuelve `corpusSha256`, hash del JSON canónico (claves de objetos
ordenadas, arrays en su orden original). Cambiar anotaciones o particiones cambia
la huella; no es el hash del video ni prueba de procedencia.

El runner de navegador produce el registro mostrado en `examples/synthetic-run.json`,
con una fila por **cada** clip de test:

| Campo | Significado |
| --- | --- |
| `datasetId`, `corpusSha256`, `split`, `evidence` | Coinciden exactamente con el corpus; `split: test` |
| `runId`, `deviceProfileId`, `browserProfileId`, `condition` | Referencias privadas de ejecución/equipo/navegador; `cold` o `warm` |
| `clock` | `realtime-clip-start-ms`: origen temporal al inicio real del clip a velocidad normal |
| `model` | ID, versión, hash, `labelIds` evaluables y `trainingParticipantAudit` (`unknown`/`verified-disjoint`); el reservado `out-of-scope` conserva salidas sin mapeo |
| `pipeline` | Versión, commit Git completo, esquema/preprocesador, dimensiones, intervalo/umbrales, hash de landmarks, modo `main-thread`/`worker`, delegado `CPU`/`GPU`/`unknown` y runtime |
| `results[].clipId`, `status` | Una fila única por clip; `completed` o `error`, sin stacks/mensajes privados |
| `observedUntilMs` | Tiempo observado, incluido hasta 5 s para drenar inferencia/render después del video |
| `proposals` | Todas las propuestas visibles, en orden temporal estricto, con `labelId` y `visibleAtMs` |

Una abstención es un caso completado con `proposals: []`. Un fallo temprano usa
`error` y el tiempo observado, sin omitir la fila. Los logits no son propuestas
visibles. No quitar errores, repeticiones o propuestas previas a la seña.

Cada clip tiene una sola seña objetivo o es negativo completo. Debe incluir un
margen posterior suficiente para observar respuestas. El runner reproduce a
velocidad 1× y registra la propuesta tras actualizar y pintar dos veces un campo
editable. Reutiliza la política de aceptación y composición de texto de la cámara;
el campo temporal no monta el componente React de una sesión, así que sus tiempos
no representan el render completo de la app. No usar tiempos offline de tensores
como tiempos de propuestas visibles. El evaluador valida números, no su reloj real.

```sh
pnpm evaluate:recognition model-lab/datasets/private/corpus-v1.json model-lab/reports/private/run-v1.json
```

## Runner de navegador

El runner compara el detector de MediaPipe en el hilo de la interfaz con el
Worker optativo usando el mismo ONNX LSB v4, el mismo modelo Holistic fijado y
los mismos clips. Alterna cuál modo corre primero por clip, mantiene un video y
un clasificador, y calienta ambos motores antes de medir. Los informes usan
`condition: warm`; todavía no miden arranque en frío.

1. Coloca el manifiesto en `model-lab/datasets/private/corpus-v1.json` y los clips
   exactos de test en `model-lab/datasets/private/clips/`.
2. Prepara el `.task` Holistic revisado con `pnpm --filter @la-voz/web prepare:holistic`
   y copia la versión, el SHA-256 y los bytes que imprime.
3. Copia `configs/browser-run.template.json` a
   `model-lab/datasets/private/browser-run.json`. Mapea cada ID de clip a su
   archivo local y cada clase del corpus a la etiqueta exacta del modelo. Las
   etiquetas del modelo sin mapeo quedan como `out-of-scope` y cuentan como
   errores o falsas alarmas.
4. Ejecuta desde la raíz:

   ```sh
   pnpm run:recognition-browser -- model-lab/datasets/private/browser-run.json
   ```

Si ambas ejecuciones terminan correctamente, el mismo comando calcula la
comparación emparejada y la guarda junto a los registros como
`comparison-<baselineRunId>-<workerRunId>.json`. Los archivos se crean con
permisos privados y nunca se sobrescriben. Antes de abrir el navegador verifica
que esos IDs de salida estén libres. Si la comparación falla, conserva los
registros de cada modo para revisión; corrige el manifiesto usando nuevos IDs
antes de repetir la captura.

El comando exige una carpeta Git limpia, corpus listo, SHA-256 coincidente de
cada clip y un Holistic local verificado. Usa el Chromium y la configuración
Playwright existentes; reutiliza el servidor Next en `127.0.0.1:3100`. Lee los
clips bajo demanda, sin copiarlos. No captura trazas, videos ni screenshots. Los
registros se escriben sin sobrescribir en `model-lab/reports/private/<runId>.json`,
ignorado por Git.

Las señas de test deben tener al menos 1 s antes del inicio anotado y 1,5 s
después del fin. Cada clip debe ser MP4 o WebM y pesar como máximo 64 MiB. Un
modelo o clip que no carga queda como fila `error`; el runner no elimina el caso.
La consola no muestra rutas locales ni contenido de clips.

El runner calcula las métricas de ambos registros. Los tiempos terminan
después de pintar el campo editable del arnés, no del render React de
`ConversationPanel`. Sirven para comparar motores bajo el mismo arnés; no bastan
para afirmar una reducción del 50% en la app. Faltan el benchmark real en equipo
objetivo, muestras suficientes y revisión lingüística.

Para comparar registros ya existentes o volver a calcular un informe:

```sh
pnpm compare:recognition-runs \
  model-lab/datasets/private/corpus-v1.json \
  model-lab/reports/private/baseline-run.json \
  model-lab/reports/private/worker-run.json
```

El comparador rechaza cambios en el corpus, modelo, preprocesamiento, versión de
código, dispositivo, navegador, delegado o condición. Resume p50/p95 por brazo,
ratios por muestra reconocida en ambos modos, macro F1 y falsas alarmas. Solo
muestra estados de umbral para corpus `recorded`; en datos sintéticos los deja
como `not-evaluated`. Aun con umbrales aprobados, `promotion` siempre queda
`not-evaluated`: faltan tamaño de muestra, incertidumbre y validación lingüística.

## Interpretar métricas

- Exactitud de señas/todos los clips, F1 macro, soporte y precisión/recall/F1 por
  clase, matriz de confusión. Los números están en escala 0–1.
- La **primera** propuesta visible determina la clasificación. Un acierto posterior
  no rescata una primera salida errónea/prematura. Abstenciones y errores tienen
  columnas explícitas en la matriz y permanecen en los denominadores.
- `macroF1` es `null` si falta cualquier clase en test; se muestra aparte el promedio
  descriptivo de clases con soporte y la lista de clases ausentes.
- Un clip negativo aporta una clasificación a la matriz; su tasa de falsas alarmas
  cuenta **todos** los eventos. El denominador son los minutos realmente observados
  de reposo/no-seña. Un negativo fallido deja `coverageComplete: false`; sin
  exposición, la tasa es `null`.
- La latencia p50/p95 usa solo primeras propuestas correctas posteriores al inicio
  anotado. Publica también cobertura y cantidad de señas rechazadas/fallidas. La
  mejora de ese subconjunto no demuestra una reducción global del 50%.
- Los resúmenes por participante son distribuciones sin IDs, no intervalos de
  confianza ni prueba de anonimización. Conservar los registros privados para
  análisis supervisado cuando corresponda.

El evaluador bloquea autorizaciones pendientes/retiradas, revisión pendiente,
etiquetas dudosas, participantes mezclados o clips duplicados. Las carencias de
cobertura quedan visibles; no se excluyen para mejorar promedios.

Salida 0: cálculo/auditoría sin hallazgos de metadatos. Salida 2: corpus no listo;
la auditoría explica hallazgos y la evaluación puede bloquearse. Salida 1: formato,
huella o registros inválidos/incompletos. Ningún código aprueba un modelo.

## Pendiente

Los participantes de entrenamiento del LSB v4 no están totalmente documentados.
Una partición local sin cruces no prueba generalización a personas nuevas para
esos pesos. `unseenSignerClaimVerifiedByTool` permanece falso; una declaración
externa de revisión tampoco es una comprobación de este programa.

Faltan corpus y permisos reales, validación lingüística, ejecución en equipo
objetivo y comparación emparejada con suficientes muestras. No se calculan WER/CER,
traducción, calibración, intervalos de confianza ni promoción automática.
El protocolo propuesto está en `configs/public-service-benchmark.yaml`;
sus criterios deben fijarse antes de observar resultados reales.
