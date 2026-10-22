# Aplicación web

Prototipo de interfaz para **La Voz de tus Manos**, organizado por funcionalidades y basado en el flujo visual de las vistas de atención e historial.

## Ejecutar localmente

Desde la raíz del repositorio:

```bash
pnpm install
pnpm dev:web
```

Abre `http://localhost:3000`. La ruta `/` redirige a `/atender`.

## Vistas

- **`/login`**: acceso de personal con correo y contraseña de Supabase Auth. La aplicación no ofrece registro público.
- **`/atender`**: atención activa guardada, cámara con vista previa y landmarks locales opcionales, captura simulada con edición y confirmación, conversación, respuestas escritas o dictadas, frases frecuentes, observaciones y vista de avatar.
- **`/historial`**: búsqueda, filtros por estado y fecha, paginación, resumen de conversaciones guardadas, detalle y reapertura confirmada.

La interfaz se adapta a móvil, incluye navegación por teclado, etiquetas para controles, estados accesibles, opción de contraste alto y respeto por `prefers-reduced-motion`.

## Límites de la demostración

La cámara usa `getUserMedia` a través de un adaptador y solo se activa con una acción explícita. La vista previa no se graba, no se envía a un servidor y se libera al detenerla, al cambiar de atención o al finalizar la sesión. Si el permiso se deniega o no hay cámara, la persona puede continuar con la captura de demostración o escribir la respuesta. La captura LSB sigue usando una propuesta fija; la app detecta landmarks localmente con MediaPipe, pero no hay clasificador ni traducción LSB conectados. El dictado usa Web Speech API del navegador cuando está disponible, con `es-BO`; el texto final se agrega al borrador y requiere revisión antes del envío. La aplicación no envía el audio a un endpoint propio, aunque el navegador o su proveedor pueden procesarlo según su implementación y políticas. Si el dictado no está disponible o falla, la persona puede escribir la respuesta. Las atenciones, respuestas, mensajes revisados y observaciones se guardan en Supabase. No se almacenan frames, imágenes, video ni audio de la cámara. El avatar de imagen es ilustrativo y no genera señas verificadas. Se puede cargar un `.glb` de hasta 25 MB para probar localmente un modelo y sus clips; el archivo no se envía a un servidor.

Las imágenes del avatar son recursos generados para la interfaz de demostración. No representan personas usuarias ni contenido lingüístico validado.

## Landmarks locales

La feature `sign-recognition` carga MediaPipe Holistic bajo demanda, procesa la vista previa en el navegador y dibuja pose y manos sobre un canvas. No envía video, frames ni landmarks a Supabase ni a un endpoint propio. La detección se puede desactivar desde ajustes o con `NEXT_PUBLIC_SIGN_LANDMARKS=off`; los tests E2E la desactivan para evitar descargar el modelo.

El paquete fijado `@mediapipe/tasks-vision@1.1.1` incluye los binarios WASM. Antes de iniciar desarrollo o producción, `scripts/copy-mediapipe-wasm.mjs` copia las variantes SIMD y no-SIMD a `public/mediapipe/wasm`; la app las sirve desde su propio origen, sin depender de jsDelivr. El archivo del modelo Holistic `.task` no viene dentro del paquete y todavía se descarga desde Google Storage por defecto; su URL usa `latest`, así que habrá que copiarlo a un recurso propio y fijar su versión/hash antes del piloto. `NEXT_PUBLIC_MEDIAPIPE_WASM_PATH` y `NEXT_PUBLIC_MEDIAPIPE_HOLISTIC_MODEL_URL` permiten fijar rutas propias para ambos recursos. La extracción actual genera 138 características por fotograma; todavía falta acumular la secuencia temporal de 30 fotogramas y conectarla a un clasificador ONNX con etiquetas LSB.

La decisión y sus límites están documentados en el [ADR-001](../../docs/architecture/adr/ADR-001-browser-only-sign-pipeline.md) y la investigación en [browser-sign-recognition.md](../../docs/research/browser-sign-recognition.md).

## Estructura

```text
src/
  app/                         # App Router y estilos globales
  components/                  # Shell, controles y feedback compartidos
  design-system/               # Tokens de color y superficie
  features/
    attention/                 # Captura, conversación, respuesta y estado de sesión
    avatar/                    # Visor GLB reutilizado en la vista previa
    camera/                    # Puerto y adaptador de getUserMedia
    communication/             # Puerto de voz, adaptador de navegador y controles
    procedure-history/          # Dominio, fixtures, filtros y vista de historial
    sign-recognition/          # MediaPipe, features por fotograma y overlay local
tests/
  e2e/                         # Flujos de navegador con Playwright
```

La interfaz usa Next.js, TypeScript, Tailwind CSS 4, configuración compatible con shadcn/ui, Radix UI, Lucide, Zustand y Zod. Los controles de diálogo, selección y pestañas se basan en primitivas Radix con estilos propios del producto.

## Conexión con Supabase

El inicio de sesión y la sesión SSR usan `@supabase/ssr`, cookies y `getClaims()` para verificar al personal en páginas protegidas. `src/proxy.ts` renueva la sesión y protege `/atender` y `/historial`; el layout vuelve a verificar la identidad. El cliente del navegador solo usa la URL y publishable key. Nunca se incluye una clave `service_role` o `sb_secret` en el frontend.

El esquema inicial está en `supabase/migrations/`. Se aplicó al proyecto `la-voz-de-tus-manos` en `sa-east-1`. `attentions` y `attention_messages` tienen RLS habilitado; cada usuario autenticado solo ve sus propios registros. Los mensajes no se pueden modificar desde la app y no se permite leer ni escribir como usuario anónimo. Las tablas solo guardan texto y referencias de trámites.

Para ejecutar localmente, copia `apps/web/.env.example` a `apps/web/.env.local` y configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores del diálogo **Connect**; luego reinicia `pnpm dev:web`. El archivo local actual apunta al proyecto enlazado y está excluido por Git. Las cuentas se crean o invitan desde **Supabase Dashboard → Authentication → Users**; después el personal inicia sesión en `/login`. No compartas claves secretas para que otra persona pueda ejecutar la app.

La política de RLS actual separa la información por cuenta de personal. Para compartir atenciones entre varias cuentas de una misma institución se añadirá un modelo explícito de organización y membresías antes de abrir ese acceso; no se usa una política amplia para todos los usuarios autenticados.

## Servicios y siguiente integración

La comunicación por voz sigue un puerto de aplicación (`SpeechRecognitionService`) con un adaptador para Web Speech API. El compositor depende del contrato y el proveedor de la vista conecta el adaptador del navegador; en pruebas se sustituye por un servicio falso. El adaptador maneja el idioma `es-BO`, resultados parciales y finales, pausa/reinicio de sesión, permisos denegados y errores de disponibilidad.

La cámara sigue un puerto equivalente (`CameraService`) con un adaptador de `getUserMedia`. El hook de presentación gestiona estados de solicitud, permiso denegado, cámara no disponible, detención explícita y liberación de pistas. La captura continúa separada del clasificador; `sign-recognition` detecta landmarks localmente, mientras la interpretación textual sigue siendo simulada.

Las siguientes integraciones se añadirán detrás de contratos equivalentes, en este orden:

1. **Clasificador LSB:** adaptador ONNX Runtime Web que consuma la secuencia de 30 × 138 features y devuelva propuestas con modelo/versión y estado revisable. La UI no tratará resultados como traducción confirmada.
2. **Colaboración institucional:** organizaciones, membresías administradas y permisos para que el personal autorizado comparta el historial sin mezclar instituciones.
3. **Privacidad operativa:** acordar retención y borrado de conversaciones antes de un piloto con datos reales; ahora se guarda texto de conversación y notas por cuenta.
4. **Persistencia y contenido:** catálogo versionado de modelos y recursos LSB, manteniendo la vista previa de cámara fuera del almacenamiento por defecto.

El dictado del navegador puede usar procesamiento del proveedor del navegador; no es una garantía de inferencia local. Los modelos LSB y cualquier API institucional se incorporarán después de definir privacidad, licencias de datos y contratos de entrada/salida.

## Verificación

Desde la raíz del repositorio:

```bash
pnpm lint:web
pnpm test:web
pnpm build:web
pnpm e2e:web
```

Los tests E2E requieren Chromium disponible para Playwright. Si Chromium ya está instalado en el sistema, se puede indicar su ruta con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. La validación manual visual del prototipo se realiza con `agent-browser` y está documentada en [`design-qa.md`](../../design-qa.md).

## Visor GLB y referencia externa

El visor conserva la posibilidad de cargar modelos GLB locales y reproducir sus clips. El flujo de controles se estudió a partir de [IVILSB_FRONTEND](https://github.com/MayOnesita/IVILSB/tree/master/IVILSB_FRONTEND). Ese repositorio no declara una licencia de reutilización; no se copian sus componentes ni recursos.
