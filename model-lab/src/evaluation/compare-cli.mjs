import { readFile, stat } from "node:fs/promises";
import { compareRuns } from "./compare-runs.mjs";
import { EvaluationInputError } from "./contracts.mjs";

async function readJson(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new EvaluationInputError("invalid-file");
  return JSON.parse(await readFile(file, "utf8"));
}

try {
  const [corpusFile, baselineFile, candidateFile, extra] = process.argv.slice(2);
  if (!corpusFile || !baselineFile || !candidateFile || extra) throw new EvaluationInputError("invalid-arguments");
  console.log(JSON.stringify(compareRuns(
    await readJson(corpusFile), await readJson(baselineFile), await readJson(candidateFile),
  ), null, 2));
} catch (cause) {
  const allowed = new Set(["invalid-format", "invalid-file", "invalid-arguments", "corpus-mismatch", "sample-mismatch", "incomplete-results", "corpus-not-ready", "comparison-mismatch"]);
  const code = cause instanceof EvaluationInputError && allowed.has(cause.code) ? cause.code : "invalid-input";
  console.error(`No se pudo comparar la evaluación (${code}). No se muestran rutas, contenidos ni identificadores.`);
  process.exitCode = ["corpus-not-ready", "comparison-mismatch"].includes(code) ? 2 : 1;
}
