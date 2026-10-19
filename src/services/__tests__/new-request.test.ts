import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeFilesystem } from "@/storage/filesystem.js";
import { ProjectService } from "@/services/project-service.js";
import { WorkItemService } from "@/services/work-item-service.js";

describe("WorkItemService (Integration)", () => {
  let originalCwd: string;
  let rootDirectory: string;
  let filesystem: NodeFilesystem;
  let projectService: ProjectService;
  let workItemService: WorkItemService;

  beforeEach(async () => {
    originalCwd = process.cwd();
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-new-request-"),
    );
    process.chdir(rootDirectory);

    filesystem = new NodeFilesystem();
    projectService = new ProjectService(filesystem);
    workItemService = new WorkItemService(filesystem);

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("creates a feature with FEAT-001 for a new project", async () => {
    await projectService.createProject("demo-app");

    const workItem = await workItemService.createFeature(
      "demo-app",
      "Create a Save button",
    );

    expect(workItem.id).toBe("FEAT-001");
    const featureDir = join(
      rootDirectory,
      "projects",
      "demo-app",
      "features",
      "FEAT-001",
    );
    expect((await stat(featureDir)).isDirectory()).toBe(true);
    expect((await stat(join(featureDir, "feature.md"))).isFile()).toBe(true);
    expect((await stat(join(featureDir, "runtime"))).isDirectory()).toBe(true);
  });

  it("creates the runtime directory under the feature directory", async () => {
    await projectService.createProject("demo-app");

    const workItem = await workItemService.createFeature(
      "demo-app",
      "Create a Save button",
    );

    const runtimeDir = join(workItem.root, "runtime");
    expect((await stat(runtimeDir)).isDirectory()).toBe(true);
  });

  it("creates feature.md with a valid frontmatter descriptor", async () => {
    await projectService.createProject("demo-app");

    const workItem = await workItemService.createFeature(
      "demo-app",
      "Create a Save button",
    );
    const contents = await readFile(workItem.descriptorPath, "utf8");

    expect(contents).toContain("---\n");
    expect(contents).toContain("id: FEAT-001");
    expect(contents).toContain("type: feature");
    expect(contents).toContain("title: Create a Save button");
    expect(contents).toContain("description: Create a Save button");
    expect(contents).toContain("request: Create a Save button");
  });

  it("stores the original request in the descriptor", async () => {
    await projectService.createProject("demo-app");

    const request = "As a user, I want to log in with email and password";
    const workItem = await workItemService.createFeature("demo-app", request);

    const contents = await readFile(workItem.descriptorPath, "utf8");
    expect(contents).toContain(`request: ${request}`);
  });

  it("generates sequential IDs when multiple features are created", async () => {
    await projectService.createProject("demo-app");

    const first = await workItemService.createFeature(
      "demo-app",
      "Create a Save button",
    );
    const second = await workItemService.createFeature(
      "demo-app",
      "Add a Cancel button",
    );

    expect(first.id).toBe("FEAT-001");
    expect(second.id).toBe("FEAT-002");
    expect(first.root).not.toBe(second.root);
  });

  it("creates a separate runtime directory for each feature", async () => {
    await projectService.createProject("demo-app");

    const first = await workItemService.createFeature(
      "demo-app",
      "Create a Save button",
    );
    await workItemService.createFeature("demo-app", "Add a Cancel button");

    expect((await stat(join(first.root, "runtime"))).isDirectory()).toBe(true);
  });

  it("adds the feature to the project backlog with the work-item ID", async () => {
    await projectService.createProject("demo-app");

    await workItemService.createFeature("demo-app", "Create a Save button");
    const backlogPath = join(
      rootDirectory,
      "projects",
      "demo-app",
      "backlog.md",
    );
    const contents = await readFile(backlogPath, "utf8");

    expect(contents).toContain("FEAT-001");
    expect(contents).toContain("Create a Save button");
    expect(contents).toContain("- [ ]");
  });

  it("preserves existing Features and Bugs sections when adding to the backlog", async () => {
    await projectService.createProject("demo-app");

    await workItemService.createFeature("demo-app", "Create a Save button");
    const backlogPath = join(
      rootDirectory,
      "projects",
      "demo-app",
      "backlog.md",
    );
    const contents = await readFile(backlogPath, "utf8");

    expect(contents).toContain("## Features");
    expect(contents).toContain("## Bugs");
  });

  it("does not write a workflow field for the default creation", async () => {
    await projectService.createProject("demo-app");

    const workItem = await workItemService.createFeature(
      "demo-app",
      "Create a Save button",
    );
    const contents = await readFile(workItem.descriptorPath, "utf8");

    expect(contents).not.toContain("workflow:");
  });

  it("throws when the target project does not exist", async () => {
    await expect(
      workItemService.createFeature(
        "nonexistent-project",
        "Create a Save button",
      ),
    ).rejects.toThrow(/does not exist/);
  });

  it("throws when the request is empty", async () => {
    await projectService.createProject("demo-app");

    await expect(workItemService.createFeature("demo-app", "")).rejects.toThrow(
      /Request must be a non-empty string/,
    );
  });

  it("rejects an invalid project name before creating anything", async () => {
    await expect(
      workItemService.createFeature("InvalidName", "Create a Save button"),
    ).rejects.toThrow(/Project name must start with a letter/);

    const projectsDir = join(rootDirectory, "projects");
    await expect(stat(projectsDir)).rejects.toThrow();
  });
});

describe("appendFeatureToBacklog (Backlog methods)", () => {
  let rootDirectory: string;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-backlog-"),
    );
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("seeds a backlog file when one does not exist yet", async () => {
    const backlogPath = join(rootDirectory, "backlog.md");
    const fs = new NodeFilesystem();
    const service = new WorkItemService(fs);

    await service.appendFeatureToBacklog(
      backlogPath,
      "FEAT-001",
      "Create a Save button",
    );

    const contents = await readFile(backlogPath, "utf8");
    expect(contents).toContain("# Backlog");
    expect(contents).toContain("## Features");
    expect(contents).toContain("- [ ] FEAT-001 — Create a Save button");
  });
});
