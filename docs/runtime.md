# Runtime

This document describes the runtime: orchestration, tool execution, provider abstraction, and target-project integration.

`SPEC.md` is authoritative. Prefer this file when changing how work items are driven end-to-end. See `docs/execution.md` for a single role invocation and logging, `docs/permissions.md` for the check on every tool call, and `docs/storage.md` for persistence.

---

## Purpose

The **runtime** orchestrates workflow execution and executes tools. It is not an LLM and not a permanent multi-agent chat room.

It owns:

- loading project and work-item context
- resolving workflow templates into execution plans
- loading role configuration
- invoking role executions in plan order (including retry loops)
- routing tool calls through permission checks
- persisting artifacts, state, and logs
- integrating with the replaceable target project (including Git)

```text
Work Item
    ↓
Workflow Template
    ↓
Execution Plan
    ↓
Role Execution
    ↓
LLM + Context + Tools
    ↓
Permission Check
    ↓
Tool Execution
    ↓
Artifacts / State / Logs
```

---

## Core responsibilities

| Responsibility          | Notes                                                 |
| ----------------------- | ----------------------------------------------------- |
| Load work item          | Identity, artifacts, prior state                      |
| Load / resolve workflow | Explicit template → immutable plan                    |
| Load roles              | Manifests + instructions for each step                |
| Execute steps           | One shared role-execution mechanism                   |
| Pass context            | Project, work item, relevant artifacts, prior results |
| Enforce permissions     | Every tool call; never prompt-only                    |
| Persist                 | `state.json`, events, execution records, artifacts    |
| Handle errors           | Stop, retry, or require human intervention per policy |
| Target project          | Start/stop app when needed; Git branch / PR-ready     |

MVP implementation order in the backlog is intentional: prove the loop with a **mock provider** before wiring a real LLM.

---

## Provider abstraction

The core runtime must not depend on a specific LLM vendor.

```text
Runtime
   ↓
LLM Provider Interface
   ↓
Provider implementation (mock | OpenRouter | …)
```

- OpenRouter is the initial real provider, not the architecture.
- Roles select model/provider through configuration.
- Request/response shapes, tool-call representation, and provider errors belong behind the interface.
- Record provider and model on each execution for debugging.

---

## Tool execution

LLM tool calls are executed locally by the runtime after permission checks.

MVP tool families include filesystem, terminal, and Git. The browser interface and its permission model are also MVP capabilities only when required by the selected QA workflow.

| Family                          | Examples                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Filesystem                      | `filesystem.read`, `filesystem.write`                                                                   |
| Terminal                        | `terminal.run`                                                                                          |
| Git                             | `git.status`, `git.diff`, `git.commit`, `git.push`                                                      |
| Browser interface (conditional) | `browser.start`, `browser.goto`, `browser.click`, `browser.fill`, `browser.screenshot`, `browser.close` |

The browser interface is a contract and permission surface, not a Playwright implementation. Playwright integration and browser-based QA are future capabilities. Browser tools are primarily for QA when enabled. Git mutation tools remain subject to operation-level permissions.

Flow for every call:

```text
LLM → Tool Call → Permission Check → execute or structured deny → log
```

---

## Target project

The target project is replaceable. The runtime must not hard-code a particular application.

Project configuration identifies at least:

- repository / working directory
- technology stack
- start command and health check / URL
- test commands
- conventions and related settings

The runtime may start the target app, wait until ready, pass a base URL to QA, and stop the app afterward. If execution is stopped or the target application/process crashes, persist the work-item status as `cancelled` before cleanup; do not leave the last state stale. Unrecoverable role, tool, or runtime failures persist `failed`, while retry exhaustion persists `human_required`.

Example shape:

```yaml
runtime:
  start: pnpm exec dev
  url: http://localhost:3000
```

---

## Git integration

- One branch per work item (for example `feature/FEAT-001-…`, `bug/BUG-001-…`).
- Preferred unit of history: the work item or a meaningful implementation step.
- MVP prepares branch and PR-ready state; **no automatic merge**.

Branch association and status belong in work-item runtime state. See `docs/work-items.md` and `docs/storage.md`.

---

## Boundaries

| Concern                     | Owner                     |
| --------------------------- | ------------------------- |
| What to do                  | Work Item                 |
| Who / when                  | Workflow → execution plan |
| How configured              | Role                      |
| What is allowed             | Permissions               |
| Orchestrate + execute tools | Runtime                   |
| Durable layout on disk      | Storage (filesystem)      |

Do not:

- embed vendor-specific LLM SDKs in core orchestration
- skip permission checks for “internal” or mock paths in production code paths that roles use
- treat the runtime as permanently running agents between CLI/commands
- hard-code a single target application

---

## Invariants

1. Runtime enforces workflow order and permissions; it does not invent role behavior outside configuration.
2. Provider-specific logic stays behind the provider interface.
3. Every tool call is permission-checked and logged appropriately.
4. Target project remains replaceable via configuration.
5. Filesystem remains the MVP source of truth for state the runtime persists.
6. Human approval remains required before merge.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/execution.md`    | Role executions, logging, retry              |
| `docs/permissions.md`  | Permission model and enforcement             |
| `docs/storage.md`      | Filesystem layout and persistence            |
| `docs/roles.md`        | Role manifests and configuration             |
| `docs/workflows.md`    | Templates and execution plans                |
| `AGENTS.md`            | Working rules for agents modifying this repo |
