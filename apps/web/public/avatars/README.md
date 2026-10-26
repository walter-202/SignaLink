# Avatar LSB de demostración

- `signalink_avatar.glb`: avatar exportado desde MakeHuman/MPFB con el clip `HOLA` (20,540,968 bytes).
- La fuente de Blender está en [`apps/web/assets/avatars/signalink_avatar_source.blend`](../../assets/avatars/signalink_avatar_source.blend) con la acción `HOLA`; se guarda fuera de `public` para evitar descargarla desde la aplicación.
- `signalink_avatar_v5_refined.glb`: prototipo V5 de torso y brazos con rig de 43 articulaciones y 17 clips técnicos (6,051,776 bytes; SHA-256 `d188c1678608997e941795c9a09d8eeeae0a619c1710038841cc9a92fbf7ad29`). Solo se carga en `/avatar-lab`; sus clips `DEMO_*` no son señas LSB validadas.

Los assets base y la salida del avatar son CC0 según la licencia de MakeHuman/MPFB.
El código de MPFB (GPL) y MakeHuman (AGPL) no se redistribuye en este repositorio.

El clip `HOLA` es propio y **provisional**: se basa en la referencia del Módulo 1
de LSB (página 56), pero no ha sido validado por una persona competente en LSB.
El visor solo carga el GLB después de que el usuario lo solicite para «Hola»; no
se carga automáticamente al entrar a la atención. El GLB embebe sus texturas;
el `.blend` conserva referencias a texturas locales de MPFB y no es autónomo.

El modelo V5 no reemplaza este GLB ni está configurado en `AvatarPreview`. Su
manifiesto, fuente procedimental y QA entregada con el kit están en
[`apps/web/assets/avatars/signalink-avatar-v5/`](../../assets/avatars/signalink-avatar-v5/)
y el resumen técnico en [`docs/research/avatar-v5.md`](../../../../docs/research/avatar-v5.md).
