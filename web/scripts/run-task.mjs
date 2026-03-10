import { spawn } from "node:child_process";
import { getSafeWebDir } from "./safe-path.mjs";

const task = process.argv[2];

if (!task) {
  console.error("Missing npm task name.");
  process.exit(1);
}

const cwd = getSafeWebDir();
const shell = process.env.SHELL || "/bin/sh";

function shellEscape(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(shell, ["-c", `cd -L ${shellEscape(cwd)} && ${script}`], {
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command exited with signal ${signal}`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command exited with code ${code ?? "unknown"}`));
    });
  });
}

function runLong(script) {
  const child = spawn(shell, ["-c", `cd -L ${shellEscape(cwd)} && exec ${script}`], {
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

try {
  switch (task) {
    case "dev":
      runLong("npx vite --port=3000 --host 127.0.0.1 --strictPort");
      break;
    case "typecheck":
      await run("npx tsc --noEmit");
      process.exit(0);
      break;
    case "build":
      await run("npx tsc -b");
      await run("npx vite build");
      process.exit(0);
      break;
    default:
      console.error(`Unsupported task: ${task}`);
      process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
