# Model Lab: corpus y evaluación local

Preparación y evaluación separadas de la PWA. Usan el Node ya instalado, sin
paquetes, entornos, servidores o pesos adicionales. No leen videos ni ejecutan
MediaPipe/ONNX. Las herramientas no certifican permisos o validez lingüística.

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

Un futuro runner o anotación supervisada debe producir el registro mostrado en
`examples/synthetic-run.json`, con una fila por **cada** clip de test:

| Campo | Significado |
| --- | --- |
| `datasetId`, `corpusSha256`, `split`, `evidence` | Coinciden exactamente con el corpus; `split: test` |
| `runId`, `deviceProfileId`, `browserProfileId`, `condition` | Referencias privadas de ejecución/equipo/navegador; `cold` o `warm` |
| `clock` | `realtime-clip-start-ms`: origen temporal al inicio real del clip a velocidad normal |
| `model` | ID, versión, hash, `labelIds` admitidos y `trainingParticipantAudit` (`unknown`/`verified-disjoint`) |
| `pipeline` | Versión, commit Git completo, esquema/preprocesador, dimensiones, intervalo/umbrales, hash de landmarks, modo real `main-thread`/`worker`, delegado `CPU`/`GPU` y runtime del clasificador |
| `results[].clipId`, `status` | Una fila única por clip; `completed` o `error`, sin stacks/mensajes privados |
| `observedUntilMs` | Tiempo realmente observado; un caso completado exige la duración completa |
| `proposals` | Todas las propuestas visibles, en orden temporal estricto, con `labelId` y `visibleAtMs` |

Una abstención es un caso completado con `proposals: []`. Un fallo temprano usa
`error` y el tiempo observado, sin omitir la fila. Los logits no son propuestas
visibles. No quitar errores, repeticiones o propuestas previas a la seña.

Cada clip tiene una sola seña objetivo o es negativo completo. Debe incluir un
margen posterior suficiente para observar respuestas: su fin es el límite de
evaluación. No usar tiempos offline de tensores como tiempos de propuestas
visibles. La herramienta valida los números declarados, no su reloj real.

```sh
pnpm evaluate:recognition model-lab/datasets/private/corpus-v1.json model-lab/reports/private/run-v1.json
```

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

Faltan corpus y permisos reales, validación lingüística, runner navegador y
comparación emparejada en el mismo equipo y condiciones. No se calculan WER/CER,
traducción, calibración, intervalos de confianza ni promoción automática.
El protocolo propuesto está en `configs/public-service-benchmark.yaml`;
sus criterios deben fijarse antes de observar resultados reales.
