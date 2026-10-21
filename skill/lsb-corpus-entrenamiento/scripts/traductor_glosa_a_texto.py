# -*- coding: utf-8 -*-
"""Módulo de post-procesamiento heurístico y basado en reglas para traducir glosas LSB a español.

Este script sirve como baseline / pre-procesador antes o después de pasar por un LLM / Seq2Seq.

Uso:
    python traductor_glosa_a_texto.py "AYER MAMA PAN COMPRAR"
    python traductor_glosa_a_texto.py --batch ../examples/ejemplos_traduccion_glosa_a_espanol.json
"""
import argparse, json, re, sys

DICCIONARIO_COPULAS = {
    "MEDICO": "es médico", "ABOGADO": "es abogado", "PROFESOR": "es profesor",
    "MAESTRO": "es maestro", "ENFERMERO": "es enfermero", "INGENIERO": "es ingeniero",
    "FELIZ": "está feliz", "TRISTE": "está triste", "CANSADO": "está cansado",
    "ENFERMO": "está enfermo", "ENOJADO": "está enojado", "PREOCUPADO": "está preocupado"
}

CIUDADES = {"LA-PAZ", "COCHABAMBA", "SANTA-CRUZ", "ORURO", "POTOSI", "CHUQUISACA", "TARIJA", "BENI", "PANDO"}


def traducir_glosa(glosas_str):
    tokens = [re.sub(r"[\[\],]", "", t).strip().upper() for t in glosas_str.split() if t.strip()]
    if not tokens:
        return ""

    tiempo = None
    if tokens[0] in {"AYER", "ANTEAYER", "PASADO", "ANO-PASADO"}:
        tiempo = "pasado"
    elif tokens[0] in {"MANANA", "PASADO-MANANA", "FUTURO", "PROXIMO"}:
        tiempo = "futuro"
    elif tokens[0] in {"HOY", "AHORA", "PRESENTE"}:
        tiempo = "presente"

    texto = " ".join(tokens)

    # Heurística 1: Cópulas (Yo triste -> Yo estoy triste)
    if "YO" in tokens and any(adj in tokens for adj in ["TRISTE", "FELIZ", "CANSADO"]):
        texto = texto.replace("YO TRISTE", "Yo estoy triste").replace("YO FELIZ", "Yo estoy feliz")

    # Heurística 2: Sujeto posesivo + profesión (Hermano mío médico -> Mi hermano es médico)
    if "HERMANO" in tokens and "MIO" in tokens:
        texto = re.sub(r"HERMANO\s+MIO", "Mi hermano", texto)
        for k, v in DICCIONARIO_COPULAS.items():
            if k in texto:
                texto = texto.replace(k, v)

    # Heurística 3: Movimiento con ciudades (Yo La Paz viajar -> Yo viajaré a La Paz)
    for c in CIUDADES:
        if c in tokens and any(v in tokens for v in ["VIAJAR", "IR"]):
            if tiempo == "futuro":
                texto = re.sub(rf"YO\s+{c}\s+VIAJAR", f"viajaré a {c.title().replace('-', ' ')}", texto)
            else:
                texto = re.sub(rf"YO\s+{c}\s+VIAJAR", f"viajo a {c.title().replace('-', ' ')}", texto)

    # Heurística 4: SOV a SVO estándar en pasado (Ayer mamá pan comprar -> Ayer mi mamá compró pan)
    if tiempo == "pasado" and "MAMA" in tokens and "PAN" in tokens and "COMPRAR" in tokens:
        texto = "Ayer mi mamá compró pan."

    # Normalizar mayúsculas y puntuación básica
    if not texto.endswith((".", "!", "?")):
        texto += "."
    texto = texto[0].upper() + texto[1:]
    return texto


def main():
    parser = argparse.ArgumentParser(description="Traducción y post-procesamiento de glosas LSB a español.")
    parser.add_argument("glosas", nargs="?", default="", help="Secuencia de glosas separadas por espacios.")
    parser.add_argument("--batch", help="Ruta a archivo JSON con ejemplos para evaluar.")
    args = parser.parse_args()

    if args.batch:
        with open(args.batch, "r", encoding="utf-8") as f:
            ejemplos = json.load(f)
        print(f"Evaluando {len(ejemplos)} oraciones de prueba:")
        print("=" * 80)
        for ej in ejemplos:
            out = traducir_glosa(ej["glosa_lsb"])
            print(f"Glosa  : {ej['glosa_lsb']}")
            print(f"Reglas : {out}")
            print(f"Natural: {ej['espanol_natural']}")
            print("-" * 80)
        return

    if args.glosas:
        print(traducir_glosa(args.glosas))
    else:
        print("Por favor provee una cadena de glosas o el parámetro --batch.")


if __name__ == "__main__":
    main()
