# ADR-001: Pipeline de señas ejecutado en el navegador

- **Estado:** aceptada para el prototipo
- **Fecha:** 2026-10-22
- **Ámbito:** captura, landmarks, inferencia y privacidad de LSB
- **Relacionado:** `README.md`, `.agents/skills/sign-model-adapter/SKILL.md`, `.agents/skills/lsb-traduccion-lengua-senas/SKILL.md`

## Contexto

La PWA necesita apoyar la comunicación en LSB durante una atención presencial sin enviar video, audio ni landmarks a un servidor. La cámara y la extracción de landmarks ya funcionan en el navegador; se integra un clasificador experimental para producir etiquetas de un vocabulario acotado.

Existen tres restricciones que condicionan la solución:

1. La inferencia debe funcionar en dispositivos de escritorio y móviles, con fallback cuando no exista aceleración.
2. El resultado es un candidato revisable, no una traducción automática validada.
3. Los modelos y datos LSB requieren procedencia, licencia, versión y evaluación antes de presentarse como aprobados.

## Decisión

Se adopta un pipeline de dos etapas ejecutado íntegramente en el navegador:

```text
Video local
   ↓
MediaPipe Holistic Landmarker
   ↓
Features normalizadas (138 por fotograma)
   ↓
Ventana temporal de 30 fotogramas
   ↓
Clasificador ONNX Runtime Web
   ↓
Etiqueta candidata + puntuación
   ↓
Borrador acumulado y editable
   ↓ revisión humana
Mensaje confirmado por frase
```

### Estado de implementación

- **Implementado:** carga automática de `HolisticLandmarker` y del ONNX LSB v4 al abrir el panel, overlay de pose/manos, extracción de 138 features, segmentación continua por movimiento, buffer de 30 fotogramas, ejecución local con WASM, SHA-256 del artefacto, etiquetas, umbral inicial de abstención, borrador acumulado y confirmación humana por frase.
- **Pendiente:** verificar paridad de features con secuencias autorizadas, medir tiempo/memoria/fps en equipos objetivo, calibrar la abstención y la segmentación con datos representativos, y mover inferencia a worker si el perfil lo requiere.

### Landmarks

- Usar `@mediapipe/tasks-vision` con `HolisticLandmarker` en modo `VIDEO`.
- Ejecutar con `delegate: "GPU"` cuando esté disponible y reintentar con `delegate: "CPU"` si falla.
- Considerar la aceleración de MediaPipe como WASM/GPU del navegador; no se asume que MediaPipe use WebGPU.
- Extraer pose, mano izquierda y mano derecha. La cara queda disponible para una fase posterior de marcadores no manuales, pero no se usa en el primer clasificador.
- Procesar los landmarks a intervalos de 33 ms (~30 fps) mientras la vista previa está activa, para aproximar la cadencia del corpus de referencia. Medir el coste en móviles y reducirlo fuera de la captura si es necesario. La ejecución en un worker queda como optimización posterior.

### Features

La primera implementación reproduce el contrato de 138 características del modelo boliviano de referencia:

- 42 valores de mano derecha normalizados respecto al mínimo de esa mano.
- 21 distancias de la mano derecha a la nariz.
- 12 ángulos de pose respecto a la nariz, normalizados por `2π`.
- 42 valores de mano izquierda normalizados respecto al mínimo de esa mano.
- 21 distancias de la mano izquierda a la nariz.
- Valores en cero cuando falta una mano o la pose.

La extracción debe ser una función pura, probada con fixtures y separada del adaptador de MediaPipe.

### Clasificador

- Usar ONNX Runtime Web para el modelo de secuencia.
- Usar WASM para el modelo pequeño de referencia y medir el pipeline completo antes de añadir WebGPU; ONNX Runtime recomienda comparar por carga y dispositivo.
- No importar ONNX, MediaPipe ni tensores desde componentes React.
- El segmentador detecta movimiento, recoge 30 fotogramas (~1 s a 30 fps), clasifica un segmento por vez y aplica un cooldown antes de buscar la siguiente seña. Las etiquetas aceptadas se acumulan en un borrador editable; una frase se guarda solo tras confirmación humana.
- El adaptador devuelve etiqueta y puntuación softmax; el UI la llama “puntuación”, no confianza calibrada. El umbral de 0.50 es heredado de la demo upstream, no validado para uso general.
- El modelo `model_transformer_enco_v4.onnx` de Villca Villegas está versionado con SHA-256 y atribución MIT en `apps/web/public/models/lsb-reference-v4/`. El repo no documenta por separado la procedencia/licencia del corpus y no publica latencia web.
- ONNX Runtime Web se importa dinámicamente al abrir el panel de atención. El `.wasm` de 13.6 MiB y el `.mjs` se copian al `public/` ignorado desde la versión fijada del paquete antes de dev/build; el modelo pesa 6.9 MiB. Así no depende de jsDelivr y ambos pueden quedar en caché del mismo origen.

### Privacidad y persistencia

- El video y los landmarks no se envían a Supabase ni a un endpoint propio.
- No se guardan grabaciones por defecto.
- Supabase se reserva para catálogo de modelos, manifiestos aprobados, contenido LSB y, más adelante, sesiones con política de retención y RLS definidas.
- La UI indica procesamiento local, alcance experimental y revisión humana antes de guardar.

## Alternativas consideradas

### Inferencia en servidor

Descartada para el flujo normal por latencia, dependencia de red, costo y exposición de datos sensibles. Podría evaluarse solo como herramienta de investigación fuera del runtime de atención.

### OpenCV.js como motor principal

Descartada. OpenCV.js es WASM/JavaScript y no sustituye a un modelo de landmarks o de secuencia. Puede usarse para preprocessing o visión clásica si un benchmark demuestra una ventaja concreta.

### MediaPipe con WebGPU

No se adopta como supuesto. La API web de MediaPipe no garantiza un backend WebGPU; se usa su delegate GPU disponible y se mantiene el fallback.

### TensorFlow.js o Transformers.js

No se descartan para experimentos, pero ONNX Runtime Web ofrece una ruta directa para el modelo candidato y un control explícito de WebGPU/WASM.

### Modelo propio desde el inicio

No bloquea el prototipo. Primero se valida el contrato de landmarks y el adaptador con un modelo candidato; el modelo propio se entrenará y evaluará en `model-lab` con un corpus autorizado.

## Consecuencias

### Positivas

- Privacidad por diseño y funcionamiento sin subir video.
- Contrato de modelo intercambiable y testeable.
- Posibilidad de usar WebGPU cuando esté disponible sin excluir navegadores sin soporte.
- Base compatible con el modelo LSB de referencia y con futuros modelos propios.

### Costos y riesgos

- Primer uso del clasificador descarga aproximadamente 6.9 MiB de modelo y 13.6 MiB de runtime WASM; el modelo se carga automáticamente al abrir el panel y los recursos locales pueden quedar en caché.
- Cada seña requiere un segmento de ~1 segundo a 30 FPS antes de la inferencia; el solapamiento, las pausas y el rendimiento de MediaPipe condicionan la fluidez. No es traducción de frases continuas.
- El modelo de referencia cubre 58 clases y condiciones de captura limitadas; no representa LSB general ni traducción libre.
- La paridad entre MediaPipe Python y MediaPipe Web debe verificarse con fixtures antes de confiar en las predicciones.
- El procesamiento en el hilo principal puede afectar la UI; se debe medir y migrar a worker si es necesario.
- El WASM se copia desde la versión fijada del paquete y se sirve desde el mismo origen. El modelo Holistic `.task` aún usa Google Storage por defecto; antes del piloto se debe alojar en una ubicación propia aprobada y versionada.

## Fases

1. **Landmarks locales:** cargar Holistic, dibujar overlay, extraer las 138 features y exponer estado/errores.
2. **Clasificador aislado (baseline implementado):** carga explícita del ONNX local, ventana de 30 fotogramas y etiquetas candidatas.
3. **Evaluación:** benchmark por clase y participante, latencia, memoria y paridad con Python.
4. **Continuo (baseline implementado):** segmentación por movimiento, ventanas de 30 fotogramas a ~30 fps, borrador acumulado y confirmación por frase; faltan calibración, benchmark y marcadores no manuales.
5. **Modelo LSB propio:** corpus autorizado y entrenamiento/comparación TCN vs. GRU; catálogo versionado después de validar licencia y métricas.

## Criterios de aceptación

- La cámara puede activarse sin cargar el modelo de landmarks y la app sigue siendo usable si la carga falla.
- El adaptador libera recursos al detener la cámara o cambiar de atención.
- La extracción de features es determinista y tiene pruebas unitarias.
- La UI distingue carga, listo, error y detección sin bloquear la captura existente.
- No se envía video ni landmarks a la red.
- Un resultado del clasificador se presenta como candidato revisable, nunca como traducción confirmada.
- El modo continuo no guarda mensajes automáticamente; la acumulación vive en un borrador y cada frase requiere confirmación humana.

## Fuentes

- MediaPipe Holistic Landmarker, guía web: https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker/web_js
- MediaPipe Holistic Landmarker, overview: https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- ONNX Runtime Web WebGPU: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- Modelo de referencia LSB: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB
- OpenCV.js: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
