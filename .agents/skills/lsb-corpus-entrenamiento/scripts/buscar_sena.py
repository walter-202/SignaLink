# -*- coding: utf-8 -*-
"""Búsqueda de un vocabulario local LSB con licencia y calidad revisadas.

Uso:
    python buscar_sena.py --vocab /ruta/local/vocabulario_lsb.json "hola"
    python buscar_sena.py --vocab /ruta/local/vocabulario_lsb.json --modulo M1 --categoria Saludos
    python buscar_sena.py --vocab /ruta/local/vocabulario_lsb.json --multifase
"""
import argparse, json, os, re, sys, unicodedata


def normalizar(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-zA-Z0-9]", "", s).lower()


def cargar_vocabulario(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "..", "references", "vocabulario_lsb.json")
    if not os.path.exists(path):
        raise FileNotFoundError(f"No se encontró el vocabulario en {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="Consulta un vocabulario local LSB revisado.")
    parser.add_argument("termino", nargs="?", default="", help="Palabra en español o glosa a buscar.")
    parser.add_argument("--vocab", required=True, help="Ruta a un vocabulario local con permisos y calidad revisados.")
    parser.add_argument("--modulo", choices=["M1", "M2", "M3", "M4"], help="Filtrar por módulo (M1-M4).")
    parser.add_argument("--categoria", help="Filtrar por categoría / tema.")
    parser.add_argument("--multifase", action="store_true", help="Filtrar solo señas de múltiples fotogramas (a, b, c...).")
    parser.add_argument("--json", action="store_true", help="Salida en formato JSON crudo.")
    args = parser.parse_args()

    data = cargar_vocabulario(args.vocab)
    senas = data.get("senas", [])

    term = normalizar(args.termino) if args.termino else ""

    resultados = []
    for s in senas:
        if args.modulo and s["modulo"] != args.modulo:
            continue
        if args.categoria and normalizar(args.categoria) not in normalizar(s["categoria"]):
            continue
        if args.multifase and not s.get("multifase"):
            continue

        if term:
            nombre = normalizar(s.get("etiqueta_es", ""))
            glosa = normalizar(s.get("glosa", ""))
            if term not in nombre and term not in glosa:
                continue

        resultados.append(s)

    if args.json:
        print(json.dumps(resultados, ensure_ascii=False, indent=2))
        return

    print(f"Total coincidencias: {len(resultados)}")
    print("-" * 75)
    for r in resultados[:40]:
        fases = f"{r.get('num_fotogramas', 1)} fases" if r.get('multifase') else "1 fase"
        print(f"[{r['id']}] {r['etiqueta_es']} | Glosa: {r['glosa']} | Mod: {r['modulo']} ({r['categoria']}) | Pág: {r.get('pagina_pdf')} ({fases})")

    if len(resultados) > 40:
        print(f"... y {len(resultados) - 40} más (usa filtros o --json para verlos todos).")


if __name__ == "__main__":
    main()
