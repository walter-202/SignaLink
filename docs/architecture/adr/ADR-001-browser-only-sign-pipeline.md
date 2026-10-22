# ADR-001: Pipeline de señas ejecutado en el navegador

- **Estado:** aceptada para el prototipo
- **Fecha:** 2026-10-22
- **Ámbito:** captura, landmarks, inferencia y privacidad de LSB
- **Relacionado:** `README.md`, `.agents/skills/sign-model-adapter/SKILL.md`, `.agents/skills/lsb-traduccion-lengua-senas/SKILL.md`

## Contexto

La PWA necesita reconocer señas de LSB durante una atención presencial sin enviar video, audio ni landmarks a un servidor. El prototipo actual ya captura video localmente, pero la interpretación sigue siendo simulada. La primera etapa debe producir landmarks corporales y una representación temporal compatible con un clasificador intercambiable.

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
Etiqueta candidata + puntuación + estado de revisión
```

### Estado de implementación

- **Implementado:** carga diferida de `HolisticLandmarker`, overlay de pose/manos, extracción pura de las 138 features, provider de sesión, hook con throttling y estados de carga/error, y control opcional en la UI.
- **Pendiente:** buffer de 30 fotogramas, adaptador ONNX Runtime Web, catálogo de etiquetas, umbral de abstención y evaluación de paridad con Python.

### Landmarks

- Usar `@mediapipe/tasks-vision` con `HolisticLandmarker` en modo `VIDEO`.
- Ejecutar con `delegate: "GPU"` cuando esté disponible y reintentar con `delegate: "CPU"` si falla.
- Considerar la aceleración de MediaPipe como WASM/GPU del navegador; no se asume que MediaPipe use WebGPU.
- Extraer pose, mano izquierda y mano derecha. La cara queda disponible para una fase posterior de marcadores no manuales, pero no se usa en el primer clasificador.
- Procesar como máximo a 15 fotogramas por segundo en el hilo principal para el prototipo. La ejecución en un worker queda como optimización posterior.

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
- Preferir el execution provider WebGPU y usar WASM como fallback.
- No importar ONNX, MediaPipe ni tensores desde componentes React.
- La ventana inicial es de 30 fotogramas. La primera integración puede clasificar una ventana completa; el reconocimiento continuo con segmentación o CTC se pospone.
- El adaptador devuelve etiqueta, puntuación y estado de incertidumbre. No convierte la puntuación en un porcentaje de confianza sin calibrar.
- El modelo candidato inicial es `model_transformer_enco_v4.onnx` de Villca Villegas (MIT), sujeto a verificación de hash, licencia y paridad de preprocesamiento.

### Privacidad y persistencia

- El video y los landmarks no se envían a Supabase ni a un endpoint propio.
- No se guardan grabaciones por defecto.
- Supabase se reserva para catálogo de modelos, manifiestos aprobados, contenido LSB y, más adelante, sesiones con política de retención y RLS definidas.
- La UI debe indicar que el procesamiento es local y que el resultado es una demostración.

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

- La descarga inicial incluye el bundle de MediaPipe (aproximadamente 13.7 MB) y, más adelante, el modelo de secuencia (aproximadamente 7.2 MB). Se necesita caché y estados de carga claros.
- WebGPU no está disponible en todos los navegadores y dispositivos; el fallback WASM puede ser más lento.
- El modelo de referencia cubre 58 clases y condiciones de captura limitadas; no representa LSB general ni traducción libre.
- La paridad entre MediaPipe Python y MediaPipe Web debe verificarse con fixtures antes de confiar en las predicciones.
- El procesamiento en el hilo principal puede afectar la UI; se debe medir y migrar a worker si es necesario.
- El WASM se copia desde la versión fijada del paquete y se sirve desde el mismo origen. El modelo Holistic `.task` aún usa Google Storage por defecto; antes del piloto se debe alojar en una ubicación propia aprobada y versionada.

## Fases

1. **Landmarks locales:** cargar Holistic, dibujar overlay, extraer las 138 features y exponer estado/errores.
2. **Clasificador aislado:** integrar ONNX Runtime Web, ventana de 30 fotogramas y etiquetas candidatas.
3. **Evaluación:** benchmark por clase y participante, latencia, memoria y paridad con Python.
4. **Continuo:** segmentación, ventana deslizante, marcadores no manuales y abstención.
5. **Registro:** manifiesto, hash, licencia y catálogo Supabase antes de habilitar un modelo en producción.

## Criterios de aceptación

- La cámara puede activarse sin cargar el modelo de landmarks y la app sigue siendo usable si la carga falla.
- El adaptador libera recursos al detener la cámara o cambiar de atención.
- La extracción de features es determinista y tiene pruebas unitarias.
- La UI distingue carga, listo, error y detección sin bloquear la captura existente.
- No se envía video ni landmarks a la red.
- Un resultado del clasificador se presenta como candidato revisable, nunca como traducción confirmada.

## Fuentes

- MediaPipe Holistic Landmarker, guía web: https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker/web_js
- MediaPipe Holistic Landmarker, overview: https://developers.google.com/edge/mediapipe/solutions/vision/holistic_landmarker
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- ONNX Runtime Web WebGPU: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- Modelo de referencia LSB: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB
- OpenCV.js: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
