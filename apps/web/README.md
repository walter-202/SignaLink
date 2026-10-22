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

- **`/atender`**: trámite activo, captura simulada con edición y confirmación, conversación, redacción de respuestas, frases frecuentes, observaciones y vista de avatar.
- **`/historial`**: búsqueda, filtros por estado y fecha, paginación, resumen de la conversación, detalle, reapertura confirmada y modal con la conversación completa.

La interfaz se adapta a móvil, incluye navegación por teclado, etiquetas para controles, estados accesibles, opción de contraste alto y respeto por `prefers-reduced-motion`.

## Límites de la demostración

La cámara no se activa. La propuesta de captura y el dictado son frases fijas para probar la interacción; no hay reconocimiento ni traducción LSB conectados. Los registros se guardan solo en el estado de Zustand mientras el documento está abierto, no usan almacenamiento del navegador y vuelven al fixture al recargar. El avatar de imagen es ilustrativo y no genera señas verificadas. Se puede cargar un `.glb` de hasta 25 MB para probar localmente un modelo y sus clips; el archivo no se envía a un servidor.

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
    procedure-history/          # Dominio, fixtures, filtros y vista de historial
tests/
  e2e/                         # Flujos de navegador con Playwright
```

La interfaz usa Next.js, TypeScript, Tailwind CSS 4, configuración compatible con shadcn/ui, Radix UI, Lucide, Zustand y Zod. Los controles de diálogo, selección y pestañas se basan en primitivas Radix con estilos propios del producto.

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
