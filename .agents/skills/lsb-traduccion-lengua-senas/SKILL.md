---
name: lsb-traduccion-lengua-senas
description: >-
  Índice de trabajo para el corpus y las funciones de reconocimiento o traducción de Lengua de Señas Boliviana.
  Úsalo para localizar procedimientos, distinguir tareas de IA y consultar el estado de las referencias disponibles.
---

# Índice de trabajo para LSB

Esta skill dirige al equipo a la guía especializada de corpus en
[`.agents/skills/lsb-corpus-entrenamiento/SKILL.md`](../lsb-corpus-entrenamiento/SKILL.md).
No es una gramática normativa ni un corpus lingüístico aprobado. Las notas
heredadas de la rama Apaza se mantienen como material provisional hasta que una
persona competente en LSB las contraste con las fuentes y documente su revisión.

## Distingue las tareas

- **ISLR:** clasificación de una seña aislada.
- **CSLR:** reconocimiento de una secuencia continua de señas, normalmente a
  glosas.
- **Gloss-to-Text:** generación de español a partir de glosas revisadas.
- **SLT:** traducción de lengua de señas a texto; puede incluir reconocimiento,
  información no manual y generación de texto.

No presentes una métrica de reconocimiento como evidencia de traducción completa.
En el producto, los resultados del modelo son candidatos que una persona puede
revisar y corregir.

## Estado de las referencias

Las fichas del Ministerio de Educación enlazadas en
[`references/README.md`](../lsb-corpus-entrenamiento/references/README.md)
identifican los cuatro módulos de enseñanza. La ficha consultada no declara una
licencia de redistribución; por ello, el vocabulario extraído no se incluye en
este repositorio. El informe también registra los defectos encontrados en la
extracción de Apaza y las condiciones pendientes para reconsiderarla.

Consulta las notas de gramática, parámetros formacionales, ejemplos y scripts
desde la guía especializada. Las notas no deben convertirse en reglas del
producto o etiquetas de entrenamiento sin una fuente precisa y revisión
lingüística.
