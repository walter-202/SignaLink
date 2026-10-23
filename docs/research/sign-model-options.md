# Modelos de señas para el MVP

## Recomendación

Integrar `model_transformer_enco_v4.onnx` como baseline de **clasificación aislada LSB**. Mantener el resultado editable y sujeto a confirmación humana. No presentarlo como traductor ni como reconocimiento fluido: recibe segmentos de 30 fotogramas (aprox. 1 s a 30 FPS) y devuelve una de 58 etiquetas. La app segmenta por movimiento, acumula etiquetas en un borrador y exige confirmar cada frase. La captura, MediaPipe, el modelo y ONNX Runtime se ejecutan en el navegador.

El artefacto de upstream mide 7,206,466 bytes (6.87 MiB). El runtime WASM de ONNX Runtime Web 1.30.0 añade un archivo de aproximadamente 13.6 MiB en el primer uso; los siguientes usos pueden reutilizar la caché HTTP del navegador. La UI carga ambos automáticamente al abrir la vista de atención, incluso si la captura aún no se inició. El teclado y el dictado siguen disponibles aunque falle esa descarga.

## Opciones revisadas

| Opción | Evidencia y requisitos | Decisión para el MVP |
| --- | --- | --- |
| **LSB referencia v4** | ONNX publicado de 7.21 MB, entrada `[1,30,138]`, 58 logits y 5,800 secuencias declaradas por upstream. No publica latencia web ni evaluación por signante. El repo declara MIT; no documenta por separado licencia/procedencia del corpus. | Baseline inmediato; hash SHA-256 comprobado e incluido con atribución. Experimental hasta obtener consentimiento/procedencia de datos y validar paridad/evaluación. |
| **SignBart, LSA64** | 749,888 parámetros y 96.04% top-1 reportados por sus autores. Checkpoints `.pth`; no encontré exportación ONNX/browser. El repo no declara licencia. LSA64 es otra lengua y tiene términos CC BY-NC-SA 4.0. | No distribuir ni transferir sus cifras a LSB. Referencia de arquitectura compacta si se aclaran permisos. |
| **Siformer, LSA64** | 2.55 M parámetros; paper reporta 99.84% en LSA64 y 32.4 ms para un benchmark WLASL100 sin un entorno de navegador comparable. Split LSA aleatorio, no hold-out por signante. No encontré checkpoint ONNX/browser listo. Código MIT; el dataset tiene condiciones propias. | Solo comparación académica; no reemplaza el modelo LSB. |
| **SPOTER Embeddings** | Código Apache-2.0, conversión a ONNX y demo web. Autores reportan ~40 ms de inferencia para un clip de 4 s a 25 FPS; eso no mide cámara ni landmarks. No encontré checkpoint ONNX incluido y su código presenta discrepancia de dimensiones entre conversor y preprocesador. | Buena referencia para experimentar con runtime web, no artefacto listo ni transferencia directa a LSB. |
| **LSA-T** | Corpus/modelo para vídeo continuo y subtítulos de LSA. No encontré artefacto ONNX/browser listo. | No usar en LSB; útil como referencia futura de segmentación continua si sus datos y términos permiten el uso. |
| **TCN o GRU propios** | Hipótesis: red temporal compacta sobre los 138 valores por frame podría reducir el coste y adaptarse al vocabulario real. No hay medición para este proyecto. | Mejor ruta para un MVP LSB propio tras reunir clips autorizados y evaluar por signante. Empezar con 10–20 intenciones frecuentes y comparar TCN/GRU. |

**LSA (Argentina) y LSB (Bolivia) son lenguas distintas.** Una precisión alta en LSA64 no demuestra reconocimiento LSB.

## Próximo avance de producto

1. Medir por separado la descarga (modelo y WASM), inicialización ONNX, coste de landmarks y clasificación en CPU/WebGPU; empezar con WASM para el modelo pequeño y revisar el perfil antes de sumar WebGPU.
2. Comparar las 138 características de Python y TypeScript usando secuencias autorizadas, no solo fixtures sintéticos.
3. Evaluar precision/F1 por clase, abstención, latencia total y variaciones de persona/cámara/luz, con participantes separados entre entrenamiento y evaluación.
4. Diseñar la recopilación local LSB y obtener consentimiento, política de retención, procedencia y licencia del corpus antes de entrenar TCN/GRU.
5. Para conversación fluida, agregar segmentación de señas y acumulación de etiquetas estables; no inferir frases completas concatenando una única ventana por cada toque.

## Fuentes primarias

- Modelo LSB y README: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB
- Pipeline Python y preprocesamiento: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/main/deteccion_manos_pose.py
- Etiquetas: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/main/clases.py
- Licencia del repo LSB: https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/main/LICENSE.txt
- ONNX Runtime Web, WASM y configuración: https://onnxruntime.ai/docs/tutorials/web/deploy.html
- ONNX Runtime Web, diagnóstico y carga pesada: https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html
- ONNX Runtime Web, WebGPU: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- SignBart, paper: https://arxiv.org/abs/2506.21592
- SignBart, repo y pesos: https://github.com/TinhNguyen2312/SignBart
- Siformer, repo: https://github.com/mpuu00001/Siformer
- Siformer, paper: https://researchmgt.monash.edu/ws/portalfiles/portal/668651513/635449284-oa.pdf
- SPOTER Embeddings: https://github.com/xmartlabs/spoter-embeddings
- LSA64: https://facundoq.github.io/datasets/lsa64/
- LSA-T: https://github.com/midusi/LSA-T
