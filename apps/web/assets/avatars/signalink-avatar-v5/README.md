# SignaLink Avatar V5

Esta carpeta conserva el código procedimental, las texturas fuente y los
informes del kit V5 recibido. El GLB se publica aparte en
`apps/web/public/avatars/signalink_avatar_v5_refined.glb` para que la app no
descargue los insumos de construcción.

El manifiesto declara 6,051,776 bytes, SHA-256
`d188c1678608997e941795c9a09d8eeeae0a619c1710038841cc9a92fbf7ad29`, un skin,
43 articulaciones y 17 clips técnicos. El auditor entregado marca
`REVIEW_REQUIRED`; esos resultados se preservan como evidencia del kit y no
equivalen a certificación oficial ni validación lingüística.

La salida glTF incluye límites `min`/`max` para los cuatro morph targets
faciales; se añadieron al artefacto y al generador después de detectar las
advertencias correspondientes en Three.js.

Para regenerar desde `source/`:

```sh
python -m pip install -r requirements.txt
python build_signalink_avatar_v5.py --output ../../../../public/avatars/signalink_avatar_v5_refined.glb --resolution .0095
python audit_signalink_glb_v4.py ../../../../public/avatars/signalink_avatar_v5_refined.glb --json ../qa/audit_v5.json
```

La construcción es procedimental y depende de `build_signalink_avatar_v3.py` y
los dos atlas incluidos. `import_to_blender.py` permite abrir el GLB en Blender;
el kit no incluye un `.blend` retopologizado para V5.
