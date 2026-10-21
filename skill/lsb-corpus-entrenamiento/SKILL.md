---
name: lsb-corpus-entrenamiento
description: >-
  Corpus oficial, fonología gestual y pautas integrales de pre-entrenamiento y post-entrenamiento
  de modelos de Inteligencia Artificial para Lengua de Señas Boliviana (LSB), basado en los 4 módulos
  oficiales del Ministerio de Educación de Bolivia (Decreto Supremo Nº 0328). Utiliza esta skill para
  construcción de datasets (1,380+ señas), extracción de poses/landmarks (MediaPipe, OpenPose),
  entrenamiento de modelos de visión (ISLR, CSLR con CTC loss), y post-procesamiento/fine-tuning
  de LLMs y modelos Seq2Seq para traducción de señas/glosas a español fluido (Gloss-to-Text).
---

# Lengua de Señas Boliviana (LSB) - Corpus y Guía de Pre / Post-Entrenamiento

Esta skill proporciona las bases lingüísticas oficiales, el vocabulario completo indexado y las directrices técnicas para diseñar, pre-entrenar, entrenar y post-procesar modelos de **Reconocimiento y Traducción de Lengua de Señas Boliviana (LSB)** a texto en español.

El material está fundamentado en los **4 Módulos Oficiales del Curso de Enseñanza de la LSB** publicados por el Ministerio de Educación del Estado Plurinacional de Bolivia y la Federación Boliviana de Sordos (FEBOS) bajo el **Decreto Supremo Nº 0328**:
* **Módulo 1:** Nivel Básico 1 (285 entradas de vocabulario, 72 multifase).
* **Módulo 2:** Nivel Básico 2 (322 entradas de vocabulario, 98 multifase).
* **Módulo 3:** Nivel Intermedio (362 entradas de vocabulario, 142 multifase).
* **Módulo 4:** Nivel Avanzado (412 entradas de vocabulario, 158 multifase).
* **Total:** 1,381 señas oficiales indexadas con metadata de páginas, fotos y fotogramas correlativos ($a, b, c...$).

---

## 1. Arquitectura del Pipeline: De Video a Texto

El sistema se estructura en dos fases desacopladas recomendadas por el estado del arte en SLT (Sign Language Translation):

```
[Video / Cámara Continua LSB]
            │
            ▼
[Extractor de Landmarks 3D (MediaPipe / OpenPose)]
            │  (Coordenadas x, y, z de manos, pose y rostro)
            ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: PRE-ENTRENAMIENTO Y CSLR (Visión / Grafos)          │
│ • Backbone: ST-GCN, GCN-Transformer, S3D o ViT             │
│ • Pre-entrenamiento: Masked Pose Modeling (MPM) / Transfer  │
│ • Loss de Alineación: CTC (Connectionist Temporal Classif.) │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
   [Secuencia de Glosas LSB]  (Ej: [AYER] [MAMÁ] [PAN] [COMPRAR])
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 2: POST-ENTRENAMIENTO Y SLT (Gloss-to-Text)            │
│ • Modelo: Seq2Seq / LLM (mBART-50, mT5, LoRA Fine-Tuning)  │
│ • Reglas Lingüísticas: Infilling de artículos/cópulas,     │
│   reordenamiento SOV -> SVO, flexión temporal.              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
[Texto Fluido en Español Estándar]  (Ej: "Ayer mi mamá compró pan.")
```

---

## 2. Pre-Entrenamiento: Preparación y Modelado Visual

Para que los modelos de visión reconozcan señas LSB con alta precisión y generalicen frente a diferentes señantes y condiciones de iluminación:

### 2.1 Normalización de Landmarks (Invarianza de Escala y Posición)
* Normalizar todos los landmarks restando el punto medio de los hombros ($O = \frac{L_{sh} + R_{sh}}{2}$) y dividiendo entre la distancia biacromial ($\|L_{sh} - R_{sh}\|_2$).
* Concatenar características cinemáticas: posición normalizada ($P_t$), velocidad ($V_t = P_t - P_{t-1}$) y aceleración ($A_t = V_t - V_{t-1}$).

### 2.2 Estrategias de Pre-Entrenamiento
1. **Transfer Learning:** Pre-entrenar backbones sobre datasets masivos públicos (WLASL, AUTSL, PHOENIX-2014T, LSA64) para asimilar configuraciones de manos y trayectorias antes de ajustar en LSB.
2. **Masked Pose Modeling (SSL):** Enmascarar aleatoriamente articulaciones de manos o ventanas temporales y entrenar un encoder espaciotemporal para reconstruir las trayectorias ausentes.

### 2.3 Reglas de Data Augmentation Específico
* **Time-Warping:** Variar la velocidad de ejecución ($0.8\times$ a $1.2\times$) mediante remuestreo temporal, reflejando señantes lentos o rápidos.
* **Jittering espacial gaussiano:** Ruido leve en articulaciones secundarias ($\sigma = 0.005$).
* **Atención con el espejado horizontal (Horizontal Flip):** La LSB reserva la mano derecha para señas deícticas cefálicas (nariz, ojos) y mano dominante. Al espejar, invertir las etiquetas de mano izquierda/derecha.

Consulta la guía técnica exhaustiva en:
* [guia_pre_post_entrenamiento_lsb.md](./references/guia_pre_post_entrenamiento_lsb.md)
* [parametros_formacionales_y_simbologia.md](./references/parametros_formacionales_y_simbologia.md)

---

## 3. Post-Entrenamiento: Traducción de Glosas a Español (Gloss-to-Text)

El post-entrenamiento enseña al modelo de lenguaje (Seq2Seq / LLM) a subsanar la discrepancia gramatical entre la LSB y el español:

### 3.1 Transformaciones Sintácticas Críticas
1. **Reordenamiento Temporal y de Argumentos (T-S-O-V $\to$ SVO):**
   * Glosa: `[AYER] [PAN] [MAMÁ] [COMPRAR]` $\to$ Texto: *"Ayer mi mamá compró pan."*
2. **Inserción de Cópulas (*Ser / Estar*):**
   * En LSB no existen verbos cópula. Glosa: `[HERMANO] [MÍO] [MÉDICO]` $\to$ Texto: *"Mi hermano es médico."*
   * Glosa: `[YO] [TRISTE]` $\to$ Texto: *"Estoy triste."*
3. **Infilling de Artículos y Preposiciones:**
   * La LSB prescinde de artículos (*el, la, los*) y las preposiciones van embebidas en los verbos direccionales.
   * Glosa: `[MAÑANA] [YO] [LA-PAZ] [VIAJAR]` $\to$ Texto: *"Mañana viajaré a La Paz."*
4. **Desambiguación Léxica Contextual:**
   * La seña `[FALTAR]` tiene articulaciones distintas en el Módulo 4 según el dominio: ausencia a clase (*"Él faltó a la escuela"*) vs. carencia de insumo (*"Falta arroz"*).

Consulta las reglas detalladas y ejemplos en:
* [gramatica_y_morfosintaxis_lsb.md](./references/gramatica_y_morfosintaxis_lsb.md)
* [ejemplos_traduccion_glosa_a_espanol.json](./examples/ejemplos_traduccion_glosa_a_espanol.json)

---

## 4. Scripts y Herramientas Incluidas

La carpeta `scripts/` contiene herramientas listas para usar en pipelines de datos y evaluación:

| Script | Propósito y Uso |
| :--- | :--- |
| `extraer_vocabulario_pdf.py` | Extrae y normaliza el corpus desde los 4 PDFs oficiales a JSON. Incluye soporte para recorte de imágenes de referencia (`--crops`). |
| `buscar_sena.py` | Consulta interactiva del diccionario oficial por palabra, glosa, módulo (`--modulo M1`) o señas multifase (`--multifase`). |
| `traductor_glosa_a_texto.py` | Motor de traducción por reglas / post-procesador de glosas LSB a oraciones en español. Soporta modo interactivo y `--batch`. |

Ejemplos de ejecución en terminal:
```bash
# Consultar una seña en el corpus oficial:
python scripts/buscar_sena.py "familia"

# Probar traducción y post-procesamiento de glosas:
python scripts/traductor_glosa_a_texto.py "AYER MAMA PAN COMPRAR"

# Evaluar el set de pruebas sintácticas:
python scripts/traductor_glosa_a_texto.py --batch ../examples/ejemplos_traduccion_glosa_a_espanol.json
```
