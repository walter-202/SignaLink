---
name: architecture-guard
description: Review changes against the repository's feature-first modular monolith, dependency boundaries, contracts, and privacy requirements.
---

# Control de arquitectura

## Objetivo y activación

Activa esta guía al crear una feature, paquete, integración, contrato o cambio que atraviese varios módulos. El objetivo es mantener límites legibles mientras el producto crece, sin añadir capas que no resuelvan una necesidad concreta.

## Estructura y dependencias

- apps/web contiene la aplicación, composición de dependencias, UI y features.
- packages contiene contratos y runtime reutilizable sin depender de pantallas.
- model-lab contiene investigación, preparación de datos y experimentos; no es parte del runtime de atención.
- models/registry contiene manifiestos aprobados, no necesariamente pesos de modelos.
- docs conserva requisitos, contratos, decisiones e investigación.
- supabase/migrations conserva cambios de esquema revisables.

Dentro de una feature compleja, separa dominio, aplicación y puertos, infraestructura, presentación y pruebas según la necesidad. El dominio no depende de frameworks; infraestructura implementa puertos; presentación llama a casos de uso. Las dependencias entre features pasan por su interfaz pública.

## Procedimiento

1. Identifica qué comportamiento cambia y cuál es el módulo dueño.
2. Reutiliza contratos existentes antes de añadir otro tipo equivalente.
3. Coloca cada archivo según su responsabilidad y limita exports públicos a lo que otros módulos necesitan.
4. Si se incorpora un modelo o servicio externo, define un puerto estable y un adaptador sustituible.
5. Mantén UI, consultas de datos e inferencia separadas.
6. Revisa imports profundos entre features, dependencias circulares, duplicación de reglas y secretos o datos sensibles.
7. Para cambios transversales o decisiones costosas de revertir, registra una ADR en docs/architecture/adr con contexto, opciones, decisión y consecuencias.
8. Actualiza contratos y requisitos afectados y verifica el flujo completo de la feature.

## Restricciones

- No extraigas un paquete compartido solo para evitar una pequeña duplicación local.
- No introduzcas microservicios ni una abstracción sin una necesidad observable.
- No permitas que el navegador acceda directamente a tablas o secretos administrativos.
- No mezcles herramientas de entrenamiento con código de inferencia de producción.
- No guardes grabaciones, datasets privados ni pesos grandes en Git.

## Resultados esperados

- Cambios ubicados en módulos con responsabilidad clara.
- Contratos públicos documentados y con pruebas apropiadas.
- ADR cuando la decisión sea transversal o difícil de revertir.
- Mapa actualizado de dependencias para cambios de alcance amplio.

## Verificación

- Dominio y casos de uso pueden probarse sin navegador ni backend real.
- La feature puede usar un mock o adaptador alternativo.
- No hay ciclos ni imports a internals de otra feature.
- Los cambios de persistencia tienen migración y revisión de seguridad.
- La estructura sigue siendo proporcional a la complejidad real.

## Ejemplo

Una integración ONNX implementa el puerto de reconocimiento en infraestructura; los casos de uso reciben solo el contrato común y la pantalla no importa ONNX Runtime.

## Scripts asociados

No hay una regla automatizada de arquitectura configurada todavía. Cuando existan alias y límites estables, puede añadirse una comprobación de imports para detectar ciclos y dependencias entre internals de features.

## Fuentes y fundamentos

- Principios Screaming Architecture, Feature-First, Clean Architecture, Ports & Adapters y Modular Monolith definidos en README.md.
- Contratos de modelos en skill/sign-model-adapter/SKILL.md.
- Decisiones vigentes en docs/architecture/adr.
