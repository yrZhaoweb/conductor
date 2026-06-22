import { spawnSync } from "node:child_process";
import path from "node:path";
import { writeFileAtomic, writeJsonFile } from "./json.js";
import { ensureDir, safeJoin, toRunRelative } from "./paths.js";
import { sha256 } from "./signatures.js";

export type RerunLog = {
  id: string;
  command: string;
  cwd: string;
  path: string;
  metadataPath: string;
  exitCode: number | null;
  sha256: string;
  startedAt: string;
  endedAt: string;
};

export function runReruns(runRoot: string, repo: string, batch: number, commands: string[]): RerunLog[] {
  const rerunDir = safeJoin(runRoot, "batches", String(batch), "acceptance", "reruns");
  ensureDir(rerunDir);
  return commands.map((command, index) => {
    const id = `R${index + 1}`;
    const startedAt = new Date().toISOString();
    const result = spawnSync(command, {
      cwd: repo,
      encoding: "utf8",
      shell: true
    });
    const endedAt = new Date().toISOString();
    const logText = [
      `Command: ${command}`,
      `Cwd: ${repo}`,
      `ExitCode: ${result.status ?? "null"}`,
      `StartedAt: ${startedAt}`,
      `EndedAt: ${endedAt}`,
      "",
      "STDOUT:",
      result.stdout || "",
      "",
      "STDERR:",
      result.stderr || ""
    ].join("\n");
    const logPath = path.join(rerunDir, `${id}.log`);
    const metadataPath = path.join(rerunDir, `${id}.json`);
    writeFileAtomic(logPath, logText);
    const metadata: RerunLog = {
      id,
      command,
      cwd: repo,
      path: toRunRelative(runRoot, logPath),
      metadataPath: toRunRelative(runRoot, metadataPath),
      exitCode: result.status,
      sha256: sha256(logText),
      startedAt,
      endedAt
    };
    writeJsonFile(metadataPath, metadata);
    return metadata;
  });
}
