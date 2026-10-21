---
name: lsb-traduccion-lengua-senas
description: >-
  Corpus lingüístico oficial, parámetros formacionales y reglas morfosintácticas de la Lengua de Señas Boliviana (LSB)
  basados en los 4 módulos de enseñanza del Ministerio de Educación de Bolivia (Decreto Supremo Nº 0328).
  Usa esta skill cuando el usuario desarrolle o consulte sobre proyectos de reconocimiento y traducción de
  Lengua de Señas Boliviana a texto (o viceversa), incluyendo extracción de vocabulario oficial (1300+ señas),
  gramática espacial, clasificadores (CL), marcadores no manuales, notación de flechas/símbolos y diseño
  de pipelines de Inteligencia Artificial (CSLR, Gloss2Text, MediaPipe, Seq2Seq y LLMs).
---

# Lengua de Señas Boliviana (LSB) - Traducción de Señas a Texto

Esta skill proporciona el conocimiento lingüístico, el vocabulario oficial categorizado y las pautas técnicas necesarias para construir o refinar sistemas de **Reconocimiento Continuo de Señas (CSLR)** y **Traducción de Lengua de Señas a Texto (SLT)** basados en el corpus oficial del Ministerio de Educación del Estado Plurinacional de Bolivia.

---

## 1. Visión General del Corpus y Fuentes

El conocimiento de esta skill proviene de los 4 módulos oficiales aprobados bajo el **Decreto Supremo Nº 0328**:

| Módulo | Nivel | Señas Catalogadas | Categorías Clave | Archivo PDF Fuente |
|:---|:---|:---:|:---|:---|
| **Módulo 1** | Básico 1 | 270 | Saludos, Familia, Cuerpo, Alimentos, Lugares, Colores, Números, Dactilología | `CURSO-DE-ENSENANZA-DE-LA-LENGUA-DE-SENAS-BOLIVIANA-Modulo-1.pdf` |
| **Módulo 2** | Básico 2 | 298 | Opuestos, Verbos II, Geografía, Ropa, Oficios, Salud, Departamentos de Bolivia | `Curso-de-ensenanza-de-la-LSB-MODULO-2.pdf` |
| **Módulo 3** | Intermedio | 340 | Diálogo, Política, Salud, Verbos III, Deportes, Hogar, Educación, Expresiones | `Modulos-de-ensenanza-de-la-LSB-MODULO-3.pdf` |
| **Módulo 4** | Avanzado | 408 | Clasificadores (CL), Verbos IV (direccionales), Términos médicos, Estilos discursivos | `Curso-de-ensenanza--LSB-Mod-4.pdf` |

* **Total Vocabulario Extraído:** 1,316 señas oficiales indexadas.
* **Diccionario completo en JSON:** [vocabulario_lsb.json](./references/vocabulario_lsb.json)
* **Diccionario completo en Markdown:** [vocabulario_lsb.md](./references/vocabulario_lsb.md)

---

## 2. Reglas Gramaticales Clave para Traducción (LSB $\to$ Español)

Al traducir de glosas LSB a texto fluido en español, el agente y los modelos deben aplicar sistemáticamente las siguientes transformaciones estructurales (para el detalle técnico completo, consulta [gramatica_y_morfosintaxis_lsb.md](./references/gramatica_y_morfosintaxis_lsb.md)):

### 2.1 Reordenamiento Sintáctico (SVO vs. T-S-O-V / Tópico-Comentario)
- **Regla:** En LSB, el tiempo se ubica al inicio y el orden usual es Objeto antes del Verbo (SOV o Tópico-Comentario OSV). En español, debe reordenarse a **Sujeto - Verbo - Objeto (SVO)**.
- **Ejemplo:**
  - Glosa: `[AYER]` `[MAMÁ]` `[PAN]` `[COMPRAR]`
  - Español: *"Ayer mi mamá compró pan."*

### 2.2 Inserción de Artículos y Preposiciones (Infilling)
- **Regla:** La LSB no tiene señas para artículos (*el, la, los, las, un, una*) ni preposiciones (*a, de, en, con*); estas vienen implícitas en el espacio o en el verbo. El traductor debe insertarlas según la concordancia del español.
- **Ejemplo:**
  - Glosa: `[MAÑANA]` `[YO]` `[LA-PAZ]` `[VIAJAR]`
  - Español: *"Mañana viajaré a La Paz."*

### 2.3 Inserción de Cópulas (*Ser* / *Estar*)
- **Regla:** En oraciones atributivas, la LSB yuxtapone el sujeto y el adjetivo/profesión sin verbo cópula.
- **Ejemplo:**
  - Glosa: `[HERMANO]` `[MÍO]` `[MÉDICO]`
  - Español: *"Mi hermano es médico."*
  - Glosa: `[YO]` `[TRISTE]`
  - Español: *"Estoy triste."*

### 2.4 Flexión de Tiempos Verbales
- **Regla:** Los verbos en LSB no se conjugan morfológicamente por tiempo. El tiempo lo fija el adverbio temporal inicial:
  - Si incluye `AYER`, `PASADO`, `ANTES` $\to$ Conjugar el verbo en **Pretérito**.
  - Si incluye `MAÑANA`, `FUTURO`, `PRÓXIMO` $\to$ Conjugar el verbo en **Futuro**.
  - Si no hay marcador temporal $\to$ Presente o determinado por el contexto.

### 2.5 Verbos Direccionales y de Concordancia
- **Regla:** Verbos como `DAR`, `ENSEÑAR`, `DECIR`, `PRESTAR` cambian su dirección en el espacio para indicar quién es el sujeto y quién es el objeto.
  - Origen en señante $\to$ Destino en interlocutor = *"Yo te doy"* (`1S-DAR-2S`).
  - Origen en interlocutor $\to$ Destino en señante = *"Tú me das"* (`2S-DAR-1S`).

### 2.6 Clasificadores Espaciales (CL)
- **Regla:** Los clasificadores (`CL:1`, `CL:3`, `CL:C`, etc.) describen acciones visuales completas. Deben traducirse como verbos dinámicos y complementos circunstanciales de modo o lugar.
  - Glosa: `[AUTO]` `[CL:vehículo_velocidad]` `[PERSONA]` `[CL:chocar]`
  - Español: *"Un auto iba a alta velocidad y atropelló a una persona."*

### 2.7 Marcadores No Manuales (Rostro y Cabeza)
- **Pregunta Qu- (Qué, Dónde, Cuándo, Quién):** Ceño fruncido + seña interrogativa usualmente al final $\to$ Formular como pregunta con pronombre interrogativo al inicio (`¿Dónde está...?`).
- **Pregunta Sí/No:** Cejas levantadas y cabeza adelantada $\to$ Formular como pregunta (`¿Quieres agua?`).
- **Negación:** Cabeza negando de lado a lado $\to$ Insertar *"no"* antes del verbo principal (`No puedo ir`).

---

## 3. Notación Visual y Parámetros Formacionales (Queremas)

Para la etapa de visión y procesamiento de landmarks (MediaPipe / Video):
- **Parámetros Formacionales:**
  - **Queirema:** Forma de la mano (configuración manual).
  - **Toponema:** Lugar de articulación anatómica (frente, mejilla, pecho, mano base).
  - **Kinema / Kineprosema:** Tipo y dirección del trayecto (recto, curvo, ondulante, circular).
  - **Queirotropema:** Orientación de la palma (hacia adentro, afuera, arriba, abajo).
  - **Prosoponema:** Expresión facial y postura corporal.
- **Símbolos Oficiales del Ministerio:**
  - Consulta la tabla completa de flechas (lenta, reiterativa, simultánea) y símbolos motores (mano pasiva, contraer/expandir dedos, roce, contacto, tijera, chasquido, vibración) en [parametros_formacionales_y_simbologia.md](./references/parametros_formacionales_y_simbologia.md).

---

## 4. Pipeline Técnico de Inteligencia Artificial para Traducción

Para implementar el sistema de software de traducción, la arquitectura recomendada es de dos etapas:

```
[Cámara / Video]
       │
       ▼
[MediaPipe Holistic / Pose + Hands + FaceMesh]
       │
       ▼
[Modelo CSLR: Continuous Sign Language Recognition]  <-- Entrenado con 1316 clases del corpus LSB
       │
       ▼ (Secuencia de Glosas LSB + Rasgos Faciales)
[Módulo Gloss2Text: Seq2Seq / T5 / mBART / LLM]      <-- Aplica reglas gramaticales LSB -> Español
       │
       ▼
[Texto Fluido en Español Estándar]
```

Revisa la guía técnica completa, métricas de evaluación (BLEU, ROUGE, METEOR, chrF++) y formatos de dataset en:
- [pipeline_traduccion_lsb_a_texto.md](./references/pipeline_traduccion_lsb_a_texto.md)
- [esquema_anotacion_elan.json](./examples/esquema_anotacion_elan.json)
- [ejemplos_traduccion_glosa_a_espanol.json](./examples/ejemplos_traduccion_glosa_a_espanol.json)

---

## 5. Scripts y Herramientas Incluidas

La skill incluye utilidades en Python listas para usar en la carpeta `scripts/`:

### 5.1 Buscar Señas Oficiales en el Corpus
Permite buscar cualquier palabra o glosa en los 4 módulos:
```bash
python scripts/buscar_seña.py "comer"
python scripts/buscar_seña.py -c "Saludos"
python scripts/buscar_seña.py -m 1
```

### 5.2 Traductor y Generador de Prompts Glosa $\to$ Español
Traduce secuencias de glosas aplicando reglas morfosintácticas o genera prompts para LLM:
```bash
# Traducción basada en reglas
python scripts/traductor_glosa_a_texto.py AYER MAMA PAN COMPRAR

# Traducción con rasgos no manuales
python scripts/traductor_glosa_a_texto.py TU CASA IR -r cejas_levantadas

# Generar prompt especializado para LLM (Few-Shot con reglas LSB)
python scripts/traductor_glosa_a_texto.py TU NOMBRE QUE -r ceño_fruncido --prompt
```

### 5.3 Extractor y Actualizador de Corpus
Re-extrae y sincroniza el vocabulario a partir de los PDFs fuente:
```bash
python scripts/extraer_corpus_lsb.py
```
