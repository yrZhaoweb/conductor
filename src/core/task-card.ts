import { readJsonFile } from "./json.js";
import { EXIT, HarnessError } from "./errors.js";

export type TaskCard = {
  schemaVersion: 1;
  taskId: string;
  role: string;
  batch: number;
  mode: string;
  status: string;
  objective: string;
  scope: string;
  allowedPaths: string[];
  readPaths?: string[];
  nonGoals?: string[];
  redLines?: string[];
  redLineTriggered?: boolean;
  dependsOn?: string[];
  expectedEvidence?: string[];
  reportPath?: string;
};

export function readTaskCard(taskPath: string): TaskCard {
  const task = readJsonFile<TaskCard>(taskPath);
  if (task.schemaVersion !== 1) {
    throw new HarnessError(EXIT.USAGE, "Unsupported task card schema");
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(task.taskId)) {
    throw new HarnessError(EXIT.USAGE, `Invalid task id: ${task.taskId}`);
  }
  if (!Array.isArray(task.allowedPaths)) {
    throw new HarnessError(EXIT.USAGE, "Task allowedPaths must be an array");
  }
  return task;
}
