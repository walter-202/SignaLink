# Guía Técnica: Pre y Post-Entrenamiento de Redes Neuronales para LSB

> Estado: propuesta de investigación heredada de la rama Apaza. Arquitecturas, parámetros, aumentos y métricas son opciones por evaluar, no decisiones aprobadas ni resultados medidos. Valida cada opción con experimentos reproducibles y el benchmark del proyecto.

Esta guía detalla la arquitectura, estrategias de pre-entrenamiento, aumentación de datos y post-procesamiento para construir modelos de:
1. **Isolated Sign Language Recognition (ISLR):** Reconocimiento de señas individuales.
2. **Continuous Sign Language Recognition (CSLR):** Reconocimiento continuo de secuencias de señas $\to$ Glosas.
3. **Sign Language Translation (SLT):** Traducción de video o glosas a texto en español fluido (Gloss-to-Text).

---

## 1. Pipeline General de Dos Etapas

```
[Video / Cámara LSB]
         │
         ▼
[Extractor de Landmarks (MediaPipe Holistic / OpenPose)]
 ├── Pose (33 landmarks 3D)
 ├── Manos Izq/Der (21 + 21 landmarks 3D)
 └── Rostro (Face mesh 468 puntos)
         │
         ▼ (Normalización + Data Augmentation)
[Etapa 1: Encoder Espaciotemporal (CSLR / ISLR)]
 (GCN, Spatial-Temporal Graph Conv, S3D o ViT)
         │
         ▼ [Pérdida CTC (Connectionist Temporal Classification)]
[Secuencia de Glosas LSB extraídas]  (Ej: [AYER] [MAMÁ] [CASA] [COMPRAR])
         │
         ▼
[Etapa 2: Módulo Seq2Seq / LLM Post-Entrenamiento (Gloss-to-Text)]
 (mBART, T5, LLaMA / Mistral LoRA / Gemini Fine-Tuning)
         │
         ▼
[Texto Fluido en Español Estándar]   (Ej: "Ayer mi mamá compró una casa.")
```

---

## 2. Fase de Pre-Entrenamiento (Pre-training)

El pre-entrenamiento busca que el modelo aprenda representaciones ricas del cuerpo y las manos antes de ajustar con pocos datos de señas bolivianas:

### 2.1 Representación de Entrada y Pre-procesamiento
1. **Normalización Anatómica:**
   * Centro de coordenadas en el punto medio de los hombros: $O = \frac{L_{shoulder} + R_{shoulder}}{2}$.
   * Factor de escala: $S = \| L_{shoulder} - R_{shoulder} \|_2$.
   * Para cada landmark $p_i = (x_i, y_i, z_i)$:
     $$p'_i = \frac{p_i - O}{S}$$
2. **Features Cinemáticas Complementarias:**
   * Posición normalizada: $P_t$.
   * Velocidad de primer orden: $V_t = P_t - P_{t-1}$.
   * Aceleración de segundo orden: $A_t = V_t - V_{t-1}$.
   * Concatenar $[P_t, V_t, A_t]$ por frame.

### 2.2 Estrategias de Auto-Preentrenamiento (Self-Supervised Learning)
* **Masked Pose Modeling (MPM):** Ocultar aleatoriamente el 20-30% de los joints o el 15% de los frames temporales y entrenar un Transformer encoder para reconstruir los joints faltantes.
* **Pre-entrenamiento con Datasets Masivos:** Pre-entrenar el backbone visual o de grafos sobre datasets públicos grandes de lengua de señas (WLASL, AUTSL, PHOENIX-Weather 2014T, LSA64) y posteriormente transferir pesos hacia el corpus de 1,380+ señas de la LSB.

### 2.3 Data Augmentation Específico para LSB
* **Variabilidad Temporal (Time-warping / Resampling):** Variar la velocidad de reproducción entre $0.8\times$ y $1.2\times$ mediante interpolación lineal o splines.
* **Jittering espacial gaussiano:** Añadir ruido leve $\mathcal{N}(0, 0.005)$ a las articulaciones manuales.
* **Rotación y traslación leve:** Rotaciones de $\pm 10^\circ$ en el plano coronal y sagital para simular variaciones de ángulo de cámara.
* **Espejado horizontal (Horizontal Flip):**
  * *Precaución:* La LSB utiliza la mano derecha para deícticos icónicos cefálicos (ojos, nariz). Al espejar horizontalmente se debe intercambiar la etiqueta de mano dominante si el modelo modela asimetría manual.

---

## 3. Fase de Entrenamiento CSLR (Alineación con CTC)

En video continuo de LSB no se cuenta con marcas temporales exactas de inicio/fin de cada seña. Se utiliza **CTC Loss**:
$$\mathcal{L}_{\text{CTC}} = -\ln P(\mathbf{y} \mid \mathbf{x})$$

### Manejo de Fases Múltiples (Fotogramas a, b, c...)
En nuestro corpus oficial, más del 30% de las señas son **multifase** (compuestas por transición de postura o sub-señas secuenciales):
* En CSLR, no forzar un colapso prematuro de frames. Permitir que el encoder genere predicciones intermedias continuas con token en blanco (`<blank>`) entre morfemas gestuales.

---

## 4. Fase de Post-Entrenamiento (Gloss-to-Text / SLT)

El objetivo es convertir la secuencia de glosas discretizadas al español gramaticalmente correcto:

### 4.1 Fine-Tuning de Modelos de Lenguaje (Seq2Seq / LLM)
* Modelos recomendados: `mBART-50-large`, `T5-base / mT5`, o fine-tuning con LoRA sobre `Llama-3-8B-Instruct` / `Gemma-2-9B`.
* El prompt o formato de entrada debe incluir contexto si está disponible (tipo de interacción, categoría temática).

### 4.2 Infillings y Transformaciones Sintácticas Requeridas
El modelo debe ser supervisado para aprender sistemáticamente:
1. **Reordenamiento T-S-O-V $\to$ SVO:**
   * Input: `[AYER] [PAN] [MAMÁ] [COMPRAR]` $\to$ Output: `"Ayer mi mamá compró pan."`
2. **Inserción de Artículos y Preposiciones:**
   * Input: `[YO] [COCHABAMBA] [VIAJAR]` $\to$ Output: `"Yo viajaré a Cochabamba."`
3. **Inserción de Verbo Ser/Estar:**
   * Input: `[HERMANO] [MÍO] [ABOGADO]` $\to$ Output: `"Mi hermano es abogado."`
4. **Desambiguación Contextual:**
   * `[FALTAR]` en contexto escolar: `"Él faltó a clases"`.
   * `[FALTAR]` en contexto de cocina: `"Falta sal"`.

---

## 5. Métricas de Evaluación Rigurosas

* **ISLR:** Top-1 Accuracy, Top-5 Accuracy, F1-Score macro ponderado.
* **CSLR:** Word Error Rate (WER) sobre secuencias de glosas:
  $$\text{WER} = \frac{S + D + I}{N}$$
  (Sustituciones, Deleciones, Inserciones sobre el total de glosas $N$).
* **SLT (Gloss-to-Text):** BLEU (1 a 4), ROUGE-L y chrF++ contra referencias humanas de oraciones en español.
