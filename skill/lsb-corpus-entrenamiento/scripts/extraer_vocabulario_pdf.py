# -*- coding: utf-8 -*-
"""Extractor heurístico experimental de texto e imágenes desde documentos PDF.

La salida puede contener errores de glosa, página, módulo o recorte; requiere
comparación manual con la fuente. Usa solo PDFs cuya extracción y uso estén
autorizados, y no publiques la salida sin resolver los permisos de redistribución.

Fuente de verdad: "Índice de palabras y señas" de cada módulo (lista oficial).
Se complementa y enriquece con la sección "Fotografías de señas":
página exacta, fotogramas (a, b, c...), bounding boxes de cada fotografía y
opción de recorte de imágenes PNG.

Requisitos: pip install pymupdf

Uso (guarda la salida en almacenamiento local, fuera del repositorio):
    python extraer_vocabulario_pdf.py --pdf-dir <carpeta_con_los_pdf> \
        --out <carpeta_local>/vocabulario_lsb.json [--crops <carpeta_local>/recortes] [--dpi 150]
"""
import argparse, json, os, re, sys, unicodedata

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

MODULOS = [
    ("M1", "Básico 1", "CURSO-DE-ENSENANZA-DE-LA-LENGUA-DE-SENAS-BOLIVIANA-Modulo-1.pdf"),
    ("M2", "Básico 2", "Curso-de-ensenanza-de-la-LSB-MODULO-2.pdf"),
    ("M3", "Intermedio", "Modulos-de-ensenanza-de-la-LSB-MODULO-3.pdf"),
    ("M4", "Avanzado", "Curso-de-ensenanza--LSB-Mod-4.pdf"),
]
CAPTION = re.compile(r"^(\d{1,3})\s*\.?\s*(\S.*)$")
INDEX_CAT = re.compile(r"^(.*?)\s*\.{3,}[\s.]*P.g\.\s*(\d+)")
FRAME = re.compile(r"^[a-f]$")
VARIANTE = re.compile(r"\(\s*opci[oó]n[^)]*\)", re.I)
CELL_W, CELL_H = 145, 188
LETTER_DX, LETTER_DY = 122, 6


def sin_tildes(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def glosa(label):
    s = VARIANTE.sub("", label)
    s = re.sub(r"\(([\d.]+)\)", "", s) if re.search(r"[A-Za-z]", re.sub(r"\(.*?\)", "", s)) else s
    s = sin_tildes(s).replace("ñ", "n").replace("Ñ", "N")
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").upper()


def clave(label):
    s = sin_tildes(re.sub(r"\(.*?\)", "", label)).lower()
    return re.sub(r"[^a-z0-9]", "", s)


def lines_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            t = "".join(s["text"] for s in l["spans"]).strip()
            if t:
                out.append({"bbox": l["bbox"], "text": t, "size": l["spans"][0]["size"]})
    return out


def parse_index(doc):
    cats, cur, started = [], None, False
    for pno in range(min(doc.page_count, 80)):
        for raw in doc[pno].get_text().splitlines():
            t = raw.strip()
            m = INDEX_CAT.match(t)
            if m:
                started = True
                name = m.group(1).strip(" .") or (cur["categoria"] if cur else "?")
                cur = {"categoria": name, "pagina_tema": int(m.group(2)), "items": []}
                cats.append(cur)
                continue
            if not started or cur is None:
                continue
            mi = CAPTION.match(t)
            if mi:
                cur["items"].append([int(mi.group(1)), mi.group(2).strip()])
            elif re.fullmatch(r"\d{1,3}\s*\.?", t):
                cur["items"].append([int(t.rstrip(". ")), ""])
            elif cur["items"] and cur["items"][-1][1] == "" and t:
                cur["items"][-1][1] = t
            elif cur["items"] and t and not t.isdigit() and t.count("(") < t.count(")") + 1 \
                    and cur["items"][-1][1].count("(") > cur["items"][-1][1].count(")"):
                cur["items"][-1][1] += " " + t
        if cats and pno + 1 >= cats[0]["pagina_tema"]:
            break
    return cats


def cells_of(page, caps, frames):
    real = []
    for info in page.get_image_info():
        x0, y0, x1, y1 = info["bbox"]
        if 100 < (x1 - x0) < 250 and 120 < (y1 - y0) < 260:
            if not any(abs(x0 - r[0]) < 8 and abs(y0 - r[1]) < 8 for r in real):
                real.append((x0, y0, x1, y1))
    if len(real) >= len(caps):
        return real, "foto"
    virt = []
    for c in caps:
        x0, y0 = c["bbox"][0], c["bbox"][1]
        virt.append((x0 - 1, y0 - CELL_H - 1, x0 - 1 + CELL_W, y0 - 1))
    for f in frames:
        x0, y0 = f["bbox"][0] - LETTER_DX, f["bbox"][1] - LETTER_DY
        if not any(abs(x0 - v[0]) < 30 and abs(y0 - v[1]) < 40 for v in virt):
            virt.append((x0, y0, x0 + CELL_W, y0 + CELL_H))
    return virt, "virtual"


def parse_photos(doc, first_page):
    found = []
    for pno in range(first_page - 1, doc.page_count):
        page = doc[pno]
        ls = lines_of(page)
        caps = []
        for l in ls:
            m = CAPTION.match(l["text"])
            if m and l["size"] < 14 and l["bbox"][1] > 60:
                caps.append({"n": int(m.group(1)), "label": m.group(2).strip(), "bbox": l["bbox"]})
        if not caps:
            continue
        frames = [l for l in ls if FRAME.match(l["text"]) and l["size"] > 14]
        cells, kind = cells_of(page, caps, frames)
        owner = {}
        for c in caps:
            for i, ph in enumerate(cells):
                if abs(ph[0] - c["bbox"][0]) < 25 and -8 <= c["bbox"][1] - ph[3] < 40:
                    owner[i] = c
        order = sorted(range(len(cells)), key=lambda i: (round(cells[i][1] / 40), cells[i][0]))
        current = None
        for i in order:
            ph = cells[i]
            letter = next((f["text"] for f in frames
                           if ph[0] <= f["bbox"][0] <= ph[2] and ph[1] - 5 <= f["bbox"][1] <= ph[1] + 60), None)
            fr = {"letra": letter, "pagina": pno + 1, "bbox": [round(v, 1) for v in ph], "tipo_recorte": kind}
            if i in owner:
                c = owner[i]
                current = {"n": c["n"], "label": c["label"], "pagina": pno + 1, "fotogramas": [fr]}
                found.append(current)
            elif current is not None and letter not in (None, "a"):
                current["fotogramas"].append(fr)
            elif current is not None and letter is None and kind == "foto":
                current["fotogramas"].append(fr)
    return found


def build_module(path, mod_id, level):
    doc = pymupdf.open(path)
    index = parse_index(doc)
    first = index[0]["pagina_tema"] if index else 50
    photos = parse_photos(doc, first)
    starts = sorted(((c["pagina_tema"], k) for k, c in enumerate(index)))

    def cat_of(page):
        k = None
        for p, kk in starts:
            if p <= page:
                k = kk
        return k

    by_cat = {}
    for ph in photos:
        by_cat.setdefault(cat_of(ph["pagina"]), []).append(ph)

    out, usadas = [], set()
    for k, c in enumerate(index):
        cands = by_cat.get(k, [])
        for n, label in c["items"]:
            ph = next((p for p in cands if id(p) not in usadas and p["n"] == n), None)
            if ph is None:
                ph = next((p for p in cands if id(p) not in usadas and clave(p["label"])[:5] == clave(label)[:5]), None)
            if ph is not None:
                usadas.add(id(ph))
            entry = {
                "id": f"{mod_id}-{k+1:02d}-{n:03d}",
                "modulo": mod_id,
                "nivel": level,
                "categoria": c["categoria"],
                "categoria_idx": k + 1,
                "numero": n,
                "etiqueta_es": VARIANTE.sub("", label).strip(),
                "glosa": glosa(label),
                "tiene_variantes": bool(VARIANTE.search(label)) or bool(ph and VARIANTE.search(ph["label"])),
                "etiqueta_foto": ph["label"] if ph else None,
                "pagina_pdf": ph["pagina"] if ph else None,
                "num_fotogramas": len(ph["fotogramas"]) if ph else None,
                "multifase": (len(ph["fotogramas"]) > 1) if ph else None,
                "fotogramas": ph["fotogramas"] if ph else [],
            }
            out.append(entry)
    huerfanas = [p for p in photos if id(p) not in usadas]
    return index, out, huerfanas


def crop(pdf_dir, signs, out_dir, dpi):
    docs, files = {}, {m: f for m, _, f in MODULOS}
    for s in signs:
        doc = docs.setdefault(s["modulo"], pymupdf.open(os.path.join(pdf_dir, files[s["modulo"]])))
        for k, fr in enumerate(s["fotogramas"]):
            pix = doc[fr["pagina"] - 1].get_pixmap(dpi=dpi, clip=pymupdf.Rect(fr["bbox"]))
            name = f"{s['id']}_{s['glosa'][:40]}_{fr['letra'] or k + 1}.png"
            p = os.path.join(out_dir, s["modulo"], name)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            pix.save(p)
            fr["imagen"] = f"{s['modulo']}/{name}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--crops", help="carpeta donde guardar los recortes PNG de cada fotograma")
    ap.add_argument("--dpi", type=int, default=150)
    a = ap.parse_args()
    signs, temas, huerf = [], [], []
    for mod_id, level, fname in MODULOS:
        path = os.path.join(a.pdf_dir, fname)
        if not os.path.exists(path):
            print("FALTA", path, file=sys.stderr)
            continue
        index, s, h = build_module(path, mod_id, level)
        for k, c in enumerate(index):
            temas.append({
                "modulo": mod_id,
                "categoria_idx": k + 1,
                "categoria": c["categoria"],
                "pagina_tema": c["pagina_tema"],
                "n_items": len(c["items"])
            })
        sin = sum(1 for x in s if x["pagina_pdf"] is None)
        print(f"{mod_id}: {len(s)} entradas de índice | sin foto: {sin} | multifase: "
              f"{sum(1 for x in s if x['multifase'])} | fotos huérfanas: {len(h)}", file=sys.stderr)
        signs += s
        huerf += [{"modulo": mod_id, **x} for x in h]

    if a.crops:
        crop(a.pdf_dir, signs, a.crops, a.dpi)

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump({
        "fuente": "Ministerio de Educación de Bolivia (2010-2011). Curso de enseñanza de la "
                 "Lengua de Señas Boliviana, Módulos 1-4. Reconocida por D.S. Nº 0328.",
        "total_senas": len(signs),
        "temas": temas,
        "senas": signs
    }, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Vocabulario guardado exitosamente en: {a.out} ({len(signs)} señas)", file=sys.stderr)


if __name__ == "__main__":
    main()
