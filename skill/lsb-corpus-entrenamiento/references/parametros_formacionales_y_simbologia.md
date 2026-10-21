# Parámetros Formacionales, Simbología y Notación de Movimiento de la LSB

Este documento sintetiza de forma técnica la fonología gestual y la notación de movimiento de la Lengua de Señas Boliviana (LSB), según los 4 Módulos de Enseñanza del Ministerio de Educación de Bolivia (Decreto Supremo Nº 0328).

---

## 1. Parámetros Formacionales (Querología / Fonología Gestual)

Toda seña en la LSB se descompone en un conjunto de parámetros articulatorios simultáneos. En el diseño de modelos de Computer Vision (MediaPipe, OpenPose, Vision Transformers), cada parámetro debe mapearse a características espaciotemporales específicas:

| Parámetro Lingüístico | Término Técnico LSB | Definición Articulada | Feature en Pipelines de CV / ML |
| :--- | :--- | :--- | :--- |
| **Configuración Manual** | *Queirema* | Forma y postura adoptada por los dedos y la palma de la mano. | Landmarks de las manos (21 puntos por mano). Distancias interdigitales, ángulos de flexión. |
| **Lugar de Articulación** | *Toponema* | Zona anatómica o punto en el espacio de señado donde se ejecuta la seña (cabeza, pecho, espacio neutro, etc.). | Coordenadas relativas de la muñeca respecto al tronco, cuello y rostro (Pose + Face landmarks). |
| **Movimiento** | *Kinema* | Tipo de trayectoria efectuada por la mano o dedos (recto, curvo, circular, ondulante, repetitivo). | Derivada temporal de los landmarks ($\Delta x, \Delta y, \Delta z$), velocidad, aceleración y curvatura. |
| **Dirección del Movimiento** | *Kineprosema* | Hacia dónde se desplaza la mano (arriba, abajo, ipsilateral, contralateral, distal, proximal). | Vectores direccionales unitarios y vectores relativos cuerpo-espacio. |
| **Orientación de la Palma** | *Queirotropema* | Orientación espacial de la palma de la mano (hacia arriba, abajo, hacia el emisor, hacia el receptor). | Vector normal al plano formado por la palma (muñeca, índice-MCP y meñique-MCP). |
| **Expresión No Manual** | *Prosoponema* | Expresión del rostro, cejas, ojos, apertura bucal y postura de cabeza/hombros. | Landmarks faciales (468 puntos), acción de cejas, apertura labial, rotación de cabeza. |

---

## 2. Sistema de Notación de Símbolos y Flechas de la LSB

Los manuales oficiales utilizan un sistema gráfico normalizado para guiar la ejecución de cada seña. Para modelos de visión artificial, estas flechas y marcas traducen funciones cinemáticas esenciales:

### 2.1 Flechas Cinéticas (Trayectorias y Dinámica)

* **Movimiento normal (Flecha continua simple):** Desplazamiento regular siguiendo la dirección del vector. Ejemplo: *Hola*.
* **Movimiento lento (Flecha estilizada alargada):** Ejecución a velocidad reducida deliberada. Ejemplo: *Tortuga*. Crucial en el pre-entrenamiento para regularización temporal (evitar colapso de secuencias lentas).
* **Movimiento reiterativo (Flecha con signo $=$):** El movimiento base se repite 2 o 3 veces de forma idéntica.
* **Movimiento circular u ondulatorio (Flechas curvas / senoidales):** Giros en el plano sagital, coronal o transversal; trayectorias de ondas. Ejemplo: *Río* (ondulante), *Abuela* (circular).
* **Movimiento simultáneo (Flechas paralelas dobles):** Ambas manos se desplazan con idéntica trayectoria al mismo tiempo. Ejemplo: *Abuelo*.

### 2.2 Símbolos Morfológicos y de Contacto

* **Mano pasiva:** Una mano actúa como plano de soporte estático mientras la mano activa ejecuta la acción. Ejemplo: *Regla*.
* **Contraer dedos:** Cierre gradual de la mano desde palma extendida a puño cerrado. Ejemplo: *Apagar*.
* **Expandir dedos:** Apertura rápida de los dedos desde mano cerrada. Ejemplo: *Sol*.
* **Punto de articulación:** Señalización anatómica donde se produce la inflexión articular.
* **Roce / Roce continuo:** Contacto tangencial superficial de una mano sobre otra o sobre el cuerpo. Ejemplo: *Construir*, *Por favor*.
* **Contacto:** Encuentro directo y unión de ambas manos o mano-cuerpo. Ejemplo: *Casa*.
* **Apuntar o posicionar:** Dedo índice orientado a un locus espacial específico (función deíctica). Ejemplo: *Tú*, *Él*.
* **Volcar / Voltear:** Pronación o supinación del antebrazo mostrando la cara opuesta de la palma. Ejemplo: *Cocina*.
* **Movimiento de dedos (Fingering):** Flexión y oscilación independiente de falanges sin desplazar la muñeca. Ejemplo: *Colores*, *Nieve*.
* **Ademán de tijera:** Flexión alternada o simultánea de dedos índice y medio simulando corte. Ejemplo: *Peluquería*, *Oveja*.
* **Jalar o sacudir:** Tirón enérgico o vibración rápida. Ejemplo: *Chapare* (jalar polera), *Carne* (sacudir mano).
* **Chasquido:** Liberación súbita de tensión del dedo medio o índice contra el pulgar. Ejemplo: *Odio*, *Gripe*.
* **Vibración:** Micro-oscilación rápida de mano o antebrazo. Ejemplo: *Invierno* (tiritar de frío).
* **Secuencia Correlativa ($1, 2, 3...$ o $a, b, c...$):** Fases ordenadas temporalmente para señas multifásicas complejas (compuestas por sub-señas o transiciones de postura).

---

## 3. Implicaciones para la Extracción de Features (Pose Landmarks)

1. **Normalización respecto al señante:**
   Las coordenadas de landmarks deben normalizarse restando el punto medio de los hombros y escalando por la distancia biacromial (ancho entre hombros). Esto garantiza invarianza de escala respecto a la distancia de la cámara.
2. **Coordenadas relativas cara-manos:**
   La distancia euclidiana entre la punta de los dedos ($Tip$) y puntos clave del rostro (nariz, comisuras labiales, frente, barbilla) es el discriminador primordial para toponemas cefálicos.
3. **Mano activa vs. Mano pasiva:**
   En señas bimanuales, calcular la varianza de velocidad ($\sigma^2$) de cada muñeca permite clasificar automáticamente el rol activo/pasivo de cada extremidad en la ventana temporal.
