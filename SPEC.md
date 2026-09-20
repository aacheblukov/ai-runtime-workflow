# AI Dev Team — Specification

## 1. Vision

AI Dev Team is a local, modular workflow runtime for coordinating LLM-based software-development roles over real software projects.

The system should allow a user to provide a high-level request and have a configurable team process that request through a defined workflow.

The system is not itself an LLM and does not assume that roles are permanent autonomous agents.

A role execution is an invocation of an LLM with:

- role instructions;
- relevant project and work-item context;
- configured model/provider;
- a defined set of tools;
- a permission policy enforced by the runtime.

The runtime is responsible for workflow orchestration, tool execution, permissions, state, artifacts, logging and integration with the target project.

---

# 2. Core Principles

## 2.1 Feature is the primary unit of work

A feature is the primary unit of product work and workflow execution.

A feature represents a requested change to the target project.

A feature is not permanently tied to a particular set of roles.

Its workflow is determined by a workflow template and resolved into a feature-specific execution plan.

Completed features are historical work items. They are not containers for future work.

---

## 2.2 Bugs are independent work items

A bug is also a unit of work.

A bug is not a child object that lives inside an existing feature.

A bug may reference the feature from which the problem originated or during which it was discovered.

Example:

```yaml
id: BUG-001
type: bug

source:
  feature: FEAT-001
```

The reference is provenance, not ownership.

A bug may later reference multiple related features if necessary.

Bugs may use different workflow templates from features.

Example:

```text
Feature:
Product Owner → Designer → Developer → QA

Bug:
Triage → Developer → QA
```

---

# 3. Main Concepts

## 3.1 Project

A Project represents the target software project being worked on.

It contains AI-team context such as:

- technology stack;
- architecture;
- conventions;
- existing capabilities;
- dependencies;
- project rules;
- target repository configuration.

The actual source code lives in the target project repository **inside the runtime's workspace** (the AI-team project root).

---

## 3.2 Work Item

A Work Item is an executable unit of work.

Initial supported types:

- Feature
- Bug

All work items share common runtime concepts:

- requirements;
- workflow;
- execution plan;
- artifacts;
- state;
- execution history;
- Git branch;
- QA result.

---

## 3.3 Workflow Template

A Workflow Template defines a reusable execution pattern.

A workflow template specifies:

- ordered roles;
- optional behavior;
- retry behavior;
- transitions;
- approval points.

Example:

```yaml
name: ui

steps:
  - product-owner
  - designer
  - developer
  - qa
```

Another:

```yaml
name: default

steps:
  - product-owner
  - developer
  - qa
```

Another:

```yaml
name: full-stack

steps:
  - product-owner
  - designer
  - backend-developer
  - developer
  - qa
```

Workflow templates are reusable definitions.

They are not copied into every work item.

---

# 4. Feature Workflow Resolution

A work item selects a workflow template.

The selected template is resolved into an immutable execution plan for that work item.

Conceptually:

```text
Work Item
   │
   ├── Requirements
   ├── Capabilities
   └── Workflow Template
             │
             ↓
      Execution Plan
             │
             ↓
        Role Executions
```

Example:

```yaml
workflow:
  template: ui
```

may resolve to:

```json
{
  "template": "ui",
  "version": 1,
  "steps": ["product-owner", "designer", "developer", "qa"]
}
```

The resolved execution plan is persisted at:

```text
projects/<project>/features/FEAT-001/runtime/execution-plan.json
```

The execution plan becomes the source of truth for that execution.

Later changes to the workflow template must not silently change an already-created execution plan.

---

## 4.1 Feature-specific workflow selection

For the MVP, workflow selection should remain explicit.

Examples:

```yaml
workflow:
  template: default
```

or:

```yaml
workflow:
  template: ui
```

or:

```yaml
workflow:
  template: full-stack
```

The system should not initially attempt to infer the optimal workflow automatically.

Future versions may derive workflow requirements from capabilities such as:

```text
design
frontend
backend-developer
security
browser-validation
```

but intelligent workflow resolution is outside the MVP.

---

# 5. Roles

A Role is a configurable definition used to create role executions.

Roles are not hard-coded agent classes.

A role consists of:

- identity;
- instructions;
- model/provider configuration;
- available tools;
- permission policy;
- role-specific configuration.

Example roles:

```text
product-owner
designer
developer
backend-developer
qa
security-reviewer
```

A user should eventually be able to define custom roles without modifying the runtime source code.

For example:

```text
roles/
  developer/
  qa/
  designer/
  my-custom-reviewer/
```

The runtime treats them through the same role-execution mechanism.

---

# 6. Role Execution

A role execution is one invocation of a role against a specific work item.

Conceptually:

```text
Role
  +
Work Item Context
  +
Instructions
  +
Model
  +
Tools
  +
Permissions
      ↓
Role Execution
      ↓
Artifacts / Tool Calls / Result
```

An execution does not imply a permanently running autonomous agent.

The runtime may invoke the same role multiple times during one work item.

Example:

```text
Developer execution #1
        ↓
QA execution #1
        ↓
QA result: failed
        ↓
Developer execution #2
        ↓
QA execution #2
```

---

# 7. Permissions

Permissions are a first-class runtime concept.

Role instructions describe what a role is expected to do.

Permissions define what the role is actually allowed to do.

The runtime MUST enforce permissions independently of LLM instructions.

An LLM prompt must never be treated as a security boundary.

---

## 7.1 Permission model

Permissions initially operate at three levels:

### Tool permissions

Whether a role may invoke a particular tool.

Example:

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
```

Example:

```yaml
tools:
  allow:
    - filesystem.read
    - filesystem.write
    - terminal.run
    - git.status
    - git.diff
```

---

### Resource permissions

What resources the role may access.

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

This allows a role to have access to the filesystem without giving it unrestricted access to the entire filesystem.

---

### Operation permissions

Some tools may expose operations with different risk levels.

For example:

```text
git.status
git.diff
git.commit
git.push
```

A role may be allowed to inspect Git state without being allowed to commit or push.

---

# 8. Permission Enforcement

Every tool invocation MUST pass through the runtime permission layer.

Conceptually:

```text
LLM
 ↓
Tool Call
 ↓
Permission Check
 ├── allowed → execute tool
 └── denied  → return permission error
```

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

The runtime should return a structured failure to the role rather than executing the operation.

Permissions must not depend solely on the role's natural-language instructions.

---

# 9. Role and Permission Example

A Developer may have:

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

A QA role may have:

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

The exact permission schema may evolve.

The architectural requirement is that permissions are runtime-enforced and configurable.

---

# 10. Artifacts

Roles communicate primarily through explicit artifacts and work-item state.

Agents should not depend on hidden conversational memory between role executions.

Typical feature artifacts:

```text
projects/<project>/features/FEAT-001/
├── feature.md
├── requirements.md
├── design.md
├── implementation.md
├── qa.md
└── runtime/
```

Not every artifact is required for every workflow.

For example:

```text
default:
requirements.md
implementation.md
qa.md
```

while:

```text
ui:
requirements.md
design.md
implementation.md
qa.md
```

The workflow determines which roles execute and which artifacts are relevant.

---

# 11. Runtime State

Runtime state is stored separately from human-readable artifacts.

Example:

```text
projects/<project>/features/FEAT-001/runtime/
├── state.json
├── execution-plan.json
├── events.jsonl
└── executions/
    ├── 001/
    ├── 002/
    └── 003/
```

`state.json` contains current work-item state, including the persisted outcome status when one has been reached.

The MVP work-item outcome status uses exactly one of these values:

| Status | Meaning |
| ------ | ------- |
| `passed` | QA returned `passed`; the work item is branch/PR-ready and awaits human review. |
| `failed` | An unrecoverable role, tool, or runtime failure prevents the workflow from continuing. This is distinct from an intermediate QA result of `failed` while retries remain. |
| `cancelled` | Execution was intentionally stopped or cannot continue because the target application/process crashed; the terminal status is persisted. |
| `human_required` | The third Developer attempt failed QA; the runtime stops and requires human intervention. |

The `status` field is unset while the work item is active and no terminal outcome has been reached. Once an outcome is reached, execution records and events remain the source of history; the runtime must not invent additional persisted outcome values such as `GREEN`, `HUMAN_REQUIRED`, uppercase `PASS`, or uppercase `FAIL`.

`execution-plan.json` contains the resolved workflow.

`events.jsonl` contains append-only execution events.

`executions/` contains immutable execution records.

---

# 12. Execution Logging

Every role execution should record enough information to reproduce and debug what happened.

At minimum:

- execution ID;
- work-item ID;
- project;
- role;
- workflow;
- step;
- attempt;
- provider;
- model;
- team/runtime version;
- input context;
- output;
- tool calls;
- permission decisions;
- changed files;
- status;
- failure reason;
- timestamp.

The system should make it possible to answer:

> What role ran?

> Which model ran it?

> What did it receive?

> What tools did it call?

> Which operations were denied?

> What files changed?

> Why did it fail?

---

# 13. Product Owner

The Product Owner is responsible for turning a high-level request into an actionable work item.

For a feature, the Product Owner defines:

- scope;
- business context;
- requirements;
- acceptance criteria;
- relevant constraints;
- dependencies;
- suggested workflow template.

The Product Owner may recommend a workflow but does not bypass runtime permissions.

---

# 14. Developer

The Developer implements the work item within its permission boundary.

The Developer may:

- inspect project files;
- modify permitted source files;
- run permitted commands;
- inspect test results;
- inspect QA feedback;
- create implementation artifacts.

The Developer cannot modify resources outside its permission policy.

---

# 15. QA

QA validates the actual resulting behavior against acceptance criteria.

QA may use:

- terminal;
- test runners;
- the browser tool interface, when enabled by the selected QA workflow;
- filesystem inspection;
- project runtime;
- other explicitly permitted tools.

The browser tool interface and its permission checks are MVP capabilities only when required by the selected QA workflow. Playwright integration and browser-based QA are future capabilities.

QA should validate the running application where appropriate rather than relying only on source-code inspection.

QA produces a structured result:

```yaml
status: passed
```

or:

```yaml
status: failed

criterion: AC-003

reason: Name was not persisted after reload

evidence:
  expected: "John"
  actual: "Jane"
```

QA does not modify implementation source in the MVP.

---

# 16. Failure and Retry

If a QA result has `status: failed`, the default MVP loop is:

```text
QA result: failed
   ↓
Developer
   ↓
QA
```

Counting rules:

- An **attempt** is one Developer execution against this work item.
- Attempt 1 runs as part of the initial workflow.
- After each QA failure the runtime may run another Developer execution — that is the next attempt.
- Maximum: **3 attempts in total** (the initial Developer execution + up to 2 retries).
- After the third attempt fails its QA, the runtime sets the work-item status to `human_required` and stops for human intervention.
- The runtime must preserve all attempts and their logs.

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

If execution is stopped or the target application/process crashes, persist `cancelled`. If an unrecoverable role, tool, or runtime failure prevents continuation, persist `failed`.

See `docs/execution.md` for the per-execution logging and event-log details.

---

# 17. Regression Testing

Completed work items do not need to be re-executed as workflows.

Instead, QA may produce regression checks associated with completed work.

Example:

```yaml
id: REG-001

source:
  feature: FEAT-001

description: Saved user name persists after page reload
```

When a later feature or bug affects the relevant area, QA may execute applicable regression checks.

A regression check can therefore retain provenance:

```text
Regression Check
      ↓
source feature / bug
      ↓
later work item
      ↓
QA
```

This allows new work to detect regressions without reopening old features.

---

# 18. Git Model

Each work item receives its own branch.

Example:

```text
feature/FEAT-001-save-button
bug/BUG-001-save-button-persistence
```

The preferred unit of Git history is the work item or meaningful implementation step.

The MVP should prepare a branch and PR-ready state but should require human approval before merge.

---

# 19. Target Project

The target project is replaceable.

The AI Team runtime must not hard-code a particular application.

A project configuration identifies:

- repository;
- working directory;
- technology stack;
- start command;
- test commands;
- development server;
- health check;
- project conventions.

The runtime operates against the configured target project.

---

# 20. LLM Provider

The core runtime must be provider-agnostic.

The first implementation may use OpenRouter.

Future providers may include:

- OpenAI;
- Anthropic;
- local models;
- other compatible providers.

Roles should select model/provider through configuration rather than runtime-specific code.

---

# 21. Filesystem-First Storage

The MVP uses the filesystem as the source of truth.

A database is not required.

The filesystem should contain:

- projects;
- work items;
- artifacts;
- workflows;
- role definitions;
- execution state;
- logs.

A database may be introduced later if concrete requirements justify it.

---

# 22. MVP

The MVP should support one complete vertical slice:

```text
User
 ↓
Create project
 ↓
Create work item
 ↓
Select workflow
 ↓
Resolve execution plan
 ↓
Product Owner
 ↓
Developer
 ↓
QA
 ↓
QA result: passed
 ↓
Work-item status: passed
 ↓
Git branch / PR-ready state
 ↓
Human review
```

The runtime must demonstrate:

- LLM execution;
- role configuration;
- workflow execution;
- artifact passing;
- tool execution;
- permission enforcement;
- Git integration;
- QA result using permitted tools configured for the selected workflow;
- browser tool interface and permission model only when required by the selected QA workflow;
- retry handling;
- execution logging.

Playwright integration and browser-based QA are future capabilities and are not required for the MVP.

---

# 23. MVP Out of Scope

The following are explicitly outside the MVP:

- database;
- distributed execution;
- autonomous multi-agent chat;
- automatic merge;
- automatic issue creation;
- complex workflow inference;
- vector database;
- long-term semantic memory;
- model benchmarking UI;
- Figma integration;
- advanced permission policy languages;
- dynamic agent spawning;
- autonomous production deployment.

---

# 24. Future Capabilities

Possible future capabilities include:

- custom user-defined roles;
- capability-based workflow resolution;
- richer permission policies;
- Playwright integration;
- browser-based QA;
- regression test management;
- security-review roles;
- backend/frontend specialist roles;
- human approval checkpoints;
- autonomous execution mode;
- model comparison;
- execution evaluation;
- remote runtime;
- persistent background execution.

---

# 25. Architectural Rule

The system should preserve the following separation:

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

The critical architectural boundaries are:

- **Work Item** defines what needs to be done.
- **Workflow** defines who participates and in what order.
- **Role** defines how a participant is instructed and configured.
- **Permissions** define what that role is actually allowed to do.
- **Runtime** enforces the workflow and permissions and executes tools.
- **Artifacts** provide explicit communication between role executions.
- **Target Project** is the software being changed.

Roles must remain configuration rather than hard-coded agent implementations.

Permissions must remain runtime-enforced rather than prompt-enforced.

Workflow templates must remain reusable rather than copied into every work item.
