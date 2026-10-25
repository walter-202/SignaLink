# Roadmap de reconocimiento para atención pública

## Objetivo verificable

Reducir al menos 50% la mediana y el percentil 95 del tiempo desde el inicio
anotado de una seña hasta su propuesta visible, por equipo y sobre las mismas
muestras. No se ha demostrado todavía ese resultado. Evaluar además F1 macro,
falsos positivos en reposo, abstención, correcciones y tiempo hasta confirmar.
El protocolo inicial está en [rendimiento](../research/recognition-performance.md).

| Etapa | Entrega y criterio de cierre | Estado |
| --- | --- | --- |
| 1. Medición y captura | Diagnóstico local acotado, captura durante una inferencia pendiente, cancelación y prueba del ONNX real en WASM | Implementada: `e0f7346` |
| 2. Modelos intercambiables | Registro versionado; contratos comprobados; clasificación, preprocesamiento y política de incertidumbre inyectados; cambio de modelo sin mezclar capturas | Infraestructura implementada y verificada con pruebas de contrato, selección, ONNX real en Chromium y build; solo v4 está instalado |
| 3. Landmarks y arranque | Perfil de MediaPipe en equipo real; prototipo Worker con fallback; artefacto Holistic fijado por versión/hash y carga/caché medibles | En curso: Worker optativo, carga verificada, caché y diagnóstico implementados; faltan provisionar el Holistic real revisado y benchmark con señas |
| 4. Corpus y evaluación | 12–20 intenciones administrativas con expresiones LSB validadas; material autorizado; participantes separados entre entrenamiento/evaluación; anotaciones temporales | Pendiente de colaboración lingüística y muestras autorizadas |
| 5. Modelo ligero y piloto | Comparar TCN, GRU y Conv1D+GRU; exportar ONNX; cuantizar solo si mejora velocidad/calidad; piloto supervisado y respuestas visuales validadas | Depende de la etapa 4 |

Ya se puede [comparar baseline/Worker desde Ajustes](../research/recognition-comparison.md)
sin reiniciar Next y medir la fluidez separadamente. El comparador local comprueba
contratos técnicos de los JSON v4; no sustituye el benchmark con corpus. Se incluye
un protocolo preparatorio en `model-lab/configs/public-service-benchmark.yaml`,
sin datos, artefactos reales ni un runner lingüístico instalados.

La recopilación y validación lingüística pueden avanzar mientras se optimiza el
runtime. No sustituir LSB por pesos LSA ni tratar frases como concatenaciones
lingüísticas de etiquetas. SignBart y las referencias de LSCh son candidatos de
investigación, no modelos de producto instalados.

## Etapa actual: landmarks

El prototipo y sus límites se describen en
[Worker de landmarks](../research/landmark-worker.md). Está desactivado por
defecto: no se promueve solo por pasar pruebas de transporte.
La [preparación local, verificación y caché de Holistic](../research/holistic-assets.md)
permite completar la provisión sin cambiar el contrato LSB. El archivo real y su
hash revisado aún no están presentes en el workspace.

1. Medir carga fría/caliente, FPS efectivos, p50/p95 de `landmarkMs`, intervalos de
   fotogramas, memoria y respuesta de la interfaz en escritorio de oficina.
2. Conservar la extracción `lsb-v4-138-v1`. No sustituir Holistic por otro conjunto
   de landmarks sin demostrar compatibilidad con los pesos existentes.
3. Probar procesamiento en Worker con una sola imagen en tránsito y descarte
   explícito de trabajo atrasado. Transferir recursos sin copiar video a colas
   crecientes; cerrar ImageBitmap/frames y liberar el detector al detener.
4. Comparar con el baseline sobre las mismas muestras. Un Worker puede mejorar
   respuesta de la interfaz sin reducir a la mitad el tiempo de MediaPipe.
5. Fijar versión y SHA-256 del artefacto Holistic con alojamiento controlado.
   Comprobar integridad, caché, cancelación, errores y fallback del navegador.
6. Promover solo con evidencia de rendimiento y calidad; mantener la escritura,
   revisión humana y asistencia alternativa disponibles.

## Entorno y evidencia

Se reutilizan este workspace, dependencias, Chromium y el servidor Next del puerto
3100. No se requieren contenedores, otro checkout, otro navegador ni copias de pesos.

El smoke test local anterior del clasificador v4 registró una mediana caliente de
7,3 ms en cinco ejecuciones de un tensor sintético; no incluyó MediaPipe ni señas
reales y no establece una mejora global. La prioridad del siguiente ciclo es medir
los otros componentes, sin atribuir todo el tiempo al tamaño del ONNX.

Los pesos actuales conservan su estado experimental. Ni una prueba E2E con datos
sintéticos ni habilitar un adaptador equivale a validación lingüística o aprobación
institucional. La promoción propuesta exige la reducción de latencia acordada,
caída de F1 macro ≤1 punto porcentual y falsos positivos sin aumento, con tamaño
e incertidumbre de la muestra declarados antes de evaluar.
