import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const projectDir = path.dirname(webDir);
const safeProjectLink = path.join(path.dirname(projectDir), ".projectk_web_safe");

function ensureSafeProjectLink() {
  try {
    const stat = fs.lstatSync(safeProjectLink);
    if (stat.isSymbolicLink()) {
      const currentTarget = path.resolve(path.dirname(safeProjectLink), fs.readlinkSync(safeProjectLink));
      if (currentTarget === projectDir) {
        return path.join(safeProjectLink, "web");
      }
    }
    fs.rmSync(safeProjectLink, { recursive: true, force: true });
  } catch {
    // Link does not exist yet.
  }

  try {
    fs.symlinkSync(projectDir, safeProjectLink, "dir");
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
      throw error;
    }
  }

  return path.join(safeProjectLink, "web");
}

export function getSafeWebDir() {
  return ensureSafeProjectLink();
}
