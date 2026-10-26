# Avatar V5.1: rostro, rig y movimiento del catálogo

El archivo `signalink_avatar_v5_refined.glb` ahora es la revisión V5.1:
6,975,884 bytes, SHA-256
`af0830c672b2640c90955ba4c7f11dd0f19c063e4eac605914d2180faca3e621`.
Conserva un skin y 43 articulaciones; contiene 17 pruebas técnicas y `HOLA`
provisional adaptado desde el avatar propio anterior.

## Correcciones

- El rostro deja de proyectar una ilustración con pelo y orejas sobre una esfera.
  Cráneo, nariz, ojos, cejas, boca y cabello usan geometría y siguen Head.
- Cabello continuo y unión cuello/cabeza más limpia durante el giro.
- Los pivotes de dedos coinciden con su eje geométrico. Los pesos se mezclan
  dentro de cada dedo; la palma deja de influir sobre todas las falanges.
- Las pruebas faciales actúan sobre los elementos visibles: cierre de ojos,
  cejas y boca, además de la piel. Son controles técnicos limitados.
- `HOLA` transfiere direcciones de articulaciones y marcos de palma de la
  animación propia anterior; no copia quaterniones entre rigs incompatibles.
- `/avatar-lab` permite pausar en un tiempo exacto y reiniciar de verdad.
- Atención usa V5.1 bajo demanda para `HOLA`; las otras expresiones sin clip
  conservan su estado de no disponibilidad y el texto visible.

## Evidencia

`qa/khronos-v5.1.json`: validador oficial Khronos glTF Validator,
0 errores, 0 advertencias y 2 avisos informativos por materiales sin uso.
`qa/deformation-v5.1.json`: 189 poses muestreadas en 21 clips, coordenadas
finitas/acotadas; cabeza y ambas manos cerradas y de winding consistente.
Esta prueba CPU evalúa skinning, no las deformaciones de morph targets.

E2E local con Chromium/WebGL: carga del GLB y clips, reproducción/pausa,
inspección de giro de cabeza, puño, muñeca, parpadeo y HOLA.
La prueba autenticada intentó iniciar sesión con la cuenta facilitada y quedó
bloqueada en la petición de Auth por `ERR_TUNNEL_CONNECTION_FAILED`. No se
modificaron permisos ni se guardaron credenciales.

## Límites lingüísticos

El catálogo cita el Módulo 1, pero no conserva los videos de referencia.
La adaptación de HOLA mantiene la intención del clip provisional; no constituye
una corrección lingüística contrastada ni una seña LSB validada. Para revisar
configuración, orientación, ubicación, trayectoria, contacto y componentes no
manuales necesitamos una ejecución LSB de referencia y revisión competente.
Los otros 18 saludos aún no tienen clips disponibles. No se asignan pruebas
`DEMO_*` a sus etiquetas.

El ONNX de referencia (7,206,466 bytes) tiene entrada `[1,30,138]` y salida
`[1,58]`, verificadas cargando el archivo con ONNX Runtime. Es un clasificador:
no contiene un diccionario de animaciones ni genera poses 3D. Puede apoyar
el análisis de capturas, pero no certificar las animaciones del avatar.

Ruta recomendada: referencia autorizada LSB → landmarks originales 3D de manos,
pose y rostro → adaptación al rig/IK y corrección de contactos → revisión LSB →
clip identificado exactamente en el catálogo. Las 138 características del
clasificador no bastan para reconstruir todas las articulaciones y la cara.

## Revisión adicional del proyecto Villca (26-10-2026)

La captura de la interfaz y su lámina coinciden con
[`imagenes/abecedario.png`](https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/50ea19478709fcbb9f9ac4584f4d27ed59329c4f/imagenes/abecedario.png).
La lámina es una referencia visual de dactilología y números, no contiene los
saludos; algunas letras muestran flechas y requieren movimiento. La imagen sola
no aporta profundidad, cronología completa, ni expresa licencia o procedencia
individual de las fotografías. No se redistribuye en SignaLink.

El [README upstream](https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/50ea19478709fcbb9f9ac4584f4d27ed59329c4f/README.md)
declara 5.800 secuencias, 58 clases y gestos estáticos y dinámicos. El
[notebook de captura](https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/50ea19478709fcbb9f9ac4584f4d27ed59329c4f/utils/Recolecion_Secuencias_datos.ipynb)
muestra extracción de 138 características por fotograma y guardado Zarr/NumPy.
El árbol revisado incluye el notebook y los modelos, pero no los archivos Zarr,
las grabaciones originales ni clips de ejecución de saludos. No consta que se
conserven videos; el notebook mostrado guarda características procesadas.

El [código de clases](https://github.com/freddxvill/Proyecto_Traductor_de_la_LSB/blob/50ea19478709fcbb9f9ac4584f4d27ed59329c4f/clases.py)
asigna `HOLA=39`, `BUENOS DIAS=40`, `GRACIAS=41`, `POR FAVOR=42` y `NOMBRE=50`.
Esas salidas son etiquetas de reconocimiento; no contienen la ejecución de
esas señas. Hay discrepancias en la tabla del README: presenta `P` tanto para
27 como para 28, mientras el código asigna `P=27` y `Q=28`; el índice 0 se
escribe `O` en código y `0` en la tabla. Se debe aclarar con el autor antes de
considerar la clase 0 un número o una letra. La lámina incluye CH y RR, pero
no aparecen como clases separadas en el diccionario del modelo.

Siguiente paso útil: contrastar las posturas dactilológicas de la lámina con
una referencia autorizada y una persona competente en LSB; para saludos se
requieren videos u otro material específico. Solicitar al autor información
sobre el corpus y sus permisos puede ayudar, pero incluso el Zarr procesado no
recupera íntegramente el 3D ni los componentes faciales.

## Estudios de posturas A, B y L

El laboratorio incorpora `QA_DACTILO_A`, `QA_DACTILO_B` y `QA_DACTILO_L`:
posturas manuales aproximadas, interpretadas visualmente a partir de la lámina
del proyecto Villca. Son material de trabajo para inspeccionar dedos y palma,
no animaciones lingüísticamente validadas. No se reproducen como traducciones
en Atención ni están asignadas al catálogo de saludos. Las demás letras y las
que requieren movimiento quedan pendientes de referencia y revisión.

## Refinamiento visual y acceso desde catálogo

La boca sigue la superficie del rostro con una curva continua y el cabello añade
mechones fundidos con la capa base, unidos a la cabeza. El estudio B ajusta el pulgar
hacia la palma; las posturas siguen siendo aproximaciones pendientes de revisión.
El catálogo permite abrir cada estudio A, B o L en una pestaña independiente
y el laboratorio selecciona únicamente identificadores de esa lista permitida.
La sesión de atención queda abierta.

## Selector de clips en Atención

La escena incluye un catálogo con saludos y las tres posturas dactilológicas
provisionales. El selector busca por categoría y reproduce únicamente los
identificadores presentes en el GLB; las expresiones sin clip indican su
indisponibilidad. Explorar la escena no altera el borrador de la respuesta.
Se aclararon los puños del rig para acercarlos a la referencia visual.
Las posturas siguen pendientes de revisión lingüística y no se usan para
formar palabras de manera automática.
