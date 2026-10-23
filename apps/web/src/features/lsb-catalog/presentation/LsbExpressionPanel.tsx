"use client";

import { useState, type FormEvent } from "react";
import { Hand, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  LSB_ANIMATION_NOTE,
  LSB_EXPRESSIONS,
  LSB_GLOSS_NOTE,
  LSB_SOURCE,
} from "../domain/lsb-catalog";
import {
  LSB_VALIDATION_LABELS,
  type LsbExpression,
} from "../domain/lsb-expression";
import {
  resolveLsbExpression,
  searchLsbExpressions,
  type LsbResolution,
} from "../application/resolve-lsb-expression";
import { normalizeSpanish } from "../application/normalize-spanish";

interface LsbExpressionPanelProps {
  draft: string;
  onResolved?: (expression: LsbExpression | null, sourceDraft?: string) => void;
}

function announce(resolution: LsbResolution | null): string {
  if (!resolution) return "";
  if (resolution.status === "matched") {
    return `Se encontró ${resolution.expression.spanish} en el catálogo, página ${resolution.expression.page}.`;
  }
  if (resolution.status === "unknown") {
    return "No hay una expresión documentada en el catálogo para esa frase.";
  }
  return "Escribe o dicta una frase para buscar en el catálogo.";
}

export function LsbExpressionPanel({
  draft,
  onResolved,
}: LsbExpressionPanelProps) {
  const [query, setQuery] = useState("");
  const [resolution, setResolution] = useState<LsbResolution | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const matches = searchLsbExpressions(query);
  const listVisible = catalogOpen;
  const draftChangedSinceResolution =
    resolutionDraft !== null &&
    normalizeSpanish(resolutionDraft) !== normalizeSpanish(draft);
  const visibleResolution = draftChangedSinceResolution ? null : resolution;

  function resolve(value: string, sourceDraft?: string) {
    const next = resolveLsbExpression(value);
    setResolution(next);
    setResolutionDraft(sourceDraft ?? null);
    const expression = next.status === "matched" ? next.expression : null;
    if (sourceDraft === undefined) onResolved?.(expression);
    else onResolved?.(expression, sourceDraft);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resolve(query);
  }

  function handleUseDraft() {
    setQuery(draft);
    resolve(draft, draft);
  }

  function handleSelect(expression: LsbExpression) {
    setQuery(expression.spanish);
    resolve(expression.spanish);
    setCatalogOpen(false);
  }

  return (
    <section
      className="panel-card lsb-catalog-card"
      aria-labelledby="lsb-catalog-title"
    >
      <header className="compact-card-heading">
        <div className="inline-title">
          <Hand size={17} aria-hidden="true" />
          <h2 id="lsb-catalog-title">Catálogo LSB</h2>
        </div>
        <span className="demo-label">Módulo 1</span>
      </header>

      <p className="help-text">
        {LSB_EXPRESSIONS.length} saludos documentados en {LSB_SOURCE.section}{" "}
        (páginas {LSB_SOURCE.pages}; índice p. {LSB_SOURCE.indexPage}). La
        fuente no incluye glosas escritas ni animaciones 3D.
      </p>

      <form className="lsb-lookup" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="lsb-query">
          Buscar expresión documentada
        </label>
        <div className="search-field">
          <Search size={15} aria-hidden="true" />
          <input
            id="lsb-query"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setResolution(null);
              setResolutionDraft(null);
              onResolved?.(null);
            }}
            placeholder="Ej. Hola, Gracias, ¿Cómo estás?"
            autoComplete="off"
          />
        </div>
        <div className="lsb-actions">
          <Button size="small" variant="secondary" type="submit">
            Buscar en el catálogo
          </Button>
          <Button
            size="small"
            variant="ghost"
            onClick={handleUseDraft}
            disabled={!draft.trim()}
          >
            Usar el borrador
          </Button>
        </div>
      </form>

      <div className="sr-only" role="status" aria-live="polite">
        {draftChangedSinceResolution ? "" : announce(visibleResolution)}
      </div>

      {draftChangedSinceResolution ? (
        <p className="composer-notice" role="status">
          El borrador cambió desde la búsqueda. Vuelve a usarlo para actualizar
          la expresión que se mostrará en el avatar.
        </p>
      ) : null}

      {visibleResolution?.status === "matched" ? (
        <article
          className="lsb-result"
          aria-label={`Ficha de ${visibleResolution.expression.spanish}`}
        >
          <div className="lsb-result-heading">
            <strong>{visibleResolution.expression.spanish}</strong>
            <span className="lsb-result-badge">Documentado</span>
          </div>
          <dl className="lsb-facts">
            <div>
              <dt>Fuente</dt>
              <dd>{LSB_SOURCE.document}</dd>
            </div>
            <div>
              <dt>Sección</dt>
              <dd>
                {LSB_SOURCE.section} · p. {visibleResolution.expression.page}
              </dd>
            </div>
            <div>
              <dt>Glosa escrita</dt>
              <dd>No documentada</dd>
            </div>
            <div>
              <dt>Ilustración</dt>
              <dd>Disponible en el PDF original; no se redistribuye</dd>
            </div>
            <div>
              <dt>Animación 3D</dt>
              <dd>
                {visibleResolution.expression.animationStatus === "provisional"
                  ? "Provisional (sin revisión)"
                  : "No disponible"}
              </dd>
            </div>
            <div>
              <dt>Validación</dt>
              <dd>
                {LSB_VALIDATION_LABELS[visibleResolution.expression.validation]}
              </dd>
            </div>
          </dl>
          <p className="help-text">{LSB_GLOSS_NOTE}</p>
          <p className="help-text">{LSB_ANIMATION_NOTE}</p>
          <p className="help-text">{LSB_SOURCE.rights}</p>
        </article>
      ) : null}

      {visibleResolution?.status === "unknown" ? (
        <p className="composer-notice">
          No hay una expresión documentada en el catálogo para «
          {query.trim() || visibleResolution.normalizedInput}». El sistema no
          inventa traducciones ni glosas: reformula la frase o consulta una de{" "}
          {LSB_EXPRESSIONS.length} expresiones disponibles.
        </p>
      ) : null}

      {visibleResolution?.status === "empty" ? (
        <p className="composer-notice">
          Escribe o dicta una frase en «Redactar respuesta» y usa «Usar el
          borrador» para consultarla.
        </p>
      ) : null}

      <button
        className="lsb-catalog-toggle"
        type="button"
        aria-expanded={listVisible}
        aria-controls="lsb-catalog-list"
        onClick={() => setCatalogOpen((open) => !open)}
      >
        {listVisible
          ? "Ocultar catálogo"
          : `Ver los ${LSB_EXPRESSIONS.length} saludos`}
      </button>

      {listVisible ? (
        <div
          className="frequent-phrases"
          id="lsb-catalog-list"
          aria-label="Expresiones documentadas"
        >
          {matches.length === 0 ? (
            <p className="help-text">
              Ningún saludo documentado coincide con «{query.trim()}».
            </p>
          ) : (
            matches.map((expression) => (
              <button
                key={expression.id}
                type="button"
                aria-label={`Ver ficha de ${expression.spanish}`}
                onClick={() => handleSelect(expression)}
              >
                <span>{expression.spanish}</span>
                <span className="lsb-catalog-source" aria-hidden="true">
                  p. {expression.page}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
