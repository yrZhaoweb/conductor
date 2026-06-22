#!/usr/bin/env node

process.stdout.write(JSON.stringify({
  schemaVersion: 1,
  taskId: process.env.CONDUCTOR_ACCEPTANCE_TASK_ID || "P1-ACC-01",
  batch: Number(process.env.CONDUCTOR_ACCEPTANCE_BATCH || "0"),
  judgment: "PASS",
  criteria: [
    {
      id: "C1",
      status: "pass",
      evidenceRefs: ["reports/P1-IMPL-01.md"]
    }
  ],
  rerunRefs: ["reports/P1-IMPL-01.md"],
  gaps: [],
  residuals: [],
  notes: "fixture tries to use implementer report"
}));
