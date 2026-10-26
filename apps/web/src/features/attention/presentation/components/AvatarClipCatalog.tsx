"use client";

import { useState } from "react";
import { LSB_EXPRESSIONS } from "@/features/lsb-catalog/domain/lsb-catalog";
import { normalizeSpanish } from "@/features/lsb-catalog/application/normalize-spanish";
import { resolveAnimationClip } from "@/features/lsb-catalog/application/resolve-animation";

export interface AvatarCatalogSelection {
  label: string;
  clipId: string | null;
  kind: "greeting" | "study";
  availableInBundledModel: boolean;
}

const STUDIES: readonly AvatarCatalogSelection[] = ["A", "B", "L"].map((letter) => ({
  label: letter, clipId: `QA_DACTILO_${letter}`, kind: "study", availableInBundledModel: true,
}));

export function AvatarClipCatalog({ clips, selectedClipId, onSelect, studyOnly = false }: {
  studyOnly?: boolean;
  clips: readonly string[] | null;
  selectedClipId: string | null;
  onSelect: (selection: AvatarCatalogSelection) => void;
}) {
  const [category, setCategory] = useState<"greeting" | "study">(studyOnly ? "study" : "greeting");
  const [query, setQuery] = useState("");
  const items: readonly AvatarCatalogSelection[] = category === "study" ? STUDIES : LSB_EXPRESSIONS.map((item) => ({
    label: item.spanish, clipId: item.animationClipId, kind: "greeting", availableInBundledModel: item.animationStatus === "provisional",
  }));
  const filtered = items.filter((item) => normalizeSpanish(item.label).includes(normalizeSpanish(query)));
  return (
    <aside className="avatar-clip-catalog" aria-label="Catálogo de clips 3D">
      <div><h3>Catálogo de clips</h3><p>Selecciona una expresión para revisar su disponibilidad.</p></div>
      {!studyOnly ? <div className="avatar-catalog-tabs" role="group" aria-label="Tipo de contenido">
        <button type="button" aria-pressed={category === "greeting"} onClick={() => { setCategory("greeting"); setQuery(""); }}>Saludos</button>
        <button type="button" aria-pressed={category === "study"} onClick={() => { setCategory("study"); setQuery(""); }}>Dactilología</button>
      </div> : null}
      <label htmlFor="avatar-catalog-search">Buscar en el catálogo</label>
      <input id="avatar-catalog-search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={category === "study" ? "Ej. A" : "Ej. Hola, Gracias"} autoComplete="off" />
      {category === "study" ? <p className="avatar-catalog-warning">Posturas de estudio A, B y L. Pendientes de revisión lingüística; no forman palabras automáticamente.</p> : <p className="avatar-catalog-warning">Los clips se muestran como propuestas y requieren revisión LSB.</p>}
      <div className="avatar-catalog-list" aria-label={category === "study" ? "Posturas de estudio" : "Saludos documentados"}>
        {filtered.length ? filtered.map((item) => {
          const available = clips === null ? item.availableInBundledModel : Boolean(resolveAnimationClip(clips, item.clipId));
          return <button type="button" key={`${item.kind}-${item.label}`} aria-label={`${item.label} ${item.kind === "study" ? "Estudio dactilológico" : "Saludo documentado"}; ${available ? "provisional" : "sin clip"}`} onClick={() => onSelect(item)} aria-pressed={Boolean(item.clipId && item.clipId === selectedClipId)}>
            <span><strong>{item.label}</strong><small>{item.kind === "study" ? "Estudio dactilológico" : "Saludo documentado"}</small></span>
            <span className={available ? "avatar-catalog-badge avatar-catalog-badge--available" : "avatar-catalog-badge"}>{available ? "Provisional" : "Sin clip"}</span>
          </button>;
        }) : <p className="avatar-catalog-empty">No hay resultados para esta búsqueda.</p>}
      </div>
    </aside>
  );
}
