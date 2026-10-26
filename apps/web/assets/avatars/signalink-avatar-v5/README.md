# SignaLink Avatar V5

Esta carpeta conserva el código procedimental, las texturas fuente y los
informes del kit V5 recibido. El GLB se publica aparte en
`apps/web/public/avatars/signalink_avatar_v5_refined.glb` para que la app no
descargue los insumos de construcción.

La revisión actual V5.1 tiene 43 articulaciones, un skin, 17 clips técnicos, tres estudios dactilológicos y
HOLA provisional adaptado del avatar propio anterior. Consulta el hash y tamaño
actuales en `qa/model_manifest.json`. El manifiesto original del kit se conserva
en `qa/kit-v5-manifest.json`; `audit_v5.json` y las métricas V4/V5 son históricos.
Los informes `khronos-v5.1.json` y `deformation-v5.1.json` corresponden al archivo
actual. Ninguna prueba geométrica valida el contenido como LSB.

Para regenerar desde `source/`:

```sh
python -m pip install -r requirements.txt
python build_signalink_avatar_v5.py --output ../../../../public/avatars/signalink_avatar_v5_refined.glb --resolution .0095
python audit_signalink_glb_v4.py ../../../../public/avatars/signalink_avatar_v5_refined.glb --json ../qa/audit_v5.1.json
```

La construcción es procedimental y depende de `build_signalink_avatar_v3.py` y
los dos atlas incluidos. `import_to_blender.py` permite abrir el GLB en Blender;
el kit no incluye un `.blend` retopologizado para V5.

La construcción V5.1 reutiliza el HOLA propio en
`apps/web/public/avatars/signalink_avatar.glb` mediante `retarget_hola.py`.
Después de regenerar, mueve el `.manifest.json` producido a `qa/model_manifest.json`.
Para repetir la prueba de deformación:

```sh
python qa_refinement.py ../../../../public/avatars/signalink_avatar_v5_refined.glb --json ../qa/deformation-v5.1.json
```
