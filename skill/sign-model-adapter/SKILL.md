---
name: sign-model-adapter
description: Integrate a sign-recognition model through a versioned manifest and an engine-independent application contract.
---

# Adaptador de modelos de señas

## Objetivo y activación

Usa esta guía al integrar o reemplazar un modelo de reconocimiento en la PWA. La interfaz de producto debe hablar con un contrato estable, mientras cada adaptador resuelve el formato, preprocesamiento, motor y decodificación propios del modelo.

## Entradas necesarias

- Archivo del modelo en una ubicación aprobada, licencia y procedencia.
- Manifiesto versionado con identificador, versión, lengua, tipo de tarea, formato, motor, contrato de entrada, preprocesador, decodificador, etiquetas, integridad, homologación y limitaciones.
- Ejemplos de entrada y salida autorizados, además de resultados de referencia cuando existan.
- Capacidad mínima del dispositivo y navegadores objetivo.

## Contrato del adaptador

El adaptador debe exponer operaciones equivalentes a inicializar, reconocer y liberar recursos. Recibe datos normalizados de la captura; devuelve candidatos con identificador de etiqueta, puntuación y estado de incertidumbre. Los detalles de tensores, landmarks y ONNX permanecen en infraestructura.

## Procedimiento

1. Revisa licencia, hashes, archivos requeridos, compatibilidad de formato y estado de aprobación antes de cargar el modelo.
2. Valida el manifiesto y rechaza campos obligatorios ausentes o incompatibles con el runtime.
3. Implementa primero una instancia simulada del contrato para que la experiencia pueda desarrollarse sin un modelo real.
4. Implementa el adaptador en packages/recognition-runtime o en la feature propietaria, según el límite acordado en el diseño.
5. Mantén el preprocesamiento y decodificador versionados junto al adaptador. Evita duplicarlos en componentes React.
6. Devuelve errores diferenciados para permiso de cámara, dispositivo no compatible, carga, inferencia, salida inválida y liberación.
7. Añade fixtures pequeños y no sensibles para verificar entradas, salidas, umbrales y errores del contrato.
8. Compara resultados con el pipeline original cuando esté disponible. Registra tolerancias numéricas y diferencias de navegador.
9. Publica el adaptador en el catálogo solo después de revisar licencia, calidad, benchmark y límites conocidos.

## Restricciones

- No cargues modelos no aprobados ni ejecutes código de procedencia desconocida.
- No hagas que un componente visual importe ONNX, MediaPipe o detalles de tensores.
- No conviertas puntuaciones sin calibrar en porcentajes de confianza.
- No traduzcas una secuencia de etiquetas a español dentro del adaptador.
- No almacenes audio o video de atención como parte de la inferencia normal.
- No descargues pesos grandes al repositorio si existe un almacenamiento aprobado para artefactos.

## Resultados esperados

- Manifiesto y adaptador con versiones explícitas.
- Implementación del contrato y fixtures reproducibles.
- Nota de compatibilidad y limitaciones en docs/architecture/contracts.
- Informe de benchmark vinculado a la misma versión del modelo.

## Verificación

- El adaptador cumple el contrato común y puede sustituirse por el mock.
- Una carga fallida deja la sesión en un estado recuperable.
- La salida inválida no llega a la interfaz como una predicción.
- La liberación de recursos se ejecuta al finalizar o cambiar de modelo.
- El hash del artefacto coincide con el manifiesto.

## Ejemplo

Si ONNX no puede inicializarse en el navegador, el adaptador devuelve un error de capacidad y la aplicación ofrece continuar por texto. No devuelve etiquetas parciales ni guarda el video para intentar procesarlo después.

## Scripts asociados

Los fixtures y pruebas del contrato deben vivir junto al runtime o adaptador que verifican. No hay un validador de manifiestos separado hasta que el esquema versionado se implemente.

## Fuentes y fundamentos

- Contratos y manifiestos descritos en README.md.
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- MediaPipe Tasks Vision: https://ai.google.dev/edge/mediapipe/solutions/guide
- skill/sign-model-benchmark/SKILL.md.
