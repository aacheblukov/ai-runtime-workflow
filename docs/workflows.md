# Workflows

This document describes workflow templates and how they become execution plans for a work item.

`SPEC.md` is authoritative. Prefer this file when changing template shape, selection, or resolution. See `docs/work-items.md` for the work-item model and `docs/execution.md` for how plan steps are run.

---

## Purpose

A **Workflow Template** defines _who participates and in what order_.

It is a reusable execution pattern. It is not the work itself (that is the work item), and it is not a running agent team.

A work item selects a template by name. The runtime resolves that selection into an **execution plan** that is immutable for that work item. After resolution, the plan—not the live template file—is the source of truth for the run.

---

## Workflow template

A template specifies:

- ordered roles (steps)
- optional behavior
- retry behavior
- transitions
- approval points

MVP templates focus on ordered role steps and a version. Richer optional behavior, transitions, and approval points may grow later without changing the template → plan boundary.

### Location

```text
workflows/
├── default.yaml
├── ui.yaml
└── full-stack.yaml
```

Templates live as shared definitions. They are not copied into every work item as editable template sources.

### Initial templates

| Name         | Steps                                                         |
| ------------ | ------------------------------------------------------------- |
| `default`    | product-owner → developer → qa                                |
| `ui`         | product-owner → designer → developer → qa                     |
| `full-stack` | product-owner → designer → backend-developer → developer → qa |

Example:

```yaml
name: ui

steps:
  - product-owner
  - designer
  - developer
  - qa
```

Bugs may use different templates from features (for example a shorter triage → developer → qa path). The same resolution rules apply.

---

## Selection (MVP)

For the MVP, workflow selection is **explicit**. The work item (or the operator creating it) names a template:

```yaml
workflow:
  template: default
```

or `ui`, or `full-stack`.

The system must not infer the optimal workflow from capabilities alone in the MVP.

Future versions may derive requirements from capabilities such as `design`, `frontend`, `backend-developer`, `security`, or `browser-validation`. That inference is out of MVP scope.

The Product Owner may _recommend_ a template when shaping requirements. Recommendation does not bypass runtime selection or permissions.

---

## Resolution → execution plan

```text
Work Item
   ├── Requirements / capabilities
   └── Workflow Template (reusable)
             ↓
      Execution Plan (immutable, work-item-specific)
             ↓
        Role Executions
```

Selecting `template: ui` may resolve to:

```json
{
  "template": "ui",
  "version": 1,
  "steps": ["product-owner", "designer", "developer", "qa"]
}
```

Persist under the work item, for example:

```text
projects/<project>/features/FEAT-001/runtime/execution-plan.json
```

(Bugs use the same idea under `bugs/BUG-001/runtime/`.)

The plan stores at least:

- template name
- template version used at resolution time
- resolved ordered steps (role identities)

---

## Artifacts and workflows

Not every artifact is required for every template. The workflow determines which roles run and which artifacts are relevant.

Examples:

```text
default:
  requirements.md
  implementation.md
  qa.md

ui:
  requirements.md
  design.md
  implementation.md
  qa.md
```

Roles communicate through those artifacts and structured state, not through hidden memory between steps. See `docs/work-items.md` and `docs/architecture.md`.

---

## Retry relative to the plan

On QA failure, the default loop re-enters Developer → QA. That is orchestration over the resolved plan, not a silent rewrite of the plan.

- Maximum **implementation attempts**: three in total (the initial Developer execution + up to two retries)
- An **attempt** is one Developer execution against this work item
- After the third attempt fails its QA: stop for human intervention
- All attempts and logs are preserved

Details of attempt counting and logging belong in `docs/execution.md`.

---

## Boundaries

| Concern                       | Owner             |
| ----------------------------- | ----------------- |
| What needs to be done         | Work Item         |
| Who / when (reusable pattern) | Workflow template |
| Who / when (this run)         | Execution plan    |
| How a step is configured      | Role              |
| What a step may do            | Permissions       |
| Running steps and tools       | Runtime           |

Do not:

- copy editable template sources into each work item and treat those copies as the shared definition
- let later template edits change an already-created execution plan
- hard-code role order in the runtime instead of loading templates
- invent automatic capability-based selection in the MVP

---

## Invariants

1. Templates are reusable; execution plans are per-work-item and immutable once created.
2. MVP selection is explicit by template name.
3. The execution plan is the source of truth for a work item’s role order after resolution.
4. Template changes must not silently alter in-flight or historical plans.
5. Workflow defines _who/when_; it does not grant permissions or replace role configuration.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/work-items.md`   | Features, bugs, shared work-item model       |
| `docs/roles.md`        | Role manifests and configuration             |
| `docs/execution.md`    | Role executions, logging, retry              |
| `docs/runtime.md`      | Orchestration and tool execution             |
| `AGENTS.md`            | Working rules for agents modifying this repo |
