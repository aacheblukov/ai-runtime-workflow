# Permissions

This document describes the permission model and how the runtime enforces it.

`SPEC.md` is authoritative. Prefer this file when changing allow rules, enforcement points, or permission schemas. See `docs/roles.md` for where policies live on a role, and `docs/runtime.md` for tool execution around the check.

---

## Purpose

**Permissions** define _what a role is actually allowed to do_.

Role instructions describe expected behavior. They are not a security boundary. The runtime must enforce permissions on every tool call, independently of what the LLM was told or what it requests.

```text
Role instructions → intent
Permissions       → allowance
Runtime           → enforcement
```

A role must never gain capabilities merely because its instructions ask for them.

---

## Three levels

Permissions operate at three levels. All relevant levels must pass before a tool runs.

### 1. Tool permissions

Whether the role may invoke a given tool at all.

Examples:

```text
filesystem.read
filesystem.write
terminal.run
browser.start
browser.goto
browser.click
git.status
git.diff
git.commit
git.push
```

Browser tool names describe the optional browser interface; they do not imply Playwright integration.

Example allow list:

```yaml
tools:
  allow:
    - filesystem.read
    - filesystem.write
    - terminal.run
    - git.status
    - git.diff
```

### 2. Resource permissions

Which resources (especially filesystem paths) the role may read or write. Having `filesystem.write` does not mean unrestricted write access.

Example:

```yaml
filesystem:
  read:
    - project/**
    - feature/**
    - target/**

  write:
    - target/src/**
    - feature/implementation.md
```

#### Scope-to-path mapping

The policy scopes above are **logical path spaces** that the runtime translates to real directories. They are defined relative to the runtime's workspace, which contains the AI-team project metadata and the configured target software repository:

| Policy scope | Maps to real path                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project/**` | `projects/<project>/**` — project-level AI-team metadata (for example `project.md`, `backlog.md`)                                                                               |
| `feature/**` | `projects/<project>/features/<FEAT-ID>/**` — the current feature work-item folder (the feature ID is bound to the running work item)                                            |
| `target/**`  | The configured target software repository — the application being modified; its path is declared in the project configuration and is separate from the AI-team project metadata |

All three scopes are **inside the runtime's workspace** (the AI-team project root). `target/**` is a separately configured path within that workspace; it is not inside `projects/<project>/`.

Path policy should prevent access outside allowed prefixes. Exact glob semantics are an implementation detail; the contract is: deny by default outside the declared sets.

### 3. Operation permissions

Some tools expose operations with different risk. A role may use a tool family for inspection without mutation.

Example Git operations:

```text
git.status
git.diff
git.commit
git.push
```

A role may be allowed `status` and `diff` without `commit` or `push`.

```yaml
git:
  allow:
    - status
    - diff
```

---

## Enforcement

Every tool invocation must pass through the runtime permission layer:

```text
LLM
 ↓
Tool Call
 ↓
Permission Check
 ├── allowed → execute tool
 └── denied  → return structured permission error
```

On deny:

- do not execute the operation
- return a structured failure the role execution can observe
- record the decision in execution logs

Example:

```text
QA
 ↓
filesystem.write(target/src/App.tsx)
 ↓
Permission Policy
 ↓
DENIED
```

Permissions must not depend solely on natural-language instructions. Logging should make it possible to answer which operations were denied and why (at least policy denial vs other failures).

---

## Role examples

Exact schema may evolve. The architectural requirement is: configurable and runtime-enforced.

### Developer (illustrative)

```yaml
id: developer

tools:
  allow:
    - filesystem.read
    - filesystem.write
    - terminal.run
    - git.status
    - git.diff

filesystem:
  read:
    - project/**
    - feature/**
    - target/**

  write:
    - target/**
    - feature/implementation.md

git:
  allow:
    - status
    - diff
```

### QA (illustrative)

```yaml
id: qa

tools:
  allow:
    - filesystem.read
    - terminal.run
    - browser.start
    - browser.goto
    - browser.click
    - browser.fill
    - browser.screenshot

filesystem:
  read:
    - project/**
    - feature/**
    - target/**

  write:
    - feature/qa.md

git:
  allow: []
```

The browser entries are illustrative and apply only when the browser interface is enabled by the selected QA workflow. Playwright integration is a future capability.

QA may validate via tests, terminal, filesystem inspection, project runtime, and the browser interface when enabled by the selected QA workflow. Playwright integration and browser-based QA are future capabilities. In the MVP, QA does not modify implementation source—even if prompted to “just fix it.”

---

## Boundaries

| Concern                 | Owner                                  |
| ----------------------- | -------------------------------------- |
| Expected behavior text  | Role instructions                      |
| Declared allow rules    | Role permission policy (configuration) |
| Check on each tool call | Runtime                                |
| Tool implementation     | Runtime / tool layer                   |

Do not:

- treat prompts as enforcement
- skip the permission layer for “trusted” roles or localhost-only paths
- expand allow sets dynamically from LLM output
- conflate “tool exists in the product” with “this role may call it”

---

## Invariants

1. Instructions describe intent; permissions define allowance; the runtime enforces.
2. Every tool call is checked before execution.
3. Denied calls yield structured errors and are logged; they are not silently ignored or partially applied.
4. Tool, resource, and operation constraints are all enforceable as needed for the call.
5. Schema details may evolve; runtime enforcement and configurability must not.
6. No role gains capabilities solely because its instructions request them.

---

## Related documentation

| Doc                    | Focus                                        |
| ---------------------- | -------------------------------------------- |
| `SPEC.md`              | Full specification (authoritative)           |
| `docs/architecture.md` | System-wide boundaries and concept map       |
| `docs/roles.md`        | Role manifests and configuration             |
| `docs/runtime.md`      | Orchestration and tool execution             |
| `docs/execution.md`    | Role executions, logging, retry              |
| `AGENTS.md`            | Working rules for agents modifying this repo |
