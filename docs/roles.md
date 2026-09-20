# Roles

This document describes roles: configurable participant definitions used to create role executions.

`SPEC.md` is authoritative. Prefer this file when changing role manifests, instructions, or how roles are loaded. See `docs/permissions.md` for what a role may actually do, and `docs/execution.md` for a single invocation against a work item.

---

## Purpose

A **Role** answers _how a participant is instructed and configured_.

It is not a permanently running agent, not a hard-coded class in the runtime, and not a security boundary by itself.

A **role execution** is one invocation of a role against a specific work item: instructions + context + model/provider + tools + permissions, orchestrated by the runtime.

```text
Role
  + Work Item Context
  + Instructions
  + Model
  + Tools
  + Permissions
      ↓
Role Execution
      ↓
Artifacts / Tool Calls / Result
```

The same role may run multiple times on one work item (for example Developer after a QA failure).

---

## Configuration, not code

Roles are loaded from the filesystem and treated uniformly by one shared role-execution mechanism.

Users should eventually be able to add custom roles without changing runtime source. The MVP ships a small set; the loading model must not assume only those names.

Example layout:

```text
roles/
├── product-owner/
│   ├── manifest.yaml
│   └── role.md
├── developer/
│   ├── manifest.yaml
│   └── role.md
├── qa/
│   ├── manifest.yaml
│   └── role.md
└── my-custom-reviewer/   # future / user-defined
    ├── manifest.yaml
    └── role.md
```

- `manifest.yaml` — identity, model/provider, tools, permissions, role-specific settings
- `role.md` — natural-language instructions for the LLM

Do not hard-code agent classes such as `class DeveloperAgent` that bypass this configuration path.

---

## What a role consists of

| Piece                           | Responsibility                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| **Identity**                    | Stable id (for example `developer`, `qa`) referenced by workflow steps |
| **Instructions**                | Expected behavior and output (prompt text)                             |
| **Model / provider**            | Which LLM backend and model to use for executions of this role         |
| **Available tools**             | Which tool names the role may request                                  |
| **Permission policy**           | Runtime-enforced allow rules for tools, paths, and operations          |
| **Role-specific configuration** | Extra settings that belong to the role, not the core runtime           |

Instructions describe intent. Permissions define allowance. An instruction that asks for a forbidden tool must still fail the permission check.

---

## Example roles

Initial and near-term identities include:

```text
product-owner
designer
developer
backend-developer
qa
security-reviewer
```

MVP vertical slice typically needs at least product-owner, developer, and qa.

### Product Owner

Turns a high-level request into an actionable work item: scope, business context, requirements, acceptance criteria, constraints, dependencies, and a suggested workflow template. May recommend a workflow; does not bypass permissions.

Typical artifact: `requirements.md`.

### Developer

Implements the work item within its permission boundary: inspect and modify permitted files, run permitted commands, read QA feedback, write implementation artifacts. Cannot touch resources outside its policy.

Typical artifact: `implementation.md`.

### QA

Validates resulting behavior against acceptance criteria using permitted tools (terminal, tests, filesystem inspection, project runtime, and the browser interface when enabled by the selected QA workflow). Should exercise the running application where appropriate, not only inspect source. The browser interface is an optional MVP capability; Playwright integration and browser-based QA are future capabilities. Does not modify implementation source in the MVP.

Typical artifact: `qa.md`, with a structured result whose `status` is `passed` or `failed`.

Other specialist roles (designer, backend-developer, security-reviewer) follow the same manifest + instructions pattern when present in a template.

---

## Communication

Roles do not rely on hidden conversational memory between executions. They read and write explicit artifacts and structured work-item state:

```text
Product Owner → requirements.md
Developer     → implementation.md
QA            → qa.md
```

Which artifacts matter depends on the workflow; see `docs/workflows.md`.

---

## Provider independence

Model and provider are role configuration, not core runtime identity. The runtime must stay provider-agnostic; OpenRouter (or any single vendor) is an implementation choice behind the provider abstraction, not something baked into role types.

---

## Boundaries

| Concern                            | Owner                          |
| ---------------------------------- | ------------------------------ |
| What needs to be done              | Work Item                      |
| Who participates and in what order | Workflow / execution plan      |
| How a participant is configured    | Role                           |
| What that participant may do       | Permissions (runtime-enforced) |
| Invoking the LLM and tools         | Runtime                        |

Do not:

- hard-code roles into the runtime as special agent implementations
- treat role prompts as a security boundary
- grant extra tools or paths because instructions request them
- invent a separate cross-role chat channel instead of artifacts

---

## Invariants

1. Roles remain configuration loaded from manifests and instructions.
2. All roles share one role-execution mechanism.
3. A role execution is a single invocation, not a permanent autonomous agent.
4. Instructions never override the permission policy.
5. Custom roles must be possible without modifying runtime source (after MVP).
6. Provider/model selection stays in role (or shared) configuration behind a provider abstraction.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/permissions.md`  | Permission model and enforcement             |
| `docs/workflows.md`    | Templates, resolution, execution plans       |
| `docs/execution.md`    | Role executions, logging, retry              |
| `docs/runtime.md`      | Orchestration and tool execution             |
| `AGENTS.md`            | Working rules for agents modifying this repo |
