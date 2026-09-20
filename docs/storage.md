# Storage

This document describes filesystem-first persistence for the MVP: where projects, work items, workflows, roles, artifacts, and runtime state live.

`SPEC.md` is authoritative. Prefer this file when changing on-disk layout or persistence helpers. See `docs/work-items.md` for work-item semantics and `docs/execution.md` for what execution records must contain.

---

## Purpose

The MVP uses the **filesystem as the source of truth**. A database is not required until concrete needs justify it.

Disk holds:

- projects and project context
- work items (features and bugs)
- human-readable artifacts
- workflow templates
- role definitions
- execution state and logs

Clarity of layout matters more than clever storage. Prefer straightforward files and directories that a human can inspect.

---

## Top-level layout

Conceptual repository / workspace layout:

```text
projects/
└── <project>/
    ├── project.md
    ├── backlog.md
    ├── features/
    │   └── FEAT-001/
    │       ├── feature.md
    │       ├── requirements.md      # when produced
    │       ├── design.md            # when needed
    │       ├── implementation.md
    │       ├── qa.md
    │       └── runtime/
    └── bugs/
        └── BUG-001/
            ├── bug.md
            ├── …artifacts…
            └── runtime/

workflows/
├── default.yaml
├── ui.yaml
└── full-stack.yaml

roles/
├── product-owner/
│   ├── manifest.yaml
│   └── role.md
├── developer/
│   ├── manifest.yaml
│   └── role.md
└── qa/
    ├── manifest.yaml
    └── role.md
```

`workflows/` and `roles/` are shared runtime configuration (exact root relative to the product install may be refined during implementation; they are not nested inside a single target project’s source tree as application code).

---

## Project

Each managed project directory contains at least:

| Path         | Role                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| `project.md` | AI-team context: stack, architecture notes, conventions, target repo config |
| `backlog.md` | Project-level backlog of work                                               |
| `features/`  | Feature work items                                                          |
| `bugs/`      | Bug work items                                                              |

The **target project** source code lives in the configured repository / working directory (which may be outside or alongside this metadata tree). The runtime must not assume one hard-coded application.

---

## Work item directories

Features and bugs are peers:

```text
features/FEAT-001/
bugs/BUG-001/
```

- Primary descriptor: `feature.md` or `bug.md`
- Artifacts required by the workflow appear beside it
- Machine state stays under `runtime/`

### Artifacts vs runtime state

Human-readable artifacts and machine runtime state are stored separately on purpose.

```text
FEAT-001/
├── feature.md
├── requirements.md
├── design.md              # optional per workflow
├── implementation.md
├── qa.md
└── runtime/
    ├── state.json
    ├── execution-plan.json
    ├── events.jsonl
    └── executions/
        ├── 001/
        ├── 002/
        └── 003/
```

| Path                  | Contents                                                            |
| --------------------- | ------------------------------------------------------------------- |
| `state.json`          | Current work-item state, including outcome status and branch association when present |
| `execution-plan.json` | Immutable resolved workflow for this work item                      |
| `events.jsonl`        | Append-only execution events                                        |
| `executions/<id>/`    | Immutable per-execution records                                     |

Do not fold long LLM transcripts into `feature.md` as a substitute for `executions/` and `events.jsonl`.

---

## Persistence helpers (MVP)

Storage implementation should provide small, testable operations:

- create directories and files
- read / write text and JSON
- append-only JSONL for events
- load/validate known schemas as they are defined

Fail clearly on missing or corrupt required files rather than inventing silent defaults that hide bugs.

---

## Path scopes in permissions

Permission examples in `SPEC.md` / `docs/permissions.md` use logical scopes such as `project/**`, `feature/**`, `bug/**`, and `target/**`. These are **policy path spaces**, not literal filesystem paths. The runtime binds the project, work-item ID, and configured target repository, then resolves each scope to an absolute path:

| Policy scope | Maps to real path |
| ------------ | ----------------- |
| `project/**` | `projects/<project>/**` — project-level AI-team metadata (for example `project.md` and `backlog.md`) |
| `feature/**` | `projects/<project>/features/<FEAT-ID>/**` — the current feature work-item folder |
| `bug/**` | `projects/<project>/bugs/<BUG-ID>/**` — the current bug work-item folder |
| `target/**` | The configured target repository root — the application being modified, separate from the AI-team project metadata |

The feature and bug IDs are bound to the running work item. The `project/**`, `feature/**`, and `bug/**` scopes resolve under the runtime workspace's managed metadata tree. The target repository may be outside `projects/<project>/`, including alongside the metadata tree. For the MVP, `target/**` must still resolve inside the runtime workspace; the logical scope keeps the policy model stable if support for an externally located target is enabled later.

### Path resolution and enforcement

For every filesystem operation, the runtime must:

1. Resolve the logical scope using the current project, work item, and target repository configuration.
2. Normalize both the requested path and the mapped allow-rule path to absolute paths, resolving `.` and `..` components and preventing symbolic links from escaping the allowed directory.
3. Check the normalized requested path against the role's explicit filesystem allow rules. Access is denied by default unless the path is contained by an allowed scope.
4. Apply the tool and operation permissions in addition to the path check.

A logical scope must never override the configured target repository or bypass the MVP workspace containment rule. The storage and permission layers must use the same scope mapping so a policy has the same meaning in every execution context.

---

## Boundaries

| Concern                             | Owner                      |
| ----------------------------------- | -------------------------- |
| On-disk layout and I/O              | Storage / filesystem layer |
| Meaning of work-item fields         | Work Item model            |
| When files are written during a run | Runtime / role execution   |
| What may be read or written         | Permissions                |

Do not:

- introduce a database in the MVP without a concrete requirement
- mix mutable “current state” into append-only event history
- make template or role definition copies inside each work item the editable source of truth for shared config
- treat target application source as owned by the runtime’s identity

---

## Invariants

1. Filesystem is the MVP source of truth.
2. Artifacts (human) and runtime state (machine) remain separate directories/files.
3. Execution plans and per-execution records are immutable once written; events are append-only.
4. Features and bugs share the same storage pattern under different roots.
5. Shared workflows and roles remain reusable definitions outside per-work-item copies.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/work-items.md`   | Features, bugs, shared work-item model       |
| `docs/workflows.md`    | Templates and execution plans                |
| `docs/roles.md`        | Role manifests on disk                       |
| `docs/execution.md`    | Execution records and logging requirements   |
| `docs/runtime.md`      | Orchestration that writes this state         |
| `AGENTS.md`            | Working rules for agents modifying this repo |
