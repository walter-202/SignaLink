import { readFile, stat } from "node:fs/promises";
import { auditCorpus } from "../collection/audit-corpus.mjs";
import { evaluateRun } from "./evaluate-run.mjs";
import { EvaluationInputError } from "./contracts.mjs";

async function readJson(file) {
  const info = await stat(file);
  if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new EvaluationInputError("invalid-file");
  return JSON.parse(await readFile(file, "utf8"));
}

try {
  const [command, corpusFile, runFile, extra] = process.argv.slice(2);
  if (!corpusFile || extra || !["audit", "evaluate"].includes(command) || (command === "evaluate" ? !runFile : Boolean(runFile))) {
    throw new EvaluationInputError("invalid-arguments");
  }
  const corpus = await readJson(corpusFile);
  const result = command === "audit" ? auditCorpus(corpus) : evaluateRun(corpus, await readJson(runFile));
  console.log(JSON.stringify(result, null, 2));
  if (!result.metadataReady) process.exitCode = 2;
} catch (cause) {
  const allowed = new Set(["invalid-format", "invalid-file", "invalid-arguments", "corpus-mismatch", "sample-mismatch", "incomplete-results", "corpus-not-ready"]);
  const code = cause instanceof EvaluationInputError && allowed.has(cause.code) ? cause.code : "invalid-input";
  console.error(`No se pudo procesar la evaluación (${code}). Usa manifiestos JSON v1 locales; no se muestran rutas, contenidos ni identificadores.`);
  process.exitCode = code === "corpus-not-ready" ? 2 : 1;
}
