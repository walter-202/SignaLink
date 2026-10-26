# Avatar LSB de demostración

- `signalink_avatar.glb`: avatar exportado desde MakeHuman/MPFB con el clip `HOLA` (20,540,968 bytes).
- La fuente de Blender está en [`apps/web/assets/avatars/signalink_avatar_source.blend`](../../assets/avatars/signalink_avatar_source.blend) con la acción `HOLA`; se guarda fuera de `public` para evitar descargarla desde la aplicación.
- `signalink_avatar_v5_refined.glb`: revisión V5.1 con rostro geométrico, 43 articulaciones, 17 clips técnicos, tres estudios dactilológicos y HOLA provisional adaptado del anterior (6,987,748 bytes). Se usa bajo demanda en Atención para Hola y en `/avatar-lab`. Los clips técnicos no se asocian con expresiones LSB.

Los assets base y la salida del avatar son CC0 según la licencia de MakeHuman/MPFB.
El código de MPFB (GPL) y MakeHuman (AGPL) no se redistribuye en este repositorio.

El clip `HOLA` es propio y **provisional**: se basa en la referencia del Módulo 1
de LSB (página 56), pero no ha sido validado por una persona competente en LSB.
El visor solo carga el GLB después de que el usuario lo solicite para «Hola»; no
se carga automáticamente al entrar a la atención. El GLB embebe sus texturas;
el `.blend` conserva referencias a texturas locales de MPFB y no es autónomo.

El manifiesto actual, la fuente y los informes de QA se conservan en
[`apps/web/assets/avatars/signalink-avatar-v5/`](../../assets/avatars/signalink-avatar-v5/).
La revisión y límites lingüísticos están en
[`docs/research/avatar-v5.md`](../../../../docs/research/avatar-v5.md).
