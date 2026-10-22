---
name: accessible-service-ux
description: Design and review accessible, privacy-conscious in-person service flows for Deaf LSB users and public-facing staff.
---

# UX accesible para atención al público

## Objetivo y activación

Activa esta guía al diseñar pantallas, estados o pruebas de la sesión de atención. La aplicación facilita un intercambio delimitado; no sustituye a intérpretes profesionales ni debe presentar una predicción como traducción garantizada.

## Entradas necesarias

- Escenario concreto de trámite y actores que participan.
- Requisitos y tareas priorizadas en docs/product.
- Revisión con personas sordas usuarias de LSB y personal de atención.
- Estados de cámara, reconocimiento, confirmación, respuesta y error.

## Procedimiento

1. Dibuja el flujo completo desde iniciar una sesión hasta cerrar y descartar los datos temporales.
2. Para cada paso identifica quién actúa, qué información ve, qué puede confirmar o corregir y cómo puede continuar si falla el reconocimiento.
3. Explica con lenguaje claro cuándo se usa la cámara, qué se procesa y si algo se conserva.
4. Ofrece vista previa y controles explícitos para iniciar, pausar y detener captura. No actives la cámara sin una acción comprensible.
5. Muestra interpretaciones como sugerencias editables. Permite confirmar, corregir, descartar o pasar a comunicación manual.
6. Diseña estados visibles para permisos denegados, modelo no disponible, salida incierta, conexión interrumpida y contenido LSB inexistente.
7. Revisa navegación por teclado, foco, contraste, escala de texto, etiquetas de controles y alternativas para contenido multimedia siguiendo WCAG 2.2 AA como objetivo.
8. Prueba prototipos con usuarios representativos, consentimiento informado y tareas reales pero seguras. Registra problemas sin atribuirlos a la persona participante.
9. Corrige los bloqueos de comprensión y acceso antes de ampliar funciones.

## Restricciones

- No diseñes solo para personal oyente ni uses la cámara como requisito para toda interacción.
- No ocultes incertidumbre detrás de colores, porcentajes o animaciones sin significado claro.
- No captures ni guardes video por defecto.
- No trates un verificador automático de accesibilidad como sustituto de pruebas con usuarios.
- No uses texto pequeño, tiempo límite breve o audio como única forma de recibir información.

## Resultados esperados

- Flujo de atención con estados y alternativas.
- Criterios de aceptación de accesibilidad por historia.
- Hallazgos de pruebas priorizados por impacto y evidencia.
- Decisiones de privacidad entendibles durante el uso.

## Verificación

- Una persona puede pausar y finalizar la sesión sin ayuda técnica.
- La interpretación propuesta se puede revisar y descartar.
- Cada error incluye una alternativa para continuar.
- Las tareas principales funcionan con teclado y ampliación de texto.
- Las decisiones de diseño se revisaron con usuarios representativos.

## Ejemplo

Si se deniega el permiso de cámara, la pantalla explica cómo habilitarlo y permite seguir mediante texto. La sesión no se bloquea ni repite la solicitud sin una acción de la persona.

## Scripts asociados

Los analizadores automáticos pueden detectar algunos problemas de interfaz cuando se implemente la aplicación, pero las pruebas con personas usuarias siguen siendo obligatorias. No hay scripts de UI mientras el frontend no exista.

## Fuentes y fundamentos

- W3C, Web Content Accessibility Guidelines (WCAG) 2.2: https://www.w3.org/TR/WCAG22/
- Objetivos de privacidad y accesibilidad de README.md.
- Revisión lingüística en skill/lsb-linguistic-validation/SKILL.md.
