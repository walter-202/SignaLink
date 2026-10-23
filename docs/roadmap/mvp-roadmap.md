# Hoja de ruta del MVP

## Resultado que buscamos

Una persona funcionaria inicia una atención, la persona usuaria hace una seña dentro de un vocabulario LSB acotado, el sistema propone un texto revisable y la persona funcionaria responde con texto o dictado. Para un conjunto pequeño de respuestas validadas, un avatar reproduce una animación LSB aprobada. La conversación queda en el historial con permisos adecuados. El MVP no graba ni sube video de la cámara.

El MVP reconoce un vocabulario limitado de señas aisladas en condiciones conocidas; no se presenta como traductor general de LSB ni envía una traducción sin revisión humana.

## Estado actual

- La interfaz de atención e historial usa Supabase Auth y persistencia real por cuenta; las cuentas se crean desde Supabase.
- La cámara usa `getUserMedia`; MediaPipe Holistic detecta pose y manos en el navegador.
- El paquete WASM se sirve desde el mismo origen. El modelo Holistic todavía se descarga de Google Storage por defecto.
- Se calculan 138 características por fotograma. El segmentador continuo recoge 30 fotogramas a intervalos de 33 ms (~30 fps) y el ONNX LSB v4 propone una etiqueta por segmento.
- El modo continuo acumula etiquetas en un borrador editable. No traduce frases continuas; cada frase requiere revisión y confirmación humana antes de guardarse.
- El modelo de referencia cubre 58 clases, no está calibrado con signantes LSB y su procedencia/licencia de corpus no está documentada por separado.
- El visor 3D puede cargar un GLB de prueba; faltan animaciones LSB validadas y su catálogo.
- Pendiente: benchmark en dispositivos objetivo, calibración de umbrales/segmentación, corpus autorizado, fijar el modelo Holistic y definir organizaciones/RLS multi-cuenta.

## Fases y criterios de salida

| Fase | Trabajo | Criterio para avanzar |
| --- | --- | --- |
| **0. Base local y privacidad** (base implementada; falta fijar el `.task`) | Servir WASM desde el origen de la app; copiar el modelo `.task` a una ubicación propia y fijar su versión/hash; conservar la cámara fuera de la red y del almacenamiento. | La pestaña de red no solicita WASM a jsDelivr; el modelo tiene ubicación y checksum aprobados antes del piloto; al detener cámara se liberan todas las pistas. |
| **1. Alcance y contenido LSB** | Con personal de atención y personas sordas, escoger un trámite piloto y unas 10–20 señas aisladas de alta frecuencia. Definir variantes regionales, respuestas, derechos de uso, consentimiento y evaluación. | Hay un catálogo acotado y revisado; los ejemplos pueden usarse legalmente; existe un conjunto de prueba separado por persona signante. |
| **2. Atención persistente** (base implementada) | Conectar Supabase Auth para personal; crear migraciones y repositorios para atenciones y mensajes; aplicar RLS por institución/rol; persistir búsqueda, reapertura e historial. No guardar video ni landmarks crudos. | Una persona autorizada crea y reabre una atención tras recargar; otra cuenta no puede consultar sus datos; las pruebas verifican RLS y el borrado/retención acordados. |
| **3. Reconocimiento acotado** (baseline implementado) | Segmentación por movimiento, 30 fotogramas de 138 características a ~30 fps, clasificador ONNX local, propuesta editable y abstención. | Métricas por seña y por persona signante cumplen los umbrales acordados; el flujo funciona en los móviles objetivo; ninguna salida se confirma o envía sin revisión. |
| **4. Respuesta LSB con avatar** (1–3 semanas si hay contenido) | Mapear respuestas aprobadas a clips/animaciones de un avatar riggeado. Mantener texto visible y controles de reproducción. | Personas competentes en LSB validan cada animación y frase; si no existe una animación aprobada, se ofrece texto en lugar de inventar una seña. |
| **5. Piloto y salida** (1–2 semanas) | Probar el flujo completo con personal y personas sordas, revisar accesibilidad, rendimiento, privacidad, recuperación de errores, monitoreo y despliegue de staging. | Se completa una atención de inicio a fin en los dispositivos acordados, con resultados de prueba documentados y sin defectos bloqueantes de privacidad o accesibilidad. |

Los tiempos son de ingeniería y dependen de que el corpus, las licencias y las animaciones estén disponibles. La obtención y validación de contenido puede ser el camino crítico y extender el calendario.

## Orden de avance recomendado

1. Cerrar alcance, vocabulario piloto, permisos y política de retención con las personas expertas en LSB y atención.
2. Mantener autenticación, esquema y RLS por cuenta; definir organizaciones antes de compartir atenciones.
3. Evaluar el baseline con datos autorizados, separados por persona signante, y calibrar segmentación, abstención y rendimiento.
4. Integrar propuestas revisables en atención y conectar respuestas aprobadas al avatar.
5. Ejecutar el piloto, corregir errores y desplegar cuando se cumplan los criterios de salida.

## Fuera del primer MVP

- Traducción libre o continua de cualquier conversación en LSB.
- Almacenamiento de video o identificación biométrica de las personas usuarias.
- Generación automática de señas no validadas para el avatar.
- Uso de un clasificador sin una licencia, conjunto de evaluación y umbrales documentados.
