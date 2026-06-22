import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeFileAtomic(filePath: string, contents: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, contents);
  renameSync(tempPath, filePath);
}
