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

- **`/atender`**: trámite activo, captura simulada con edición y confirmación, conversación, respuestas escritas o dictadas, frases frecuentes, observaciones y vista de avatar.
- **`/historial`**: búsqueda, filtros por estado y fecha, paginación, resumen de la conversación, detalle, reapertura confirmada y modal con la conversación completa.

La interfaz se adapta a móvil, incluye navegación por teclado, etiquetas para controles, estados accesibles, opción de contraste alto y respeto por `prefers-reduced-motion`.

## Límites de la demostración

La cámara no se activa y la captura LSB sigue usando una propuesta fija de demostración; no hay reconocimiento ni traducción LSB conectados. El dictado ya usa Web Speech API del navegador cuando está disponible, con `es-BO`; el texto final se agrega al borrador y requiere revisión antes del envío. La aplicación no envía el audio a un endpoint propio, aunque el navegador o su proveedor pueden procesarlo según su implementación y políticas. Si el dictado no está disponible o falla, la persona puede escribir la respuesta. Los registros se guardan solo en el estado de Zustand mientras el documento está abierto, no usan almacenamiento del navegador y vuelven al fixture al recargar. El avatar de imagen es ilustrativo y no genera señas verificadas. Se puede cargar un `.glb` de hasta 25 MB para probar localmente un modelo y sus clips; el archivo no se envía a un servidor.

Las imágenes de cámara y avatar son recursos generados para la interfaz de demostración. No representan personas usuarias ni contenido lingüístico validado.

## Estructura

```text
src/
  app/                         # App Router y estilos globales
  components/                  # Shell, controles y feedback compartidos
  design-system/               # Tokens de color y superficie
  features/
    attention/                 # Captura, conversación, respuesta y estado de sesión
    avatar/                    # Visor GLB reutilizado en la vista previa
    communication/             # Puerto de voz, adaptador de navegador y controles
    procedure-history/          # Dominio, fixtures, filtros y vista de historial
tests/
  e2e/                         # Flujos de navegador con Playwright
```

La interfaz usa Next.js, TypeScript, Tailwind CSS 4, configuración compatible con shadcn/ui, Radix UI, Lucide, Zustand y Zod. Los controles de diálogo, selección y pestañas se basan en primitivas Radix con estilos propios del producto.

## Conexión con Supabase

El cliente oficial de Supabase está preparado para Next.js App Router. `src/lib/supabase/client.ts` crea el cliente de navegador y `src/lib/supabase/server.ts` crea el cliente de servidor con cookies compatibles con SSR. Ambos usan únicamente la URL del proyecto y una publishable key; nunca se expone una clave `service_role` o `sb_secret`.

Para enlazar un proyecto, copia `apps/web/.env.example` a `apps/web/.env.local` y reemplaza `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores del diálogo **Connect** de Supabase. Después reinicia `pnpm dev:web`. No es necesario configurar estas variables para ejecutar la demostración actual.

La conexión todavía no guarda atenciones ni conversaciones. Esa persistencia se añadirá cuando se definan la retención, el acceso y las reglas RLS para datos potencialmente sensibles; hasta entonces se conservan los fixtures y el estado en memoria.

## Servicios y siguiente integración

La comunicación por voz sigue un puerto de aplicación (`SpeechRecognitionService`) con un adaptador para Web Speech API. El compositor depende del contrato y el proveedor de la vista conecta el adaptador del navegador; en pruebas se sustituye por un servicio falso. El adaptador maneja el idioma `es-BO`, resultados parciales y finales, pausa/reinicio de sesión, permisos denegados y errores de disponibilidad.

Las siguientes integraciones se añadirán detrás de contratos equivalentes, en este orden:

1. **Cámara:** adaptador de `getUserMedia`, iniciado solo por acción de la persona y con liberación de pistas al cerrar o cambiar de atención.
2. **Reconocimiento LSB:** puerto para un modelo aprobado que reciba una secuencia de captura y devuelva propuestas con modelo/versión y estado revisable. La UI no tratará resultados como traducción confirmada.
3. **Sesiones e historial:** repositorio de aplicación implementado en servidor, con política de retención y permisos definida antes de persistir conversaciones.

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
