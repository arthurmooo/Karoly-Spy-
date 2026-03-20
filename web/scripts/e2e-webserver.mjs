import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getSafeWebDir } from "./safe-path.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const safeWebDir = getSafeWebDir();
const projectDir = path.resolve(scriptDir, "..", "..");
const tempDir = path.join(projectDir, ".tmp");
const functionsEnvPath = path.join(tempDir, "e2e-functions.env");
const supabaseBin = process.env.SUPABASE_BIN || "supabase";
const shell = process.env.SHELL || "/bin/sh";
const childProcesses = [];

function shellEscape(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function spawnCommand(command, cwd, extraEnv = {}, { wait = true, label = command } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(shell, ["-lc", `cd -L ${shellEscape(cwd)} && exec ${command}`], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
    });

    childProcesses.push(child);

    if (!wait) {
      resolve(child);
      return;
    }

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} exited with signal ${signal}`));
        return;
      }
      if (code === 0) {
        resolve(child);
        return;
      }
      reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

function readCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(shell, ["-lc", `cd -L ${shellEscape(cwd)} && ${command}`], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function parseEnvOutput(raw) {
  function normalizeValue(value) {
    const trimmed = value.trim();
    if (
      trimmed.length >= 2 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }

  return Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), normalizeValue(line.slice(index + 1))];
      })
  );
}

async function waitForCommand(command, cwd, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await readCommand(command, cwd);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  throw new Error(`Timed out waiting for: ${command}`);
}

function shutdown(signal = "SIGTERM") {
  for (const child of childProcesses.reverse()) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(signal);
    process.exit(0);
  });
}

process.on("exit", () => shutdown("SIGTERM"));

async function main() {
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await spawnCommand(`${supabaseBin} stop --no-backup`, projectDir, {}, { label: "supabase stop" });
  } catch {
    // Ignore if the local stack was not already running.
  }

  await spawnCommand(`${supabaseBin} start`, projectDir, {}, { label: "supabase start" });
  await waitForCommand(`${supabaseBin} status -o env`, projectDir);

  const envOutput = await waitForCommand(`${supabaseBin} status -o env`, projectDir);
  const env = parseEnvOutput(envOutput);
  const apiUrl = env.API_URL || env.SUPABASE_URL;
  const anonKey = env.ANON_KEY || env.SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase local env after `supabase status -o env`.");
  }

  fs.writeFileSync(
    functionsEnvPath,
    [
      `SUPABASE_URL=${apiUrl}`,
      `SUPABASE_ANON_KEY=${anonKey}`,
      `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    ].join("\n")
  );

  await spawnCommand(
    "node ./web/scripts/e2e-auth-fixtures.mjs",
    projectDir,
    {
      SUPABASE_URL: apiUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    },
    { label: "e2e auth fixtures" }
  );

  await spawnCommand(
    `${supabaseBin} functions serve --no-verify-jwt --env-file ${shellEscape(functionsEnvPath)}`,
    projectDir,
    {},
    { wait: false, label: "supabase functions serve" }
  );

  await spawnCommand(
    "npx vite --port=3100 --host 127.0.0.1 --strictPort",
    safeWebDir,
    {
      VITE_SUPABASE_URL: apiUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
      PLAYWRIGHT_E2E: "1",
    },
    { label: "vite dev server" }
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
