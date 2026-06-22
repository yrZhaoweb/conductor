#!/usr/bin/env node
import { acceptRun } from "./commands/accept.js";
import { batchCheck, batchStart } from "./commands/batch.js";
import { initRun } from "./commands/init.js";
import { installHook, mintOverride, redlinesCheck } from "./commands/redlines.js";
import { workerCheckPaths, workerMerge, workerStart } from "./commands/worker.js";
import { EXIT, HarnessError } from "./core/errors.js";
import { resolvePath } from "./core/paths.js";

type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string[]>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith("--") ? next : "true";
    if (next && !next.startsWith("--")) {
      i += 1;
    }
    const values = flags.get(key) ?? [];
    values.push(value);
    flags.set(key, values);
  }
  return { positionals, flags };
}

function one(args: ParsedArgs, key: string, fallback?: string): string {
  const values = args.flags.get(key);
  const value = values?.[values.length - 1] ?? fallback;
  if (value === undefined) {
    throw new HarnessError(EXIT.USAGE, `Missing --${key}`);
  }
  return value;
}

function many(args: ParsedArgs, key: string): string[] {
  return args.flags.get(key) ?? [];
}

function numberFlag(args: ParsedArgs, key: string): number {
  const value = Number(one(args, key));
  if (!Number.isInteger(value) || value < 0) {
    throw new HarnessError(EXIT.USAGE, `Invalid --${key}`);
  }
  return value;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const [command, subcommand] = args.positionals;
  if (command === "init") {
    initRun(resolvePath(one(args, "run-root")), resolvePath(one(args, "repo")), one(args, "mode", "auto"));
    return;
  }
  if (command === "batch" && subcommand === "start") {
    batchStart(resolvePath(one(args, "run-root")), numberFlag(args, "batch"));
    return;
  }
  if (command === "batch" && subcommand === "check") {
    batchCheck(resolvePath(one(args, "run-root")), numberFlag(args, "batch"));
    return;
  }
  if (command === "accept" && subcommand === "run") {
    acceptRun({
      runRoot: resolvePath(one(args, "run-root")),
      repo: resolvePath(one(args, "repo")),
      batch: numberFlag(args, "batch"),
      taskId: one(args, "task"),
      criteria: one(args, "criteria"),
      reruns: many(args, "rerun"),
      runtime: one(args, "runtime", "codex"),
      runtimeCommand: args.flags.get("runtime-command")?.at(-1)
    });
    return;
  }
  if (command === "redlines" && subcommand === "check") {
    redlinesCheck(resolvePath(one(args, "repo")), resolvePath(one(args, "run-root")));
    return;
  }
  if (command === "redlines" && subcommand === "install-hook") {
    installHook(resolvePath(one(args, "repo")), resolvePath(one(args, "run-root")));
    return;
  }
  if (command === "redlines" && subcommand === "override" && args.positionals[2] === "mint") {
    const token = mintOverride(
      resolvePath(one(args, "run-root")),
      one(args, "reason"),
      args.flags.has("yes"),
      Number(one(args, "expires-minutes", "15"))
    );
    console.log(token);
    return;
  }
  if (command === "worker" && subcommand === "start") {
    workerStart(resolvePath(one(args, "run-root")), resolvePath(one(args, "repo")), resolvePath(one(args, "task")));
    return;
  }
  if (command === "worker" && subcommand === "merge") {
    workerMerge(resolvePath(one(args, "run-root")), resolvePath(one(args, "repo")), one(args, "task"));
    return;
  }
  if (command === "worker" && subcommand === "check-paths") {
    workerCheckPaths(resolvePath(one(args, "run-root")), resolvePath(one(args, "repo")), one(args, "task"));
    return;
  }
  throw new HarnessError(EXIT.USAGE, `Unknown command: ${args.positionals.join(" ")}`);
}

try {
  main();
} catch (error) {
  if (error instanceof HarnessError) {
    console.error(error.message);
    process.exit(error.code);
  }
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(EXIT.USAGE);
}
