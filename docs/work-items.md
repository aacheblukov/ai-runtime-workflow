# Work Items

This document describes the Work Item model: what a work item is, how features and bugs relate, what they own on disk, and the boundaries implementers must preserve.

`SPEC.md` is authoritative. Prefer this file when changing work-item behavior or storage shape. See `docs/workflows.md` for templates and execution plans, and `docs/storage.md` for broader filesystem layout.

---

## Purpose

A **Work Item** is an executable unit of work against a target project.

It answers _what needs to be done_. It does not answer _who participates_ (workflow template), _how a participant is configured_ (role), or _what that participant may do_ (permissions). Those stay separate.

The runtime executes work items; it does not treat them as permanent agent sessions or as containers for unrelated future work.

---

## Types

Initial supported types:

| Type        | Role                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| **Feature** | Primary unit of product work. A requested change to the target project. |
| **Bug**     | Independent unit of work for a defect. Not a child of a feature.        |

### Features

- A feature is not permanently tied to a particular set of roles.
- Its workflow comes from a selected template, resolved into a feature-specific execution plan.
- A completed feature is historical. It is not a parent object that later work “lives inside.”

### Bugs

- A bug is a first-class work item, stored and executed like a feature.
- It may reference the feature where the problem originated or was discovered. That link is **provenance**, not ownership.
- A bug may later reference multiple related features if needed.
- Bugs may use different workflow templates from features (for example triage → developer → QA instead of product owner → designer → developer → QA).

Example provenance:

```yaml
id: BUG-001
type: bug

source:
  feature: FEAT-001
```

---

## Shared model

All work items share these runtime concepts:

- **Requirements** — actionable description of the change (often produced or refined by the Product Owner)
- **Workflow** — selected template name (explicit in the MVP)
- **Execution plan** — immutable resolved steps for this work item
- **Artifacts** — human-readable files roles use to communicate (`requirements.md`, `implementation.md`, `qa.md`, …)
- **State** — machine-readable current status under `runtime/`
- **Execution history** — events and per-execution records
- **Git branch** — one branch per work item
- **QA result** — structured pass/fail outcome

Capabilities may appear on a work item as context for humans and future workflow inference. For the MVP, workflow selection remains explicit; the system must not infer the template from capabilities alone.

---

## Identity and location

Work items live under the project that owns them:

```text
projects/<project>/
├── features/
│   └── FEAT-001/
│       ├── feature.md
│       ├── requirements.md      # when produced
│       ├── design.md            # when the workflow needs it
│       ├── implementation.md
│       ├── qa.md
│       └── runtime/
└── bugs/
    └── BUG-001/
        ├── bug.md
        ├── …artifacts…
        └── runtime/
```

Conventions:

- Feature IDs use `FEAT-NNN`; bug IDs use `BUG-NNN`.
- The primary human-facing descriptor is `feature.md` or `bug.md`.
- Artifacts that are not required by the selected workflow may be absent.
- Machine state stays under `runtime/`, separate from human-readable artifacts.

Runtime layout (same idea for features and bugs):

```text
runtime/
├── state.json
├── execution-plan.json
├── events.jsonl
└── executions/
```

- `state.json` — current work-item state
- `execution-plan.json` — resolved workflow for this work item
- `events.jsonl` — append-only execution events
- `executions/` — immutable per-execution records

---

## Workflow binding

A work item selects a workflow template by name. The runtime resolves that template into an **execution plan** and persists it under the work item.

```text
Work Item
   ├── Requirements / capabilities
   └── Workflow Template (reusable)
             ↓
      Execution Plan (immutable, work-item-specific)
             ↓
        Role Executions
```

Rules:

- Templates are reusable definitions; they are not copied into the work item as editable template sources.
- Once created, the execution plan is the source of truth for that work item’s run.
- Later edits to a template must not silently change an already-resolved plan.
- The same role may run multiple times on one work item (for example after QA failure).

Concrete template schemas and resolution belong in `docs/workflows.md`.

---

## Lifecycle and outcome status

The MVP persists one work-item outcome status in `runtime/state.json`. Its complete enum is:

| Status | Meaning |
| ------ | ------- |
| `passed` | QA returned `passed`; the work item is branch/PR-ready and awaits human review. |
| `failed` | An unrecoverable role, tool, or runtime failure prevents the workflow from continuing. An intermediate QA failure that still has retries remaining does not set this value. |
| `cancelled` | Execution was stopped or cannot continue because the target application/process crashed. |
| `human_required` | The third Developer attempt failed QA; the runtime stops and requires human intervention. |

The QA artifact has a separate result schema with `status: passed` or `status: failed`. A failed QA result does not become the work-item status until the retry policy reaches a terminal outcome. While execution is active and no outcome has been reached, execution records and append-only events remain the source of history; the runtime must not add `GREEN`, `HUMAN_REQUIRED`, uppercase `PASS`, or uppercase `FAIL` as persisted outcome values.

Behaviorally:

1. User creates a work item (for example via `team request`) with an initial request and directory.
2. A workflow template is selected explicitly.
3. The runtime resolves and stores the execution plan.
4. Roles run in plan order, writing artifacts and updating runtime state.
5. On QA failure, the default loop is Developer → QA again, up to three attempts total (the initial Developer execution + up to two retries). After the third failed attempt, set the work-item status to `human_required`; all attempts and logs are preserved.
6. On QA pass, set the work-item status to `passed`; the work item is branch/PR-ready and merge still requires human approval.
7. If execution is stopped or the target application/process crashes, persist `cancelled`. If an unrecoverable role, tool, or runtime failure prevents continuation, persist `failed`.
8. Completed work items are not re-run as full workflows for regression. QA may attach regression checks that later work items can execute, with provenance back to the source feature or bug.

---

## Git

Each work item gets its own branch, for example:

```text
feature/FEAT-001-save-button
bug/BUG-001-save-button-persistence
```

The preferred unit of Git history is the work item (or a meaningful implementation step within it). The MVP prepares a branch and PR-ready state; it does not auto-merge.

---

## Boundaries

Keep these separations intact:

| Concern                                    | Owner                              |
| ------------------------------------------ | ---------------------------------- |
| What needs to be done                      | Work Item                          |
| Who participates and in what order         | Workflow template → execution plan |
| How a participant is instructed/configured | Role                               |
| What a participant may actually do         | Permissions (runtime-enforced)     |
| Orchestration, tools, logging              | Runtime                            |
| Cross-role communication                   | Artifacts + structured state       |
| Software being changed                     | Target project                     |

Do not:

- nest bugs under features as owned children
- treat completed features as containers for future work
- encode workflow participants inside the work item instead of resolving a template
- use conversational memory between role executions instead of artifacts
- hard-code the target application into the work-item model

---

## Invariants

1. A work item is an executable unit of _what_, not a permanent agent or a reusable team roster.
2. Features and bugs are peer work-item types; bug → feature links are provenance only.
3. Filesystem is the MVP source of truth for work-item content, artifacts, and runtime state.
4. Human-readable artifacts and machine runtime state remain separate on disk.
5. Workflow templates stay reusable; execution plans stay per-work-item and immutable once resolved.
6. Completed work items remain historical; regression coverage goes through checks attached to later work, not by reopening old workflows as containers.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/workflows.md`    | Templates, resolution, execution plans       |
| `docs/storage.md`      | Filesystem layout and persistence            |
| `docs/execution.md`    | Role executions, logging, retry              |
| `docs/roles.md`        | Role manifests and configuration             |
| `AGENTS.md`            | Working rules for agents modifying this repo |
