---
name: sign-response-content
description: Curate Spanish service responses and their approved LSB video or visual equivalents with provenance and safe fallbacks.
---

# Contenido de respuestas en LSB

## Objetivo y activación

Usa esta guía cuando se incorporen respuestas frecuentes, videos, glosas o recursos visuales para el flujo Español → LSB. Cada recurso debe corresponder a una intención y contexto revisados; una búsqueda literal no demuestra equivalencia lingüística.

## Entradas necesarias

- Texto de respuesta y situación de atención en la que se usará.
- Recurso audiovisual con licencia y procedencia verificables.
- Revisión de equivalencia por persona competente en LSB.
- Identificador estable, variante, fecha de validación y condiciones de uso.

## Procedimiento

1. Escribe la intención comunicativa y el contexto; limita respuestas a situaciones comprensibles y útiles del MVP.
2. Solicita una formulación LSB validada para esa intención. No generes automáticamente glosas a partir del español para publicar.
3. Asigna un identificador, texto en español, etiqueta interna, idioma o variante, recurso, licencia, procedencia y estado de revisión.
4. Revisa claridad, encuadre, visibilidad de manos y rostro, duración, subtítulos o texto auxiliar y controles de reproducción.
5. Versiona el recurso y conserva un historial de cambios de texto, video y revisión.
6. Si no hay recurso validado, muestra con claridad que no existe una respuesta visual equivalente y permite reformular, escribir o pedir apoyo humano.
7. Verifica que el catálogo no exponga recursos retirados, pendientes o incompatibles con la región seleccionada.

## Restricciones

- No generes avatares que aparenten producir LSB validada.
- No etiquetes una respuesta como traducción exacta si solo existe una aproximación.
- No publiques videos sin autorización de las personas que aparecen y derechos del material.
- No sustituyas una expresión completa por una seña suelta sin contexto.
- No ocultes la fecha, variante o estado de validación al equipo que mantiene el catálogo.

## Resultados esperados

- Catálogo versionado de respuestas y recursos aprobados.
- Ficha de procedencia, licencia y validación por elemento.
- Recurso accesible con controles para pausar, repetir y ajustar velocidad cuando proceda.
- Mensaje alternativo para respuestas sin equivalencia disponible.

## Verificación

- Cada elemento tiene una revisión vigente para el contexto donde aparece.
- El recurso puede redistribuirse según su licencia y consentimiento.
- El texto y el video expresan la misma intención aprobada.
- La falta de coincidencia no produce una traducción inventada.
- Los recursos se pueden retirar sin borrar el historial de cambios.

## Ejemplo

Si el catálogo no contiene una respuesta LSB aprobada para una pregunta, la interfaz avisa que no hay video equivalente y permite escribir otra respuesta o pedir apoyo. No selecciona una seña parecida por coincidencia de palabras.

## Scripts asociados

No hay generador automático de videos o equivalencias. Una vez definido el esquema del catálogo, puede añadirse una validación de campos, licencia y estado de aprobación; la equivalencia lingüística seguirá requiriendo revisión humana.

## Fuentes y fundamentos

- Reglas de aprobación y variantes en .agents/skills/lsb-linguistic-validation/SKILL.md.
- Requisitos de contenido bidireccional en README.md.
- WCAG 2.2 para controles multimedia: https://www.w3.org/TR/WCAG22/
