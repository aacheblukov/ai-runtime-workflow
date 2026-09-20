# AGENTS.md

## Purpose

This repository contains a modular AI development team runtime.

Read `SPEC.md` before making architectural decisions.

Read the relevant files in `docs/` before modifying a subsystem.

`SPEC.md` is the primary architectural source of truth.

---

## 1. Think Before Coding

Do not guess when the requirements are unclear.

Before implementing a non-trivial change:

1. Understand the task.
2. Inspect the relevant code and documentation.
3. Identify assumptions and ambiguities.
4. If an important decision is unclear, ask the user before implementing it.

Do not silently choose between multiple materially different interpretations.

If the requested change conflicts with `SPEC.md`, stop and explain the conflict.

If the existing implementation conflicts with the documented architecture, do not silently redesign the architecture. Explain the discrepancy first.

---

## 2. Keep It Simple

Implement the smallest solution that correctly solves the current problem.

Do not:

* add features that were not requested
* introduce abstractions without a concrete need
* add configuration "for future flexibility"
* build infrastructure before it is needed
* introduce a database when filesystem storage is sufficient
* introduce frameworks or libraries without a clear benefit
* optimize prematurely

Prefer straightforward code over clever code.

Clarity is more important than reducing the number of lines.

---

## 3. Make Surgical Changes

Understand existing code before changing it.

Change only what is necessary for the task.

Do not:

* rewrite unrelated code
* rename things without a reason
* reorganize unrelated files
* remove existing behavior without understanding why it exists
* modify public interfaces unnecessarily

Preserve existing behavior unless the task explicitly requires changing it.

---

## 4. Verify Everything

Never assume that code works because it looks correct.

After implementation:

1. Run the relevant tests.
2. Run type checking/build if applicable.
3. Run relevant linting if applicable.
4. Inspect the resulting changes.
5. Fix failures before considering the task complete.

For bug fixes, reproduce the problem when practical and verify the fix.

A task is not complete until its acceptance criteria are satisfied.

---

## 5. Respect Project Architecture

Keep these boundaries intact:

* Work Item = what needs to be done.
* Workflow = who participates and in what order.
* Execution Plan = resolved workflow for a specific Work Item.
* Role = configurable participant instructions and configuration.
* Permissions = runtime-enforced capabilities.
* Runtime = orchestrates execution and executes tools.
* Artifacts = explicit communication between role executions.
* Target Project = software being modified.
* Filesystem = source of truth for the MVP.

Do not move responsibilities between these boundaries without a concrete architectural reason.

---

## 6. Roles Are Configuration

Do not hard-code roles into the runtime.

Roles are defined through their configuration and instructions.

The runtime should load roles from their manifests and enforce their permissions.

Do not rely on role prompts as a security boundary.

---

## 7. Permissions Are Runtime-Enforced

Never assume that an LLM will obey permission rules because they are written in a prompt.

Every tool call must go through runtime permission checks.

Permissions may restrict:

* tools
* filesystem paths
* operations

A role must never gain additional capabilities merely because its instructions request them.

---

## 8. Preserve Provider Independence

The core runtime must not depend on a specific LLM provider.

Provider-specific logic belongs behind the provider abstraction.

OpenRouter is the initial provider, not the architecture.

---

## 9. Use Artifacts as Communication

Roles communicate through explicit artifacts and structured execution state.

Prefer:

```text
PO → requirements.md
Developer → implementation.md
QA → qa.md
```

over hidden assumptions or implicit agent memory.

Do not invent cross-role communication mechanisms unless the current architecture requires them.

---

## 10. Keep Scope Under Control

Work only on the current task unless a dependency makes another change necessary.

If you discover unrelated problems:

* do not fix them automatically
* mention them to the user
* continue only if they block the current task

Update `backlog.md` when you identify useful future work.

Do not expand the current task just because the codebase makes it possible.

---

## 11. Documentation

When behavior or architecture changes, update the relevant documentation.

Do not create documentation that merely repeats the code.

Documentation should explain:

* why something exists
* important boundaries
* contracts
* invariants
* decisions that are not obvious from the code

Keep documentation concise and current.

---

## 12. When in Doubt

Prefer this order:

1. Existing implementation
2. Relevant documentation
3. `SPEC.md`
4. Simplest reasonable solution
5. Ask the user if an important decision remains unclear

Never invent requirements, APIs, architecture, or behavior to make progress appear smoother.

A short clarification is better than implementing the wrong thing.
