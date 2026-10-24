# Reconocimiento de LSB en el navegador: investigación inicial

## Estado actual del prototipo

El clasificador base se carga automáticamente al abrir la atención. Se descargan el modelo ONNX de 6.87 MiB y el runtime WASM local (13.6 MiB), se verifica el SHA-256 del modelo y se habilitan los controles cuando cámara, landmarks y modelo están listos. El modo continuo segmenta por movimiento, recoge 30 frames con un intervalo solicitado de 33 ms y propone una etiqueta editable por segmento. La captura continúa durante la inferencia, con una sola secuencia pendiente y controles de saturación/cancelación. Los FPS reales dependen del dispositivo. El umbral actual de 0.50 se hereda del upstream y no está calibrado. El resultado siempre exige revisión y confirmación humana. Consulta el [protocolo de rendimiento y diagnóstico local](./recognition-performance.md) para medir esta primera optimización; todavía no demuestra una reducción de latencia del 50%.

El catálogo ahora usa manifiestos versionados y bindings revisados de adaptador/preprocesador. La cámara obtiene la ventana, el muestreo y la política de incertidumbre del modelo seleccionado; la atención maneja progreso porcentual. Solo LSB v4 está habilitado en el catálogo de esta entrega. Véanse [ADR-002](../architecture/adr/ADR-002-multi-model-runtime.md) y el [roadmap](../roadmap/recognition-mvp.md).

El WASM de ONNX Runtime Web se copia desde la versión exacta fijada en `pnpm-lock.yaml` a `apps/web/public/onnxruntime/wasm/` antes de iniciar Next o construir. Esa carpeta es generada e ignorada por Git. El modelo, la tarjeta informativa y la licencia del upstream viven en `apps/web/public/models/lsb-reference-v4/`.

Esto confirma la ruta técnica de carga/inferencia, no la calidad de reconocimiento. A 30 FPS, cada segmento de 30 frames tarda como mínimo unos 1,0 s; el solapamiento entre señas, las pausas y el rendimiento de MediaPipe condicionan la fluidez. Aún falta evaluar la paridad de landmarks Python/Web, el comportamiento por clase, la calibración de la segmentación y el rendimiento móvil. Para comparar otras opciones y priorizar un reconocedor LSB fluido, consulta [`sign-model-options.md`](./sign-model-options.md).

- **Fecha:** 2026-10-23 (actualizado)
- **Alcance:** landmarks, inferencia local y viabilidad de WebGPU
- **Decisión relacionada:** `docs/architecture/adr/ADR-001-browser-only-sign-pipeline.md`

## Pregunta

¿Cómo construir un pipeline de reconocimiento de LSB que funcione en la PWA sin enviar video ni landmarks a un servidor, usando tecnologías disponibles en navegadores actuales?

## Hallazgos

### MediaPipe Tasks Vision

`@mediapipe/tasks-vision` incluye `HolisticLandmarker` para web. Combina detección de cara, manos y pose y devuelve:

- 478 landmarks faciales normalizados.
- 33 landmarks de pose en coordenadas normalizadas y 3D world coordinates.
- 21 landmarks por mano en coordenadas normalizadas y 3D world coordinates.

La API web ofrece `detect()` para imágenes y `detectForVideo()` para video. El modo `VIDEO` permite procesar fotogramas con timestamps y mantener seguimiento. El paquete incluye el runtime WASM y permite elegir `delegate: "GPU"` o `delegate: "CPU"`.

El bundle oficial `holistic_landmarker.task` pesa 13,683,609 bytes (aproximadamente 13.7 MB). Es un artefacto externo que debe cachearse o alojarse en almacenamiento aprobado para producción.

Conclusión: es una base adecuada para extraer las manos y la pose que necesita el modelo candidato. No se debe afirmar que MediaPipe usa WebGPU; su aceleración web es WASM con delegate GPU del navegador.

### WebGPU y ONNX Runtime Web

ONNX Runtime Web documenta un execution provider WebGPU para ejecutar modelos ONNX en el navegador. También ofrece WASM como fallback. La disponibilidad de WebGPU depende de navegador, sistema operativo y dispositivo, por lo que la aplicación debe detectar capacidad y degradar sin bloquear la escritura de texto ni el resto del flujo de atención.

WebGPU es relevante para el clasificador de secuencia, no para sustituir la extracción de landmarks de MediaPipe. Un modelo de 30×138 y 58 clases es pequeño; la latencia real debe medirse antes de optimizar.

### OpenCV.js

OpenCV.js es una compilación WASM/JavaScript de OpenCV. Puede ayudar con preprocessing, dibujo o visión clásica, pero no es un motor de landmarks ni de clasificación de señas. Añadirlo como dependencia principal aumentaría el tamaño sin resolver la tarea. Se mantiene como opción secundaria para experimentos.

### Modelo boliviano candidato

El repositorio de Villca Villegas declara licencia MIT y publica un modelo Transformer Encoder en ONNX. El artefacto candidato `model_transformer_enco_v4.onnx` pesa 7,206,466 bytes y tiene SHA-256 `976CC4071DE03C4DEEA46F1219E3CF98AD779C17DF12148152F64B704F957EE2`. El pipeline original, revisado en `deteccion_manos_pose.py`:

- Captura 30 fotogramas.
- Usa MediaPipe Holistic en Python.
- Calcula 138 características por fotograma.
- Alimenta un tensor `[1, 30, 138]` de tipo `float32`.
- Produce 58 clases: alfabeto dactilológico, números y palabras frecuentes.

La extracción original usa:

- Mano derecha: 21 pares `(x, y)` relativos al mínimo de la mano, 42 valores.
- Distancias de cada landmark de la mano derecha a la nariz, 21 valores.
- 12 ángulos de pose respecto a la nariz, normalizados por `2π`.
- Mano izquierda: 42 valores relativos y 21 distancias a la nariz.
- Ceros cuando falta una mano o la pose.

La implementación `extractLsbFeatures()` reproduce ese orden exacto: mano derecha, distancias derecha-nariz, ángulos de pose, mano izquierda y distancias izquierda-nariz. La captura web envía al detector los píxeles sin espejar; el espejado se aplica solo a la vista previa y al overlay.

Riesgos:

- El modelo fue entrenado con condiciones de distancia e iluminación específicas.
- No cubre LSB general ni gramática de secuencias.
- La paridad exacta entre MediaPipe Python y MediaPipe Web no está demostrada.
- La licencia MIT del repositorio debe verificarse también para los pesos y datos asociados.
- La salida de 58 clases no es una traducción a español.

## Arquitectura propuesta

```text
Cámara
  ↓ getUserMedia
Video local
  ↓ MediaPipe HolisticLandmarker
Pose + manos
  ↓ extractor puro
Vector de 138 features
  ↓ segmentador por movimiento
Buffer de 30 fotogramas
ONNX Runtime Web (WebGPU → WASM)
  ↓ softmax + umbral
Etiqueta candidata
  ↓ acumulación en borrador editable
  ↓ revisión humana
Mensaje confirmado
```

La UI no debe importar MediaPipe ni ONNX. La captura y el reconocimiento se conectan mediante puertos y adaptadores. El resultado debe incluir modelo, versión y estado de incertidumbre.

## Privacidad

- El video nunca sale del dispositivo.
- Los landmarks se mantienen en memoria mientras la cámara está activa.
- No se guardan frames ni secuencias por defecto.
- Supabase no se usa para inferencia; se reserva para catálogo, manifiestos y contenido aprobado.
- Cualquier recolección para investigación requiere consentimiento explícito y una política de retención separada.

## Evaluación necesaria

Antes de afirmar que el reconocimiento funciona:

1. Verificar que el modelo ONNX carga en ONNX Runtime Web.
2. Comparar features de Python y TypeScript con fixtures sintéticos y grabaciones autorizadas.
3. Medir latencia, memoria y fps en escritorio y móvil, con WebGPU y WASM.
4. Evaluar por clase y por participante, no solo con precisión global.
5. Reportar matriz de confusión, F1 macro, clases sin cobertura y condiciones de fallo.
6. Probar abstención cuando la mano o la pose no sean visibles.
7. Validar el texto con personas competentes en LSB antes de presentarlo como interpretación.

## Preguntas abiertas

- ¿El modelo de referencia acepta landmarks de MediaPipe Tasks Web sin ajustes de escala?
- ¿La latencia de Holistic a 30 fps es aceptable en móviles de gama media?
- ¿Conviene usar Holistic o separar HandLandmarker y PoseLandmarker?
- ¿Los umbrales de movimiento, el cooldown y la deduplicación segmentan bien señas repetidas o encadenadas?
- ¿Qué marcadores no manuales son necesarios para la gramática LSB objetivo?
- ¿Qué corpus autorizado y qué licencia permitirán entrenar un modelo propio?

## Fuentes

- MediaPipe Holistic Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker
- Guía web de Holistic: https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker/web_js
- Paquete npm: https://www.npmjs.com/package/@mediapipe/tasks-vision
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- WebGPU execution provider: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- OpenCV.js: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
- Modelo LSB de referencia: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB
- Extracción original de features: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/main/deteccion_manos_pose.py
