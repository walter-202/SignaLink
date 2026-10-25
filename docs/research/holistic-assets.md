# Pesos Holistic: carga, integridad y caché

## Estado del archivo real

El paquete `@mediapipe/tasks-vision@1.1.1` incluye el runtime y WASM, pero no
`holistic_landmarker.task`. En este workspace no hay una copia local revisada de
ese archivo. Google Storage no figura entre los destinos permitidos del entorno;
no se descargó por un mirror ni se inventó su SHA-256. El hash del ONNX LSB no es
el hash de Holistic: son archivos distintos.

La infraestructura de esta entrega permite fijar y servir un archivo revisado.
La configuración por defecto conserva el origen externo anterior con `latest`,
marcado como **sin hash fijado**. No se presenta como artefacto verificado ni como
funcionamiento completo offline.

## Preparar un archivo autorizado

Obtener del proveedor/revisión del equipo la copia exacta y su versión, SHA-256
y tamaño esperado en bytes. Tras revisar procedencia, permisos y compatibilidad:

```sh
pnpm --filter @la-voz/web prepare:holistic \
  /ruta/local/holistic_landmarker.task VERSION_REVISADA SHA256_ESPERADO BYTES_ESPERADOS
```

El comando solo lee un archivo local. Rechaza metadatos incompletos, tamaños
mayores a 64 MiB, tamaño/hash incorrectos y archivos sin cabecera ZIP. Esa
cabecera no prueba compatibilidad semántica ni validación lingüística.

Después de verificarlo, escribe de forma atómica una copia bajo
`apps/web/public/models/holistic/<version>/<sha256>/holistic_landmarker.task`
y un `manifest.json` con sus metadatos públicos. No incluye rutas locales del
colaborador. La carpeta se ignora en Git; el pipeline de despliegue debe ejecutar
la preparación desde su artefacto autorizado antes del build. No se incluyen
pesos ficticios en el repositorio.

El comando imprime estas cuatro variables para configurar localmente o en el
despliegue; no escribe `.env.local` ni toca credenciales:

```dotenv
NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_URL=/models/holistic/VERSION/SHA256/holistic_landmarker.task
NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_VERSION=VERSION
NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_SHA256=SHA256
NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_BYTES=BYTES
```

Sustituir los marcadores por los valores revisados. Son metadatos públicos del
modelo, no claves de API. Configurar las tres propiedades de integridad juntas;
un pin parcial o inválido detiene la carga. Reiniciar el mismo servidor Next tras
cambiarlas. La verificación no requiere activar el Worker.

## Qué cambia al activar la cámara

1. Se carga el archivo bajo demanda. El lector limita el tamaño y permite abortar
   al detener la captura. Si hay pin, exige tamaño exacto y calcula SHA-256 antes
   de entregar bytes a MediaPipe.
2. GPU y CPU reciben el mismo buffer ya leído. El fallback no vuelve a pedir el
   modelo mediante `modelAssetPath`. En modo Worker, el buffer se transfiere una
   vez; el hilo de la interfaz deja de poseerlo tras la transferencia.
3. Para archivos fijados se usa una caché dedicada de CacheStorage, con clave por
   versión/hash. Cada lectura se verifica de nuevo. Una entrada corrupta se
   elimina y se intenta leer el recurso por HTTP; si también falla la integridad,
   no se crea una sesión de MediaPipe ni se permite un fallback sin verificación.
4. La caché mantiene un artefacto vigente durante cargas secuenciales. Se eliminan
   las entradas anteriores después de comprobar los nuevos bytes. Si el navegador
   bloquea CacheStorage o no tiene cuota, la carga verificada sigue funcionando
   por HTTP. No se afirma que siempre haya persistencia o cero tráfico.
5. Sin pin no se escribe en esta caché persistente de la app. Se usa la caché HTTP
   normal con `force-cache`; sus resultados dependen de las cabeceras/navegador.

La caché contiene exclusivamente pesos públicos del modelo. No guarda cámara,
landmarks, mensajes, observaciones ni tokens de acceso. Las lecturas no incluyen
credenciales. No se añade un Service Worker ni un bypass de autenticación.

## Cómo medir y comprobar

En Ajustes de captura, el diagnóstico distingue `verified`/`unverified`, origen
`fetch`/`cache-storage`, versión/hash y bytes. `fetch` puede incluir caché HTTP;
no equivale necesariamente a una descarga de red. El JSON v3 añade
`landmarkAssetReadMs` y `landmarkAssetIntegrityMs`. `landmarkLoadMs` sigue midiendo
la inicialización completa, incluida caché, transferencia y creación del motor.

Las pruebas unitarias verifican hash real de un fixture pequeño, límites de
lectura, datos corruptos, cancelación, modo privado y reutilización GPU/CPU.
Playwright comprueba lectura de caché sin conexión y recuperación de corrupción
en Chromium. Se usan bytes sintéticos para estos contratos, no un Holistic real.
Otra prueba carga el bundle/WASM reales y rechaza bytes de tarea inválidos.

Para cerrar la etapa 3 falta provisionar la copia real revisada y ejecutar
comparaciones frías/calientes de ambos motores sobre señas autorizadas en el
equipo objetivo. Reducir descargas repetidas no demuestra por sí mismo una mejora
del 50% desde el comienzo de una seña hasta su propuesta.
