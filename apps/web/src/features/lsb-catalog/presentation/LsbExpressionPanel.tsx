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
import { resolveAnimationClip } from "../application/resolve-animation";

interface LsbExpressionPanelProps {
  draft: string;
  availableModelClips?: readonly string[] | null;
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

function animationAvailability(
  expression: LsbExpression,
  availableModelClips: readonly string[] | null,
): string {
  if (!expression.animationClipId) return "Sin clip asignado";
  if (availableModelClips !== null) {
    return resolveAnimationClip(availableModelClips, expression.animationClipId)
      ? "Disponible en este modelo"
      : "No está en este modelo";
  }
  return expression.animationStatus === "provisional"
    ? "Clip provisional"
    : "No incluido en la app";
}

export function LsbExpressionPanel({
  draft,
  availableModelClips = null,
  onResolved,
}: LsbExpressionPanelProps) {
  const [query, setQuery] = useState("");
  const [resolution, setResolution] = useState<LsbResolution | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const matches = searchLsbExpressions(query);
  const draftResolution = resolveLsbExpression(draft);
  const hasDraftMatch = draftResolution.status === "matched";
  const listVisible = catalogOpen;
  const manualResolutionIsCurrent =
    resolutionDraft !== null &&
    normalizeSpanish(resolutionDraft) === normalizeSpanish(draft);
  const draftChangedSinceResolution =
    resolutionDraft !== null && !manualResolutionIsCurrent;
  const visibleResolution = manualResolutionIsCurrent
    ? resolution
    : hasDraftMatch
      ? draftResolution
      : null;
  const manualBrowseDiffersFromDraft =
    manualResolutionIsCurrent &&
    hasDraftMatch &&
    resolution?.status === "matched" &&
    resolution.expression.id !== draftResolution.expression.id;

  function resolve(value: string, sourceDraft = draft) {
    const next = resolveLsbExpression(value);
    setResolution(next);
    setResolutionDraft(sourceDraft);
    const expression = next.status === "matched" ? next.expression : null;
    onResolved?.(expression, sourceDraft);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resolve(query, draft);
  }

  function handleSelect(expression: LsbExpression) {
    setQuery(expression.spanish);
    resolve(expression.spanish, draft);
    setCatalogOpen(false);
  }

  function availabilityClass(expression: LsbExpression): string {
    if (availableModelClips !== null) {
      return resolveAnimationClip(availableModelClips, expression.animationClipId)
        ? "lsb-catalog-availability lsb-catalog-availability--available"
        : "lsb-catalog-availability lsb-catalog-availability--missing";
    }
    return expression.animationStatus === "provisional"
      ? "lsb-catalog-availability lsb-catalog-availability--provisional"
      : "lsb-catalog-availability lsb-catalog-availability--missing";
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

      <p className="help-text lsb-catalog-intro">
        {LSB_EXPRESSIONS.length} saludos documentados. Una coincidencia exacta
        muestra aquí la expresión; el catálogo no traduce frases nuevas.
      </p>

      <form className="lsb-lookup" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="lsb-query">
          Buscar expresión
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
            placeholder="Ej. Hola, Gracias"
            autoComplete="off"
          />
          <Button size="small" variant="secondary" type="submit">
            Buscar
          </Button>
        </div>
      </form>

      <div className="sr-only" role="status" aria-live="polite">
        {draftChangedSinceResolution && !hasDraftMatch
          ? ""
          : announce(visibleResolution)}
      </div>

      {draftChangedSinceResolution && !hasDraftMatch ? (
        <p className="composer-notice" role="status">
          El borrador cambió. La vista previa se actualizará cuando coincida
          exactamente con una expresión del catálogo.
        </p>
      ) : null}

      {manualBrowseDiffersFromDraft && draftResolution.status === "matched" ? (
        <p className="composer-notice">
          Exploración manual: la vista 3D sigue la expresión exacta del borrador
          («{draftResolution.expression.spanish}»).
        </p>
      ) : null}

      {visibleResolution?.status === "matched" ? (
        <article
          className="lsb-result"
          aria-label={`Ficha de ${visibleResolution.expression.spanish}`}
        >
          <div className="lsb-result-heading">
            <div className="lsb-result-title">
              <strong>{visibleResolution.expression.spanish}</strong>
              <span className="lsb-result-page">
                {LSB_SOURCE.section} · p. {visibleResolution.expression.page}
              </span>
            </div>
            <span className="lsb-result-badge">Documentado</span>
          </div>
          <dl className="lsb-facts">
            <div>
              <dt>Animación 3D</dt>
              <dd>
                {animationAvailability(
                  visibleResolution.expression,
                  availableModelClips,
                )}
              </dd>
            </div>
            <div>
              <dt>Validación</dt>
              <dd>
                {LSB_VALIDATION_LABELS[visibleResolution.expression.validation]}
              </dd>
            </div>
          </dl>
          <details className="lsb-source-details">
            <summary>Fuente y alcance</summary>
            <p>
              {LSB_SOURCE.document}, {LSB_SOURCE.section}, página{" "}
              {visibleResolution.expression.page}. El índice del módulo está en
              la página {LSB_SOURCE.indexPage}.
            </p>
            <p>{LSB_GLOSS_NOTE}</p>
            <p>{LSB_ANIMATION_NOTE}</p>
            <p>{LSB_SOURCE.rights}</p>
          </details>
        </article>
      ) : null}

      {visibleResolution?.status === "unknown" ? (
        <p className="composer-notice">
          No hay una expresión documentada en el catálogo para «
          {query.trim() || visibleResolution.normalizedInput}». No se inventan
          traducciones ni glosas; consulta una de las {LSB_EXPRESSIONS.length}{" "}
          expresiones disponibles.
        </p>
      ) : null}

      {visibleResolution?.status === "empty" ? (
        <p className="composer-notice">
          Escribe una expresión exacta en «Redactar respuesta» o búscala en el
          catálogo para revisar su ficha.
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
          ? "Ocultar expresiones"
          : `Ver las ${LSB_EXPRESSIONS.length} expresiones`}
      </button>

      {listVisible ? (
        <div
          className="frequent-phrases lsb-catalog-list"
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
                aria-label={
                  `Ver ficha de ${expression.spanish}; ` +
                  animationAvailability(expression, availableModelClips)
                }
                onClick={() => handleSelect(expression)}
              >
                <span className="lsb-catalog-row-title">
                  <strong>{expression.spanish}</strong>
                  <small>p. {expression.page}</small>
                </span>
                <span className={availabilityClass(expression)}>
                  {availableModelClips === null &&
                  expression.animationStatus === "provisional"
                    ? "3D provisional"
                    : availableModelClips === null
                      ? "No integrado"
                      : resolveAnimationClip(
                            availableModelClips,
                            expression.animationClipId,
                          )
                        ? "Disponible"
                        : "Sin clip"}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
