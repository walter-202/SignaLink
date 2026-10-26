# Catálogo de saludos y avatar LSB

## Objetivo

Integrar una consulta verificable de los saludos del Módulo 1 de LSB y habilitar
una vista 3D provisional sin presentarla como traducción automática ni como
contenido validado.

## Implementado

- Catálogo local de 19 expresiones y aliases con referencia a sección y página.
- Búsqueda por frase completa tras normalizar mayúsculas, tildes y puntuación;
  una oración más larga no se relaciona con una coincidencia parcial.
- Ficha que separa etiqueta española, glosa escrita (no documentada), fuente y
  estado de revisión. Las ilustraciones del manual no se copian al repositorio.
- La selección directa de un elemento del catálogo se refleja en el avatar. Si
  se buscó usando el borrador de respuesta, un cambio posterior lo invalida para
  evitar que se reproduzca una selección obsoleta.
- GLB provisional propio con un clip llamado `HOLA`. Solo se asocia con la
  entrada «Hola» y únicamente si ese clip existe de verdad en el archivo.
- El GLB pesa 20,540,968 bytes (20.5 MB) y se carga solo al pedir «Hola» en 3D.
  La imagen estática se mantiene como previsualización inicial; las otras
  expresiones no descargan ni reproducen el clip `HOLA`.
- El prototipo V5 con 43 articulaciones y 17 clips de prueba está disponible en
  `/avatar-lab` con un encuadre frontal adaptable. Permanece separado del flujo
  de atención y no se mapea al catálogo LSB.
- Los archivos `.glb` subidos se procesan como URL local del navegador y se
  limitan a 25 MB. `NEXT_PUBLIC_LSB_AVATAR_MODEL_URL=off` desactiva el GLB
  incluido; una ruta configurada se carga bajo demanda cuando hay un clip
  asociado.
- La fuente de Blender está en `apps/web/assets/avatars/`, fuera de `public`.
  El `.blend` hace referencia a texturas locales de MPFB, mientras que el GLB
  incorpora las texturas necesarias para renderizar.

## Límites y validación pendiente

- La consulta no es traducción de frases, reconocimiento de cámara ni generación
  de glosas. La cámara y el clasificador ONNX siguen siendo un flujo aparte.
- «Hola» es una animación provisional inspirada en la referencia de la página 56
  del Módulo 1. Una persona competente en LSB debe revisar la forma, orientación,
  movimiento y significado antes de considerarla correcta.
- No hay clips para los otros 18 saludos. Si falta una animación exacta, el
  visor muestra el estado de no disponibilidad y nunca sustituye por `HOLA` ni
  por el primer clip del modelo.
- La V5 es una prueba del rig; falta QA del validador oficial de Khronos, prueba
  en móviles y revisión lingüística. Su auditor entregado queda en
  `REVIEW_REQUIRED`.
- La licencia CC0 del resultado se declara en la documentación de origen del
  asset. Antes de usarlo fuera del prototipo, conservar la atribución/procedencia
  y confirmar la licencia de todos los componentes incorporados.

## Criterios de aceptación

- [x] Exact match de los 19 saludos sin fallback por subcadena.
- [x] La ficha indica la fuente, la ausencia de glosa y el estado sin revisión.
- [x] El modelo grande no se solicita hasta una acción expresa para «Hola».
- [x] Solo se reproduce el clip mapeado exacto; se conserva la carga local de GLB.
- [ ] Validación del clip «Hola» por personas competentes en LSB.
- [ ] Acordar licencia, consentimiento y proceso de revisión para clips nuevos.
- [ ] Añadir cada animación posterior solo después de aprobación documentada.

## Comprobaciones

La implementación debe pasar los comandos documentados desde la raíz:

```bash
pnpm lint:web
pnpm test:web
pnpm build:web
```

El flujo visual puede verificarse en `/atender`: elegir o buscar «Hola»,
confirmar que el GLB no aparece en la red antes de pulsar el botón 3D y que la
etiqueta «Clip sin validación» permanece visible después de reproducirlo.
