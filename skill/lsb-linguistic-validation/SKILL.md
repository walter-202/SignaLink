---
name: lsb-linguistic-validation
description: Validate LSB glosses, lexical variants, grammar, non-manual markers, and sign-language content with qualified reviewers.
---

# Validación lingüística de LSB

## Objetivo y activación

Activa esta guía cuando se propongan etiquetas, glosas, equivalencias al español, instrucciones de grabación o respuestas visuales en LSB. Su propósito es que el software represente decisiones lingüísticas revisables, sin presentar una glosa como traducción completa.

## Entradas necesarias

- Material original con procedencia: módulo, página, video o registro autorizado.
- Contexto de la seña o expresión y significado que se desea comunicar.
- Región, variante y audiencia previstas.
- Revisión de una persona sorda usuaria de LSB o especialista lingüístico competente, identificada en el registro sin exponer datos personales públicamente.

## Procedimiento

1. Mantén separados el texto en español, la glosa de trabajo, la descripción articulatoria y la interpretación del enunciado.
2. Registra si la evidencia corresponde a una seña aislada, una expresión fija, una oración o un discurso. No extrapoles una etiqueta aislada a reconocimiento continuo.
3. Pide a la persona revisora que confirme forma, significado, contexto, variantes regionales, lateralidad y rasgos no manuales pertinentes.
4. Guarda fuente, fecha, versión del material, revisor autorizado, decisión y observaciones. Usa estados explícitos: propuesta, pendiente, validada, rechazada o requiere nueva consulta.
5. Si hay desacuerdo, conserva ambas propuestas con contexto y detén su uso en contenido de cara al público hasta resolverlo.
6. Revisa de nuevo cuando cambien el guion de grabación, la glosa, la región objetivo o la función donde se presenta el contenido.
7. Entrega al equipo técnico un identificador estable y el conjunto de variantes aceptadas; nunca solo una cadena libre sin procedencia.

## Restricciones

- No atribuyas al Ministerio una forma o regla que no esté respaldada por una fuente identificable.
- No normalices variantes como errores ni declares una única forma universal sin evidencia.
- No conviertas el orden de glosas directamente en una oración española.
- No solicites a una persona oyente que certifique por sí sola la corrección de LSB.
- No uses el reconocimiento automático como evidencia de que una etiqueta sea lingüísticamente correcta.

## Resultados esperados

- Registro de validación con identificador, evidencia, variante, estado y responsable de revisión.
- Glosario versionado con definiciones y notas de uso.
- Lista de decisiones pendientes y preguntas para la siguiente revisión.
- Requisitos lingüísticos comunicados a diseño, contenido y reconocimiento.

## Verificación

- Se distingue claramente glosa de traducción.
- Toda afirmación lingüística apunta a una fuente o una consulta registrada.
- El estado de aprobación puede entenderse sin revisar mensajes informales.
- Los desacuerdos y variantes no desaparecen al exportar etiquetas.
- Una interfaz solo consume expresiones cuyo contenido se encuentre aprobado para ese uso.

## Ejemplo

Una ficha de muestra puede indicar que una etiqueta es propuesta, asociarla a una fuente y página, registrar dos variantes regionales y dejar pendiente el rasgo facial hasta la revisión. El modelo no debe presentar esa ficha como traducción validada mientras su estado siga pendiente.

## Scripts asociados

No se automatiza la aprobación lingüística. Cuando exista un esquema de glosario estable, un validador podrá comprobar campos obligatorios y estados permitidos, pero no decidir si una seña es correcta.

## Fuentes y fundamentos

- Materiales oficiales de enseñanza de LSB citados en README.md; registra módulo, edición y página concreta en cada decisión.
- Consulta y revisión por personas usuarias de LSB con consentimiento y compensación acordes al protocolo del proyecto.
- skill/lsb-corpus-entrenamiento/SKILL.md y skill/sign-response-content/SKILL.md.
