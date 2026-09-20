# Execution

This document describes role executions: what one invocation is, what must be logged, and how failure/retry interacts with the execution plan.

`SPEC.md` is authoritative. Prefer this file when changing execution records, event logging, or the QA retry loop. See `docs/runtime.md` for orchestration around executions and `docs/roles.md` for role configuration.

---

## Purpose

A **role execution** is one invocation of a role against a specific work item.

It combines:

- role identity and instructions
- work-item and project context
- configured model/provider
- tools
- permission policy (enforced by the runtime)

It does **not** imply a permanently running autonomous agent. The same role may execute multiple times on one work item.

```text
Role + context + instructions + model + tools + permissions
      ↓
Role Execution
      ↓
Artifacts / tool calls / result
```

---

## Place in the flow

```text
Execution Plan (immutable steps)
      ↓
Role Execution (per step, possibly repeated)
      ↓
Artifacts / State / Events / executions/<id>/
```

The execution plan defines the role order. Retry re-enters steps (typically Developer → QA) without rewriting the plan. See `docs/workflows.md`.

---

## Logging requirements

Every role execution should record enough to reproduce and debug what happened.

At minimum:

- execution ID
- work-item ID
- project
- role
- workflow (template / plan identity)
- step
- attempt
- provider
- model
- team/runtime version
- input context
- output
- tool calls
- permission decisions
- changed files
- status
- failure reason
- timestamp

The system should make it possible to answer:

- What role ran?
- Which model ran it?
- What did it receive?
- What tools did it call?
- Which operations were denied?
- What files changed?
- Why did it fail?

### On-disk shape

```text
runtime/
├── state.json
├── execution-plan.json
├── events.jsonl
└── executions/
    ├── 001/
    ├── 002/
    └── 003/
```

- `executions/<id>/` — immutable record for one role execution
- `events.jsonl` — append-only stream of notable events across the work item
- `state.json` — current aggregate state (mutable), not a substitute for history

---

## Failure and retry

If a QA result has `status: failed`, the default MVP loop is:

```text
QA result: failed
   ↓
Developer
   ↓
QA
```

### Counting attempts

- An **attempt** is one Developer execution against this work item.
- Attempt 1 runs as part of the initial workflow.
- After each QA failure the runtime may run another Developer execution — that is the next attempt.
- Maximum: **3 attempts in total** (the initial Developer execution + up to 2 retries).
- After the third attempt fails its QA, set the work-item status to `human_required` and stop for human intervention.
- The runtime must preserve all attempts and their logs.
- QA failure details must be available to the next Developer execution (via artifacts/state, not hidden memory).

Sequence when all attempts fail:

```text
Developer #1 → QA #1: failed → Developer #2 → QA #2: failed → Developer #3 → QA #3: failed → work-item status: human_required
```

Conceptual control flow:

```text
QA result: failed
   ↓
attempt < 3?
   ├── yes → Developer (next attempt) → QA
   └── no  → work-item status: human_required
```

The QA runs that verify each attempt are recorded as their own executions but are not counted as attempts; only Developer executions count toward the limit.

The persisted work-item outcome enum is `passed | failed | cancelled | human_required`. If execution is stopped or the target application/process crashes, persist `cancelled`; if an unrecoverable role, tool, or runtime failure prevents continuation, persist `failed`. See `docs/work-items.md` and `SPEC.md` §11 for the complete status contract.

Completed work items are not re-run as full workflows for regression. QA may attach regression checks (with provenance to a source feature/bug) that later work items can execute. See `SPEC.md` §17.

---

## Mock executions first

Before a real LLM provider is required, the runtime should support mock role executions that:

- run a complete workflow without an external API
- produce artifacts
- advance state
- emit execution events
- can fail and stop the workflow deterministically

That keeps orchestration and logging testable independently of vendor APIs. See `docs/runtime.md` and `docs/development.md`.

---

## Boundaries

| Concern                              | Owner                    |
| ------------------------------------ | ------------------------ |
| One invocation’s inputs/outputs/logs | Execution                |
| Ordering and when to invoke          | Runtime + execution plan |
| Allow/deny for tools                 | Permissions              |
| Durable files                        | Storage                  |

Do not:

- rely on cross-execution chat memory instead of artifacts and recorded state
- mutate past execution records
- silently drop denied tool calls without a structured result and log
- reopen completed work items as containers to “re-run the old workflow” for regression

---

## Invariants

1. A role execution is a single invocation, not a long-lived agent process.
2. Execution history is inspectable: events append-only; per-execution dirs immutable.
3. Retry preserves prior attempts; it does not erase them.
4. Permission decisions are part of the execution record.
5. Provider and model used for the invocation are recorded.
6. After three failed implementation attempts, stop for a human; do not loop forever.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/runtime.md`      | Orchestration and tool execution             |
| `docs/storage.md`      | Filesystem layout for records                |
| `docs/workflows.md`    | Plans and retry vs plan immutability         |
| `docs/roles.md`        | Role configuration                           |
| `docs/permissions.md`  | Enforcement on tool calls                    |
| `docs/development.md`  | Local development and testing practices      |
| `AGENTS.md`            | Working rules for agents modifying this repo |
