import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { corpusFixture, runFixture } from "./fixtures.mjs";

test("CLI audits and evaluates local JSON, uses defined exit codes and does not echo paths or private content", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lsb-evaluation-"));
  const cli = fileURLToPath(new URL("../src/evaluation/cli.mjs", import.meta.url));
  try {
    const corpusPath = path.join(directory, "corpus.json"); const runPath = path.join(directory, "run.json");
    const corpus = corpusFixture();
    await writeFile(corpusPath, JSON.stringify(corpus)); await writeFile(runPath, JSON.stringify(runFixture(corpus)));
    const run = (command = "evaluate") => spawnSync(process.execPath, [cli, command, corpusPath, ...(command === "evaluate" ? [runPath] : [])], { encoding: "utf8" });
    const result = run();
    assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).evidence, "synthetic");
    assert.equal(JSON.parse(result.stdout).promotion, "not-evaluated");
    assert.equal(run("audit").status, 0);
    corpus.clips[0].authorizationStatus = "withdrawn";
    await writeFile(corpusPath, JSON.stringify(corpus)); await writeFile(runPath, JSON.stringify(runFixture(corpus)));
    assert.equal(run("audit").status, 2);
    const blocked = run(); assert.equal(blocked.status, 2); assert.equal(blocked.stdout, "");
    await writeFile(runPath, "private-content");
    const invalid = run(); assert.equal(invalid.status, 1);
    assert.equal(invalid.stderr.includes(directory), false); assert.equal(invalid.stderr.includes("private-content"), false);
    await truncate(runPath, 8 * 1024 * 1024 + 1);
    assert.equal(run().status, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
