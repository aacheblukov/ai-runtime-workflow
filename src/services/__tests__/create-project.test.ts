import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectService } from "@/services/project-service.js";
import { validateProjectName } from "@/services/validation.js";
import { NodeFilesystem } from "@/storage/filesystem.js";

describe("validateProjectName", () => {
  it("accepts a simple lowercase name", () => {
    expect(() => validateProjectName("demo-app")).not.toThrow();
  });

  it("accepts names with numbers after the first letter", () => {
    expect(() => validateProjectName("demo-app-123")).not.toThrow();
    expect(() => validateProjectName("app2")).not.toThrow();
  });

  it("accepts a single lowercase letter", () => {
    expect(() => validateProjectName("a")).not.toThrow();
  });

  it("accepts a name of exactly 50 characters", () => {
    const name = "a".repeat(50);
    expect(() => validateProjectName(name)).not.toThrow();
  });

  it("throws for names with uppercase letters", () => {
    expect(() => validateProjectName("DemoApp")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
    expect(() => validateProjectName("demo-app-UPPER")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
  });

  it("throws for names starting with a digit", () => {
    expect(() => validateProjectName("1demo-app")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
  });

  it("throws for names starting with a hyphen", () => {
    expect(() => validateProjectName("-demo-app")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
  });

  it("throws for names containing underscores", () => {
    expect(() => validateProjectName("demo_app")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
  });

  it("throws for names containing spaces", () => {
    expect(() => validateProjectName("demo app")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
  });

  it("throws for empty names", () => {
    expect(() => validateProjectName("")).toThrow(
      /must start with a letter and contain only lowercase/,
    );
  });

  it("throws for names longer than 50 characters", () => {
    const name = "a".repeat(51);
    expect(() => validateProjectName(name)).toThrow(
      /must be 50 characters or less/,
    );
  });
});

describe("ProjectService", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;
  let service: ProjectService;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-create-project-"),
    );
    process.chdir(rootDirectory);

    filesystem = new NodeFilesystem();
    service = new ProjectService(filesystem);

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("creates the full project directory structure", async () => {
    await service.createProject("demo-app");

    const projectRoot = join(rootDirectory, "projects", "demo-app");

    expect((await stat(join(projectRoot, "features"))).isDirectory()).toBe(
      true,
    );
    expect((await stat(join(projectRoot, "bugs"))).isDirectory()).toBe(true);
    expect((await stat(join(projectRoot, "project.md"))).isFile()).toBe(true);
    expect((await stat(join(projectRoot, "backlog.md"))).isFile()).toBe(true);
  });

  it("creates project.md with the project name as the heading", async () => {
    await service.createProject("demo-app");

    const projectRoot = join(rootDirectory, "projects", "demo-app");
    const contents = await readFile(join(projectRoot, "project.md"), "utf8");

    expect(contents).toContain("# demo-app");
    expect(contents).toContain("Project created via AI Runtime.");
  });

  it("creates backlog.md with Features and Bugs sections", async () => {
    await service.createProject("demo-app");

    const projectRoot = join(rootDirectory, "projects", "demo-app");
    const contents = await readFile(join(projectRoot, "backlog.md"), "utf8");

    expect(contents).toContain("# Backlog");
    expect(contents).toContain("## Features");
    expect(contents).toContain("## Bugs");
  });

  it("rejects an invalid project name before creating anything", async () => {
    await expect(service.createProject("InvalidName")).rejects.toThrow(
      /must start with a letter and contain only lowercase/,
    );

    // Nothing should have been created.
    const projectsDir = join(rootDirectory, "projects");
    await expect(stat(projectsDir)).rejects.toThrow();
  });

  it("prevents overwriting an existing project without --force", async () => {
    await service.createProject("demo-app");

    await expect(service.createProject("demo-app")).rejects.toThrow(
      'Project "demo-app" already exists. Use --force to overwrite.',
    );
  });

  it("overwrites an existing project when --force is set", async () => {
    await service.createProject("demo-app");
    await expect(
      service.createProject("demo-app", { force: true }),
    ).resolves.toBeUndefined();

    const projectRoot = join(rootDirectory, "projects", "demo-app");
    expect((await stat(join(projectRoot, "project.md"))).isFile()).toBe(true);
    expect((await stat(join(projectRoot, "features"))).isDirectory()).toBe(
      true,
    );
    expect((await stat(join(projectRoot, "bugs"))).isDirectory()).toBe(true);
  });
});
