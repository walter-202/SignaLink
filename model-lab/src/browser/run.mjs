import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const configArgument = process.argv[2];
if (!configArgument || process.argv.length !== 3) {
  console.error("Uso: pnpm run:recognition-browser -- model-lab/datasets/private/browser-run.json");
  process.exit(1);
}

try {
  const appDir = path.join(repoRoot, "apps", "web");
  const resolvedConfig = path.resolve(configArgument);
  const childEnv = { ...process.env, SIGNALINK_MODEL_LAB_RUNNER_CONFIG: resolvedConfig };
  if (!childEnv.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && existsSync("/usr/bin/chromium")) {
    childEnv.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "/usr/bin/chromium";
  }
  const child = spawn("pnpm", ["exec", "playwright", "test", "tests/e2e/model-lab-browser-runner.spec.ts",
    "--project=desktop-chromium", "--workers=1"], {
    cwd: appDir,
    env: childEnv,
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  } else {
    console.log("Runner emparejado completado; los registros y su comparación se guardaron localmente.");
  }
} catch {
  console.error("No se pudo completar la ejecución y comparación. Los registros existentes no se sobrescriben.");
  process.exitCode = 1;
}
