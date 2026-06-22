import { mkdirSync } from "node:fs";
import path from "node:path";
import { EXIT, HarnessError } from "./errors.js";

export function resolvePath(input: string): string {
  return path.resolve(input);
}

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function safeJoin(root: string, ...parts: string[]): string {
  const resolvedRoot = path.resolve(root);
  const joined = path.resolve(resolvedRoot, ...parts);
  const relative = path.relative(resolvedRoot, joined);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return joined;
  }
  throw new HarnessError(EXIT.USAGE, `Path escapes run root: ${parts.join("/")}`);
}

export function toRunRelative(runRoot: string, filePath: string): string {
  const relative = path.relative(path.resolve(runRoot), path.resolve(filePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HarnessError(EXIT.USAGE, `Path is outside run root: ${filePath}`);
  }
  return relative.split(path.sep).join("/");
}
