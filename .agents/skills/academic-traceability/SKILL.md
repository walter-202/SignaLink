---
name: academic-traceability
description: Keep project needs, requirements, research claims, implementation, evaluation evidence, and sources linked and reproducible.
---

# Trazabilidad académica

## Objetivo y activación

Usa esta guía al redactar objetivos, requisitos, historias, decisiones, resultados o afirmaciones académicas. Toda afirmación sobre necesidad, funcionamiento o rendimiento debe poder rastrearse a una fuente, una decisión o evidencia identificable.

## Procedimiento

1. Registra las necesidades como N-XX y vincúlalas con OE-XX, RF-XX o RNF-XX, épicas EP-XX, historias HU-XX y criterios de aceptación.
2. Mantén estables los identificadores aprobados. No renumeres artefactos para que parezcan completados.
3. En cada fuente bibliográfica guarda autor u organismo, título, año, versión, URL o ubicación, fecha de consulta y páginas usadas.
4. Separa hechos citados, hipótesis, decisiones de diseño, estimaciones y resultados medidos.
5. Para decisiones técnicas registra alternativas, criterio, evidencia y consecuencias en docs/architecture/adr.
6. Para experimentos conserva versión del modelo y dataset, particiones, configuración, código, semilla, hardware y procedimiento.
7. Vincula cada afirmación de resultado con el artefacto que la demuestra. Si la evidencia falta, marca la afirmación como pendiente o propuesta.
8. Registra limitaciones, cambios de alcance y resultados negativos junto con los resultados favorables.
9. Mantén una matriz sencilla entre requisito, módulo, criterio de aceptación y evidencia de verificación.

## Restricciones

- No cites fuentes que no se hayan consultado ni inventes páginas, resultados o aprobación.
- No describas un prototipo como funcional sin evidencia reproducible.
- No presentes estimaciones CPM/PERT como fechas comprometidas.
- No declares validez clínica, precisión general o traducción universal a partir de una prueba acotada.
- No incluyas datos identificables de participantes en informes públicos.

## Resultados esperados

- Matriz de trazabilidad actualizada en docs/product o docs/academic.
- Bibliografía verificable y decisiones vinculadas a evidencia.
- Fichas de experimentos reproducibles y limitaciones explícitas.
- Estado real del proyecto actualizado con criterios comprobables.

## Verificación

- Cada requisito aprobado tiene origen y criterio de aceptación.
- Cada resultado citado señala versión, método y evidencia.
- Las fuentes se pueden localizar y corresponden a la afirmación.
- Las estimaciones y las mediciones se identifican como tipos distintos.
- La matriz no marca como cumplido un elemento que solo esté planificado.

## Ejemplo

Si se propone reconocer una seña aislada, vincula la necesidad con un requisito y su criterio de aceptación. Mientras el modelo no se evalúe con participantes separados, el estado permanece pendiente y no se afirma precisión general.

## Scripts asociados

No hay un verificador de trazabilidad porque aún no existe un formato estructurado aprobado para requisitos y evidencias. Cuando se defina, un script podrá detectar identificadores o enlaces faltantes, pero no certificar la calidad académica de una fuente.

## Fuentes y fundamentos

- Convenciones EP, HU, RF, RNF, N, OE, ADR y M definidas en README.md.
- Bibliografía del proyecto en README.md y docs/academic.
- Protocolos de evaluación y privacidad en .agents/skills/sign-model-benchmark/SKILL.md y .agents/skills/accessible-service-ux/SKILL.md.
