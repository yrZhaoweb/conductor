# Harness Usage

Build once:

```bash
npm install
npm run build
```

Create a run:

```bash
RUN_ROOT=.conductor/runs/20260622-demo
conductor-harness init --repo "$PWD" --run-root "$RUN_ROOT" --mode auto
```

Install red-line commit protection:

```bash
conductor-harness redlines install-hook --repo "$PWD" --run-root "$RUN_ROOT"
```

Start a batch:

```bash
conductor-harness batch start --run-root "$RUN_ROOT" --batch 0
```

Run acceptance with first-hand rerun evidence:

```bash
conductor-harness accept run --repo "$PWD" --run-root "$RUN_ROOT" --batch 0 \
  --task P0-ACC-01 \
  --criteria "Batch 0 Acceptance Criteria" \
  --rerun "npm test" \
  --runtime command \
  --runtime-command "node test/fixtures/acceptance-pass.cjs"
```

Advance only through the gate:

```bash
conductor-harness batch start --run-root "$RUN_ROOT" --batch 1
```

Worker isolation:

```bash
conductor-harness worker start --repo "$PWD" --run-root "$RUN_ROOT" \
  --task "$RUN_ROOT/tasks/P1-IMPL-01.json"
conductor-harness worker merge --repo "$PWD" --run-root "$RUN_ROOT" --task P1-IMPL-01
```

The manager follows exit codes. A non-zero exit means the harness did not open that gate.
