# ADR-002: runtime de reconocimiento con contratos de modelo versionados

Estado: implementación inicial. Complementa ADR-001 y el catálogo previsto en el README.

## Contexto

El panel de cámara creaba directamente `OnnxLsbReferenceClassifier`, conocía la
ventana de 30 fotogramas y rechazaba predicciones con un umbral fijo de 0.50.
Además, el progreso de atención estaba limitado a 30, lo que impedía sustituir
correctamente un modelo por otro con una secuencia diferente.

## Decisión

- `SignModelManifest` declara versión de manifiesto y de empaquetado, lengua,
  tarea, formato, motor, adaptador, artefacto, hash, bytes, nombres de entrada y
  salida, dimensiones, esquema de características, normalización, orden de
  landmarks, preprocesador, muestreo, etiquetas y política de incertidumbre.
- `ModelRegistry` valida manifiestos, congela una copia y verifica correspondencia
  con capacidades revisadas de adaptador/preprocesador. IDs desconocidos,
  duplicados o contratos incompatibles fallan sin fallback automático a LSB.
- El catálogo no ejecuta URLs arbitrarias: los ONNX proceden de rutas `/models/`
  revisadas en el repositorio. Agregar pesos requiere incorporar su manifiesto
  y binding, comprobar derechos, compatibilidad y pruebas.
- `executionApproved` habilita técnicamente un binding. `validationStatus`
  describe evidencia lingüística y es independiente. El v4 sigue experimental.
- `RecognitionRuntime` es el puerto de composición. El provider selecciona un
  modelo; la cámara consume su descriptor, extractor y fábrica de clasificador.
  La UI ya no importa la infraestructura ONNX ni construye tensores.
- El adaptador `OnnxSequenceClassifier` recibe el manifiesto; comprueba bytes,
  SHA-256, nombres, tipos y dimensiones del ONNX. Construye su entrada según el
  contrato y decodifica la salida declarada, sin depender de 30×138 o 58 clases.
- `SignClassification` incluye ID/versión, score softmax, margen top-1/top-2 y
  decisión `candidate`/`uncertain`. Son puntuaciones sin calibrar, no certeza de
  comprensión. La decisión no confirma ni guarda mensajes.
- El v4 conserva umbral 0.50 y margen mínimo 0. El nuevo campo de margen no
  supone calibración: cambiar sus valores exige evaluación separada.
- El segmentador recibe la longitud de secuencia. El dominio de atención y sus
  vistas manejan progreso de 0–100%, independiente del tensor.
- El selector permite cambiar solamente fuera de captura/revisión pendiente.
  Se invalidan resultados, se cierra el clasificador anterior, se espera su
  inferencia en curso antes de liberar la sesión y se limpia la medición.
- Los informes locales incluyen modelo, versión, hash y esquema; no almacenan
  imágenes, características, etiquetas ni texto de conversación.

`4.0.0` identifica el empaquetado local del baseline v4; el SHA-256 identifica los
pesos exactos. No afirma que el proyecto upstream publique versiones semánticas.

## Alcance inicial y límites

Solo está registrado LSB v4. Las pruebas usan un modelo sintético de ventana corta
y un adaptador simulado para comprobar intercambiabilidad; no se publica como
segundo modelo ni prueba precisión lingüística. La prueba de navegador carga los
pesos LSB reales con el adaptador genérico.

El binding actual soporta ONNX/WASM con logits, un tensor float32 `[1,T,F]` y el
preprocesador revisado del v4. Otra normalización, esquema, motor o decodificador
requiere un binding revisado y pruebas; cambiar un manifiesto no convierte pesos
LSA en compatibles con LSB. La validación de dimensiones dinámicas se completa
al ejecutar la primera inferencia y comprobar la forma real de salida.

Esta decisión no reduce por sí sola la latencia un 50%. Prepara comparaciones de
modelos sin acoplar la atención a su arquitectura. El Worker de MediaPipe, la caché
verificable de Holistic y la evaluación representativa siguen el [roadmap](../../roadmap/recognition-mvp.md).
