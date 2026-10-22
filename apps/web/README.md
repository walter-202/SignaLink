# Visor de avatar

## Ejecutar

Desde la raíz del repositorio:

```bash
pnpm install
pnpm dev:web
```

Abre `http://localhost:3000`. El visor inicia con una figura geométrica
provisional. Puedes cargar un archivo `.glb` de hasta 25 MB; la vista previa se
procesa localmente y el archivo no se sube a un servidor. Si el modelo contiene
clips, aparecerán en el selector para reproducir, pausar, repetir o ajustar la
velocidad.

## Añadir un modelo local persistente

1. Guarda un modelo GLB cuya licencia o permiso de uso esté documentado en
   `apps/web/public/models/avatar.glb`.
2. Copia `.env.example` a `.env.local` dentro de `apps/web`.
3. Inicia de nuevo el servidor de desarrollo.

El modelo debe tener escala humana, estar orientado hacia el eje `+Z` y contener
clips con nombres legibles. El visor conserva el rig y los clips integrados en
el GLB. Todavía no existe un contrato de glosas ni un conjunto de animaciones
LSB revisadas.

## Dictado de voz

La vista incluye una entrada experimental de voz a texto en español de Bolivia
(`es-BO`) mediante Web Speech API. Está disponible solo en navegadores que la
implementan; si no, se puede escribir en el campo. El navegador puede enviar o
procesar el audio mediante sus propios servicios. El dictado solo produce texto:
no traduce a LSB ni selecciona una animación.

## Referencia externa

El flujo de avatar GLB, reproducción de clips y controles de cámara se estudió
a partir de [IVILSB_FRONTEND](https://github.com/MayOnesita/IVILSB/tree/master/IVILSB_FRONTEND).
Ese repositorio no declara una licencia de reutilización. SignaLink no copia sus
componentes, modelo, animaciones ni texturas; se requiere permiso y atribución
antes de integrar cualquiera de esos recursos.
