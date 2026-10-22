# Design QA — La Voz de tus Manos

**Final result: passed**

La interfaz de `/atender` y `/historial` se revisó contra la referencia visual proporcionada, sobre la build de producción del 22 de octubre de 2026.

## Entorno

- Escritorio: Chromium, 1680 × 944.
- Móvil: Chromium, 390 × 844.
- URL local: `http://localhost:3000`.
- Automatización visual e interacción: `agent-browser`.

## Resultado visual y funcional

- La atención conserva las tres áreas de captura, conversación y respuesta; el historial presenta filtros, tabla paginada y detalle.
- La vista móvil reemplaza la tabla por tarjetas y mantiene `scrollWidth` igual al ancho del viewport.
- El historial muestra los 18 registros del rango inicial de 30 días.
- Se verificaron captura simulada, corrección y confirmación de propuesta, error y reintento, envío de respuesta, finalización, detalle de conversación, filtros y reapertura con confirmación.
- Los controles interactivos aparecen con nombres accesibles en el árbol de `agent-browser`; los diálogos se abren y cierran con su título y controles correspondientes.
- No se detectaron errores de página ni mensajes de consola en la revisión de producción.

## Verificación automatizada

- ESLint: correcto.
- Vitest + Testing Library: 12 pruebas correctas.
- Playwright: 5 pruebas correctas y 1 omisión intencional en el proyecto de escritorio para el caso exclusivo de tarjetas móviles; el mismo caso pasa en el proyecto móvil.
- `next build`: correcto; rutas estáticas `/atender` y `/historial`.

Playwright usó Chromium instalado en el sistema mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. La cámara y la interpretación LSB siguen simuladas; el dictado usa Web Speech API del navegador. Los tests sustituyen ese servicio por un adaptador falso y no activan un micrófono real. El avatar ilustrativo y los datos ficticios no validan traducciones LSB.

## Integración del dictado

La build de producción se revisó de nuevo con `agent-browser` en Chromium a 390 × 844. El contenido mantuvo el ancho del viewport y no hubo errores de página ni de consola. axe-core reportó cero violaciones automáticas; dejó pendientes de revisión manual dos contrastes sobre imágenes, en el indicador de cámara y la etiqueta del avatar.

El flujo de servicio se verificó con pruebas del adaptador y del compositor: inicio, resultados parciales/finales, permiso denegado, fallback a teclado y envío con origen `dictation`. La captura real de audio no se activó durante la revisión automatizada.
