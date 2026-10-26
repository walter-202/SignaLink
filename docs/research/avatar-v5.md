# Revisión técnica del avatar V5

V5 está integrado en `/avatar-lab` para revisar el rig y sus clips en Three.js.
La vista adopta un encuadre frontal que se ajusta al tamaño del modelo y a la
relación de aspecto. El archivo no se carga en la atención ni altera el modelo
de demostración asociado a `HOLA`.

La inspección independiente del contenedor GLB confirmó que es glTF 2.0, pesa
6,051,776 bytes, coincide con el manifiesto actualizado y su SHA-256
`d188c1678608997e941795c9a09d8eeeae0a619c1710038841cc9a92fbf7ad29`, y contiene
un skin, 43 articulaciones y 17 clips. No contiene un clip llamado `HOLA`. El
kit reporta manos cerradas y pesos normalizados; preservamos esos datos en
[`qa/`](../../apps/web/assets/avatars/signalink-avatar-v5/qa/), pero no repetimos
esa auditoría geométrica en este cambio.

Añadimos los límites de los cuatro morph targets faciales al GLB y a su
generador: Three.js había advertido que esos accessors `POSITION` no declaraban
`min`/`max`.

El laboratorio verifica la carga y reproducción real del GLB en Three.js. No
sustituye el Khronos glTF Validator, QA en móvil, revisión artística ni validación
con personas usuarias de LSB. Los clips `DEMO_*` son ejercicios de rig y no
representan señas validadas. El auditor suministrado dejó el release gate como
`REVIEW_REQUIRED`.

La prueba E2E del visor puede repetirse con:

```sh
pnpm --filter @la-voz/web test:e2e:avatar-lab
```

También se ejecutó en el proyecto móvil emulado de Playwright. Eso confirma el
render del navegador en ambos viewports, no una prueba en un teléfono físico.

El manifiesto, scripts de construcción, atlas y QA entregada con el kit se
conservan en [`apps/web/assets/avatars/signalink-avatar-v5/`](../../apps/web/assets/avatars/signalink-avatar-v5/).
