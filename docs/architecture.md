# Architecture

This document describes the architectural shape of the AI Dev Team runtime.

`SPEC.md` is the primary source of truth. This file summarizes boundaries, invariants, and design decisions that implementers must preserve. Detailed subsystem docs live under `docs/` and should be preferred when changing a specific area.

---

## Purpose

AI Dev Team is a local, modular workflow runtime for coordinating LLM-based software-development roles over real software projects.

The system is not itself an LLM. It does not assume that roles are permanent autonomous agents.

A **role execution** is one invocation of an LLM with:

* role instructions
* relevant project and work-item context
* configured model/provider
* a defined set of tools
* a permission policy enforced by the runtime

The **runtime** owns workflow orchestration, tool execution, permissions, state, artifacts, logging, and integration with the target project.

---

## Core principles

1. **Feature is the primary unit of work.** A feature is a requested change to the target project. It is not permanently tied to a particular set of roles. Its workflow comes from a template, resolved into a feature-specific execution plan. Completed features are historical; they are not containers for future work.

2. **Bugs are independent work items.** A bug is not a child of a feature. It may reference a source feature for provenance only. Bugs may use different workflow templates from features.

3. **Filesystem is the MVP source of truth.** Projects, work items, artifacts, workflows, roles, execution state, and logs live on disk. A database is not required until concrete needs justify it.

4. **Roles are configuration.** Roles are not hard-coded agent classes. They are loaded from manifests (instructions, model/provider, tools, permissions) and executed through one shared role-execution mechanism.

5. **Permissions are runtime-enforced.** Role instructions describe intent. Permissions define what is actually allowed. Every tool call must pass a runtime permission check. Prompts are never a security boundary.

6. **Providers are interchangeable.** The core runtime must not depend on a specific LLM provider. Provider-specific logic stays behind an abstraction. OpenRouter is the initial provider, not the architecture.

7. **Artifacts are the communication channel.** Roles communicate through explicit artifacts and structured execution state, not hidden conversational memory between executions.

---

## Concept map

```text
Project (target software + AI-team context)
  └── Work Item (feature | bug)
        ├── Requirements / capabilities
        ├── Workflow Template (reusable)
        │         ↓
        ├── Execution Plan (immutable, work-item-specific)
        │         ↓
        ├── Role Executions (LLM + tools + permissions)
        │         ↓
        ├── Artifacts (requirements.md, implementation.md, qa.md, …)
        └── Runtime state (state.json, events.jsonl, executions/)
```

| Concept | Responsibility |
| --- | --- |
| **Work Item** | What needs to be done |
| **Workflow Template** | Who participates and in what order (reusable) |
| **Execution Plan** | Resolved workflow for one work item (immutable once created) |
| **Role** | How a participant is instructed and configured |
| **Permissions** | What that role is actually allowed to do |
| **Runtime** | Orchestrates workflow, enforces permissions, executes tools |
| **Artifacts** | Explicit communication between role executions |
| **Target Project** | The software being modified |
| **Filesystem** | Source of truth for the MVP |

Do not move responsibilities across these boundaries without a concrete architectural reason.

---

## Architectural flow

The system preserves this separation:

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

### Workflow resolution

A work item selects a workflow template by name. The template is resolved into an immutable execution plan persisted under the work item (for example `projects/<project>/features/FEAT-001/runtime/execution-plan.json`).

* Templates are reusable definitions; they are not copied into every work item as editable copies of the template source.
* Later changes to a template must not silently change an already-created execution plan.
* For the MVP, workflow selection is explicit. Automatic capability-based workflow inference is out of scope.

### Role execution

A role execution does not imply a permanently running agent. The same role may run multiple times on one work item (for example after QA failure).

Typical communication pattern:

```text
Product Owner → requirements.md
Developer     → implementation.md
QA            → qa.md
```

### Permission enforcement

```text
LLM → Tool Call → Permission Check
                    ├── allowed → execute tool
                    └── denied  → structured permission error
```

Permissions operate at three levels:

* **Tools** — which tools a role may invoke
* **Resources** — which filesystem (and similar) paths it may read/write
* **Operations** — which operations within a tool family are allowed (for example `git.status` vs `git.push`)

A role must never gain capabilities merely because its instructions ask for them.

---

## Runtime state vs artifacts

Human-readable artifacts and machine runtime state are stored separately.

```text
projects/<project>/features/FEAT-001/
├── feature.md
├── requirements.md
├── design.md          # when the workflow needs it
├── implementation.md
├── qa.md
└── runtime/
    ├── state.json
    ├── execution-plan.json
    ├── events.jsonl
    └── executions/
```

* `state.json` — current work-item state
* `execution-plan.json` — resolved workflow for this work item
* `events.jsonl` — append-only execution events
* `executions/` — immutable per-execution records

Every role execution should record enough information to answer: which role and model ran, what context it received, which tools it called, which operations were denied, what files changed, and why it failed.

---

## Target project and Git

* The **target project** is replaceable. The runtime must not hard-code a particular application. Project configuration identifies repository, working directory, stack, start/test commands, conventions, and related settings.
* Each work item gets its own branch (for example `feature/FEAT-001-…`, `bug/BUG-001-…`).
* The MVP prepares a branch and PR-ready state; merge requires human approval.

---

## Failure and retry

On QA failure, the default loop is Developer → QA again.

Counting rules (see `docs/execution.md` for full detail):

* An **attempt** is one Developer execution against this work item.
* Attempt 1 runs as part of the initial workflow.
* After each QA failure the runtime may run another Developer execution — that is the next attempt.
* Maximum: **3 attempts in total** (initial Developer execution + up to 2 retries).
* After the third attempt fails its QA, execution stops for human intervention.
* All attempts and logs must be preserved.

Completed work items are not re-run as full workflows for regression. QA may attach regression checks that later work items can execute.

---

## MVP vertical slice

```text
User → create project → create work item → select workflow
  → resolve execution plan → Product Owner → Developer → QA
  → QA result: passed → work-item status: passed → Git branch / PR-ready → human review
```

The MVP must demonstrate: LLM execution, role configuration, workflow execution, artifact passing, tool execution, permission enforcement, Git integration, QA results, retry handling, and execution logging.

Explicitly out of MVP scope include: database, distributed execution, autonomous multi-agent chat, automatic merge, complex workflow inference, vector DB / long-term semantic memory, and autonomous production deployment. See `SPEC.md` §23–24 for the full lists.

---

## Invariants

Implementers must preserve these rules:

1. Work items define *what*; workflows define *who/when*; roles define *how configured*; permissions define *what is allowed*; the runtime enforces and executes.
2. Roles remain configuration, not hard-coded agent implementations.
3. Permissions remain runtime-enforced, not prompt-enforced.
4. Workflow templates remain reusable; execution plans are the per-work-item source of truth once resolved.
5. Cross-role communication goes through artifacts and structured state, not implicit agent memory.
6. The core runtime stays provider-agnostic.
7. The target project stays replaceable and outside the runtime’s identity.

---

## Related documentation

| Doc | Focus |
| --- | --- |
| `SPEC.md` | Full specification (authoritative) |
| `AGENTS.md` | Working rules for agents modifying this repo |
| `docs/work-items.md` | Features, bugs, shared work-item model |
| `docs/workflows.md` | Templates, resolution, execution plans |
| `docs/roles.md` | Role manifests and configuration |
| `docs/permissions.md` | Permission model and enforcement |
| `docs/runtime.md` | Orchestration and tool execution |
| `docs/storage.md` | Filesystem layout and persistence |
| `docs/execution.md` | Role executions, logging, retry |
| `docs/development.md` | Local development practices |
