# Holistic en Worker: prototipo de la etapa 3

## Qué está implementado

El baseline sigue activo por defecto. Para probar el candidato, añadir a
`apps/web/.env.local` (ignorado por Git) y reiniciar **el mismo servidor**:

```dotenv
NEXT_PUBLIC_MEDIAPIPE_WORKER=on
```

No hace falta instalar dependencias, navegadores, otro entorno ni nuevos pesos.
Dev/build generan el Worker clásico y `vision_bundle.js` desde el paquete local
`@mediapipe/tasks-vision@1.1.1`. El generador rechaza otra versión hasta revisar
el cargador. El WASM procede del mismo paquete instalado; no se usa jsDelivr.
Los archivos generados se ignoran en Git. No existe un Service Worker nuevo ni
una promesa de funcionamiento offline.

Un Worker **clásico** permite que el cargador WASM de MediaPipe use
`importScripts`; no se introduce un shim de `document` ni se simula el DOM. El
Worker intenta GPU y después CPU. El adaptador transfiere un `ImageBitmap` con
sus dimensiones originales, sin espejar, recortar ni reducir la imagen.

La extracción usa el mismo Holistic, opciones, orden de landmarks y preprocesador
del baseline. El contrato ONNX sigue siendo `[1,30,138]`; no se rellena una ventana
con fotogramas duplicados ni se sustituye LSB por otra lengua.

## Ciclo de vida y errores

- Una sola detección en curso, incluida la creación del bitmap; ninguna cola de
  imágenes. El hook omite nuevas oportunidades mientras el detector está ocupado.
- El Worker cierra el bitmap transferido en `finally`. Si la captura termina
  antes de transferirlo, lo cierra el adaptador. Detener termina el Worker y
  rechaza cualquier operación pendiente; sus respuestas tardías se ignoran.
- La inicialización tiene un límite de 60 s y cada detección de 10 s. No son
  objetivos de rendimiento: evitan operaciones colgadas. El hook descarta
  resultados que ya tienen más de 1 s o pertenecen a una pestaña oculta.
- Sin Worker/OffscreenCanvas/createImageBitmap, o si falla la inicialización,
  se libera el candidato y se intenta el baseline. El diagnóstico muestra el
  modo real y el motivo de fallback.
- Un error durante la captura detiene la detección. No se cambia de motor a mitad
  de una secuencia, ni se convierte un error en una propuesta para la conversación.
- Solo vuelven pose/manos y tiempos. No se guarda video, landmarks ni métricas en
  Supabase, almacenamiento del navegador o analítica.

## Cómo comparar

1. Registrar navegador/equipo y el mismo conjunto autorizado de señas y reposo.
2. Ejecutar baseline con la opción vacía y candidato con `on`. Reiniciar el
   servidor existente entre configuraciones; no mantener dos servidores.
3. Separar carga fría/caliente. Revisar en Ajustes de captura el modo real,
   delegado, `landmarkMs`, `landmarkWorkerMs`, `framePreparationMs`, FPS y descartes.
4. Medir también respuesta a escritura/clics y latencia desde comienzo anotado de
   la seña hasta propuesta visible. Exportar los agregados manualmente.
5. Aplicar el protocolo de [rendimiento](recognition-performance.md), incluyendo
   F1 macro, falsos positivos y abstención. Un Worker puede mantener la interfaz
   fluida sin acelerar MediaPipe o puede añadir costo por transferencia.

## Evidencia y límites

Las pruebas de contrato cubren exclusión mutua, cancelación durante preparación
de imágenes e inferencia, respuestas obsoletas, timeout y fallback al iniciar.
El hook prueba captura asíncrona sin colas ni publicación tras desmontar.

Playwright usa el Worker y adaptador reales con un motor Vision **sintético**
que ocupa el Worker durante 250 ms: comprueba transferencia de una imagen de
320×240 y que los temporizadores de la página siguen avanzando. Otra prueba
carga el bundle y WASM locales reales y comprueba que se llega a solicitar un
archivo de tarea deliberadamente inexistente, devolviendo `model-load`.
Ninguna de estas pruebas ejecuta Holistic sobre señas reales ni mide su precisión.
El smoke del ONNX real de la etapa anterior se conserva.

Falta fijar una copia autorizada del archivo `holistic_landmarker.task` con
versión, tamaño y SHA-256 conocidos, además de medir su caché fría/caliente. El
valor por defecto de ese **archivo de modelo** sigue siendo la URL externa de
Google con `latest`; el paquete y WASM local no incluyen esos pesos. No se ha
inventado un hash ni descargado un modelo distinto para aparentar validación.

No está demostrada una reducción de 50% de la captación. El candidato permanece
optativo hasta contar con un benchmark completo y evaluación de calidad sobre
las mismas muestras y participantes no vistos durante el entrenamiento.
