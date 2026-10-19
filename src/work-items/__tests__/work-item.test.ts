import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodeFilesystem } from "@/storage/filesystem.js";
import { WorkItem } from "@/work-items/work-item.js";
import type { Bug, Feature } from "@/work-items/work-item.js";

function makeFeatureMetadata(overrides: Partial<Feature> = {}): Feature {
  return {
    id: "FEAT-001",
    type: "feature",
    title: "Test Feature",
    description: "A test feature description",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeBugMetadata(overrides: Partial<Bug> = {}): Bug {
  return {
    id: "BUG-001",
    type: "bug",
    title: "Test Bug",
    description: "A test bug description",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WorkItem static helpers", () => {
  describe("descriptorFile", () => {
    it("returns 'feature.md' for feature type", () => {
      expect(WorkItem.descriptorFile("feature")).toBe("feature.md");
    });

    it("returns 'bug.md' for bug type", () => {
      expect(WorkItem.descriptorFile("bug")).toBe("bug.md");
    });
  });

  describe("typePrefix", () => {
    it("returns 'FEAT' for feature type", () => {
      expect(WorkItem.typePrefix("feature")).toBe("FEAT");
    });

    it("returns 'BUG' for bug type", () => {
      expect(WorkItem.typePrefix("bug")).toBe("BUG");
    });
  });

  describe("generateId", () => {
    it("generates FEAT-001 when no IDs exist", () => {
      expect(WorkItem.generateId("feature", [])).toBe("FEAT-001");
    });

    it("generates BUG-001 when no IDs exist", () => {
      expect(WorkItem.generateId("bug", [])).toBe("BUG-001");
    });

    it("increments from a single existing ID", () => {
      expect(WorkItem.generateId("feature", ["FEAT-001"])).toBe("FEAT-002");
      expect(WorkItem.generateId("bug", ["BUG-001"])).toBe("BUG-002");
    });

    it("finds the maximum existing ID and increments", () => {
      expect(
        WorkItem.generateId("feature", ["FEAT-001", "FEAT-003", "FEAT-002"]),
      ).toBe("FEAT-004");
    });

    it("ignores IDs of the other type", () => {
      expect(WorkItem.generateId("feature", ["BUG-005", "FEAT-001"])).toBe(
        "FEAT-002",
      );
      expect(WorkItem.generateId("bug", ["FEAT-005", "BUG-001"])).toBe(
        "BUG-002",
      );
    });

    it("handles IDs with more than 3 digits", () => {
      expect(WorkItem.generateId("feature", ["FEAT-0999"])).toBe("FEAT-1000");
    });

    it("pads new IDs to at least 3 digits", () => {
      expect(WorkItem.generateId("feature", [])).toBe("FEAT-001");
    });
  });
});

describe("WorkItem construction", () => {
  it("stores root and descriptorPath from the record", () => {
    const workItem = new WorkItem({
      root: "/fake/projects/demo/features/FEAT-001",
      descriptorPath: "/fake/projects/demo/features/FEAT-001/feature.md",
      metadata: makeFeatureMetadata(),
      body: "Some body content",
    });

    expect(workItem.root).toBe("/fake/projects/demo/features/FEAT-001");
    expect(workItem.descriptorPath).toBe(
      "/fake/projects/demo/features/FEAT-001/feature.md",
    );
  });

  it("exposes id and type via getters", () => {
    const workItem = new WorkItem({
      root: "/fake/FEAT-001",
      descriptorPath: "/fake/FEAT-001/feature.md",
      metadata: makeFeatureMetadata(),
      body: "Body",
    });

    expect(workItem.id).toBe("FEAT-001");
    expect(workItem.type).toBe("feature");
  });

  it("can be constructed for a bug", () => {
    const workItem = new WorkItem({
      root: "/fake/BUG-001",
      descriptorPath: "/fake/BUG-001/bug.md",
      metadata: makeBugMetadata(),
      body: "Bug body",
    });

    expect(workItem.id).toBe("BUG-001");
    expect(workItem.type).toBe("bug");
  });

  it("stores metadata and body", () => {
    const metadata = makeFeatureMetadata({ title: "Custom Title" });
    const workItem = new WorkItem({
      root: "/fake",
      descriptorPath: "/fake/feature.md",
      metadata,
      body: "Custom body",
    });

    expect(workItem.metadata.title).toBe("Custom Title");
    expect(workItem.body).toBe("Custom body");
  });

  it("allows updating body and metadata", () => {
    const workItem = new WorkItem({
      root: "/fake",
      descriptorPath: "/fake/feature.md",
      metadata: makeFeatureMetadata(),
      body: "Original body",
    });

    workItem.body = "Updated body";
    workItem.metadata.title = "Updated Title";

    expect(workItem.body).toBe("Updated body");
    expect(workItem.metadata.title).toBe("Updated Title");
  });
});

describe("WorkItem loading", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-work-item-"),
    );
    filesystem = new NodeFilesystem();
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("loads a feature descriptor from disk", async () => {
    const featureRoot = join(
      rootDirectory,
      "projects",
      "demo-app",
      "features",
      "FEAT-001",
    );
    await filesystem.createDirectory(featureRoot);

    const descriptor = [
      "---",
      "id: FEAT-001",
      "type: feature",
      "title: Save button",
      "description: Add a save button",
      "createdAt: 2024-01-01T00:00:00.000Z",
      "updatedAt: 2024-01-01T00:00:00.000Z",
      "---",
      "This is the feature body.",
      "",
    ].join("\n");

    await filesystem.writeFile(join(featureRoot, "feature.md"), descriptor);

    const workItem = await WorkItem.load(filesystem, featureRoot);

    expect(workItem.id).toBe("FEAT-001");
    expect(workItem.type).toBe("feature");
    expect(workItem.metadata.title).toBe("Save button");
    expect(workItem.metadata.description).toBe("Add a save button");
    expect(workItem.body).toBe("This is the feature body.\n");
  });

  it("loads a bug descriptor from disk", async () => {
    const bugRoot = join(
      rootDirectory,
      "projects",
      "demo-app",
      "bugs",
      "BUG-001",
    );
    await filesystem.createDirectory(bugRoot);

    const descriptor = [
      "---",
      "id: BUG-001",
      "type: bug",
      "title: Save not persisting",
      "description: Data is lost on reload",
      "createdAt: 2024-01-01T00:00:00.000Z",
      "updatedAt: 2024-01-01T00:00:00.000Z",
      "---",
      "Bug body text.",
      "",
    ].join("\n");

    await filesystem.writeFile(join(bugRoot, "bug.md"), descriptor);

    const workItem = await WorkItem.load(filesystem, bugRoot);

    expect(workItem.id).toBe("BUG-001");
    expect(workItem.type).toBe("bug");
    expect(workItem.metadata.title).toBe("Save not persisting");
    expect(workItem.metadata.description).toBe("Data is lost on reload");
    expect(workItem.body).toBe("Bug body text.\n");
  });

  it("throws when no descriptor file is found", async () => {
    const emptyRoot = join(rootDirectory, "empty", "FEAT-001");
    await filesystem.createDirectory(emptyRoot);

    await expect(WorkItem.load(filesystem, emptyRoot)).rejects.toThrow(
      /no descriptor/i,
    );
  });

  it("prefers feature.md over bug.md when both exist", async () => {
    const dualRoot = join(rootDirectory, "DUAL-001");
    await filesystem.createDirectory(dualRoot);

    await filesystem.writeFile(
      join(dualRoot, "feature.md"),
      "---\nid: FEAT-001\ntype: feature\ntitle: T\ndescription: D\ncreatedAt: 2024-01-01T00:00:00.000Z\nupdatedAt: 2024-01-01T00:00:00.000Z\n---\nFeature body.\n",
    );
    await filesystem.writeFile(
      join(dualRoot, "bug.md"),
      "---\nid: BUG-001\ntype: bug\ntitle: T\ndescription: D\ncreatedAt: 2024-01-01T00:00:00.000Z\nupdatedAt: 2024-01-01T00:00:00.000Z\n---\nBug body.\n",
    );

    const workItem = await WorkItem.load(filesystem, dualRoot);

    expect(workItem.type).toBe("feature");
    expect(workItem.id).toBe("FEAT-001");
    expect(workItem.body).toBe("Feature body.\n");
  });
});

describe("WorkItem saving", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-work-item-"),
    );
    filesystem = new NodeFilesystem();
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("writes a feature descriptor to disk with frontmatter and body", async () => {
    const featureRoot = join(
      rootDirectory,
      "projects",
      "demo-app",
      "features",
      "FEAT-001",
    );
    await filesystem.createDirectory(featureRoot);

    const workItem = new WorkItem({
      root: featureRoot,
      descriptorPath: join(featureRoot, "feature.md"),
      metadata: {
        id: "FEAT-001",
        type: "feature",
        title: "Save button",
        description: "Add a save button",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      body: "Detailed feature description.",
    });

    await workItem.save(filesystem);

    const written = await filesystem.readFile(join(featureRoot, "feature.md"));
    expect(written).toContain("---");
    expect(written).toContain("id: FEAT-001");
    expect(written).toContain("type: feature");
    expect(written).toContain("title: Save button");
    expect(written).toContain("description: Add a save button");
    expect(written).toContain("Detailed feature description.");
  });

  it("writes a bug descriptor with source provenance", async () => {
    const bugRoot = join(
      rootDirectory,
      "projects",
      "demo-app",
      "bugs",
      "BUG-001",
    );
    await filesystem.createDirectory(bugRoot);

    const workItem = new WorkItem({
      root: bugRoot,
      descriptorPath: join(bugRoot, "bug.md"),
      metadata: {
        id: "BUG-001",
        type: "bug",
        title: "Save not persisting",
        description: "Data is lost on reload",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        source: { feature: "FEAT-001" },
      },
      body: "Bug details here.",
    });

    await workItem.save(filesystem);

    const written = await filesystem.readFile(join(bugRoot, "bug.md"));
    expect(written).toContain("id: BUG-001");
    expect(written).toContain("type: bug");
    expect(written).toContain("feature: FEAT-001");
    expect(written).toContain("Bug details here.");
  });

  it("overwrites existing descriptor content on re-save", async () => {
    const featureRoot = join(rootDirectory, "FEAT-001");
    await filesystem.createDirectory(featureRoot);

    const oldDescriptor = [
      "---",
      "id: FEAT-001",
      "type: feature",
      "title: Old title",
      "description: Old desc",
      "createdAt: 2024-01-01T00:00:00.000Z",
      "updatedAt: 2024-01-01T00:00:00.000Z",
      "---",
      "Old body.",
    ].join("\n");

    await filesystem.writeFile(join(featureRoot, "feature.md"), oldDescriptor);

    const workItem = new WorkItem({
      root: featureRoot,
      descriptorPath: join(featureRoot, "feature.md"),
      metadata: {
        id: "FEAT-001",
        type: "feature",
        title: "New title",
        description: "New desc",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T12:00:00.000Z",
      },
      body: "New body.",
    });

    await workItem.save(filesystem);

    const written = await filesystem.readFile(join(featureRoot, "feature.md"));
    expect(written).toContain("title: New title");
    expect(written).toContain("New body.");
    expect(written).not.toContain("Old title");
  });
});

describe("WorkItem save/load round-trip", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-work-item-"),
    );
    filesystem = new NodeFilesystem();
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("preserves feature metadata and body through save/load", async () => {
    const featureRoot = join(
      rootDirectory,
      "projects",
      "demo-app",
      "features",
      "FEAT-001",
    );
    await filesystem.createDirectory(featureRoot);

    const original = new WorkItem({
      root: featureRoot,
      descriptorPath: join(featureRoot, "feature.md"),
      metadata: {
        id: "FEAT-001",
        type: "feature",
        title: "Save button",
        description: "Add a save button",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T12:00:00.000Z",
        request: "Create a Save button",
        capabilities: ["frontend", "backend"],
        workflow: { template: "default", version: 1 },
      },
      body: "This is the body.\n\nMore details.\n",
    });

    await original.save(filesystem);
    const loaded = await WorkItem.load(filesystem, featureRoot);

    expect(loaded.id).toBe("FEAT-001");
    expect(loaded.type).toBe("feature");
    expect(loaded.metadata.title).toBe("Save button");
    expect(loaded.metadata.description).toBe("Add a save button");
    expect(loaded.metadata.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(loaded.metadata.updatedAt).toBe("2024-01-01T12:00:00.000Z");
    expect(loaded.metadata.request).toBe("Create a Save button");
    expect(loaded.metadata.capabilities).toEqual(["frontend", "backend"]);
    expect(loaded.metadata.workflow).toEqual({
      template: "default",
      version: 1,
    });
    expect(loaded.body).toBe("This is the body.\n\nMore details.\n");
  });

  it("preserves bug metadata with source through save/load", async () => {
    const bugRoot = join(
      rootDirectory,
      "projects",
      "demo-app",
      "bugs",
      "BUG-001",
    );
    await filesystem.createDirectory(bugRoot);

    const original = new WorkItem({
      root: bugRoot,
      descriptorPath: join(bugRoot, "bug.md"),
      metadata: {
        id: "BUG-001",
        type: "bug",
        title: "Save not persisting",
        description: "Data lost on reload",
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-01T08:00:00.000Z",
        source: { feature: "FEAT-001" },
      },
      body: "Bug reproduction steps.",
    });

    await original.save(filesystem);
    const loaded = await WorkItem.load(filesystem, bugRoot);

    expect(loaded.id).toBe("BUG-001");
    expect(loaded.type).toBe("bug");
    expect(loaded.metadata.source).toEqual({ feature: "FEAT-001" });
    expect(loaded.body).toBe("Bug reproduction steps.");
  });
});

describe("WorkItem validation", () => {
  it("returns a valid result for correct feature metadata", () => {
    const workItem = new WorkItem({
      root: "/fake",
      descriptorPath: "/fake/feature.md",
      metadata: makeFeatureMetadata(),
      body: "",
    });

    const result = workItem.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns a valid result for correct bug metadata", () => {
    const workItem = new WorkItem({
      root: "/fake",
      descriptorPath: "/fake/bug.md",
      metadata: makeBugMetadata(),
      body: "",
    });

    const result = workItem.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns an invalid result for malformed metadata", () => {
    const workItem = new WorkItem({
      root: "/fake",
      descriptorPath: "/fake/feature.md",
      metadata: {
        id: "BAD-ID",
        type: "feature",
        title: "",
        description: "",
        createdAt: "invalid",
        updatedAt: "invalid",
      },
      body: "",
    });

    const result = workItem.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("detects id/type prefix mismatch", () => {
    const workItem = new WorkItem({
      root: "/fake",
      descriptorPath: "/fake/feature.md",
      metadata: {
        id: "BUG-001",
        type: "feature",
        title: "Test",
        description: "Test",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      body: "",
    });

    const result = workItem.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "id")).toBe(true);
  });
});

describe("WorkItem creation", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;
  let projectRoot: string;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-work-item-"),
    );
    filesystem = new NodeFilesystem();
    projectRoot = join(rootDirectory, "projects", "demo-app");
    await filesystem.createDirectory(projectRoot);
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("creates a feature with generated ID and descriptor file", async () => {
    const workItem = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "Save button",
      description: "Add a save button to the form",
      request: "Create a Save button",
    });

    expect(workItem.id).toBe("FEAT-001");
    expect(workItem.type).toBe("feature");
    expect(workItem.metadata.title).toBe("Save button");
    expect(workItem.metadata.description).toBe("Add a save button to the form");
    expect(workItem.metadata.request).toBe("Create a Save button");

    const statResult = await stat(workItem.descriptorPath);
    expect(statResult.isFile()).toBe(true);
  });

  it("creates a bug with generated ID and descriptor file", async () => {
    const workItem = await WorkItem.createBug(filesystem, projectRoot, {
      title: "Save not persisting",
      description: "Data is lost on reload",
      source: { feature: "FEAT-001" },
    });

    expect(workItem.id).toBe("BUG-001");
    expect(workItem.type).toBe("bug");
    expect(workItem.metadata.title).toBe("Save not persisting");
    expect(workItem.metadata.description).toBe("Data is lost on reload");
    expect(workItem.metadata.source).toEqual({ feature: "FEAT-001" });

    const statResult = await stat(workItem.descriptorPath);
    expect(statResult.isFile()).toBe(true);
  });

  it("generates sequential IDs for multiple features", async () => {
    const first = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "First",
      description: "First feature",
    });
    const second = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "Second",
      description: "Second feature",
    });

    expect(first.id).toBe("FEAT-001");
    expect(second.id).toBe("FEAT-002");
  });

  it("generates sequential IDs for multiple bugs", async () => {
    const first = await WorkItem.createBug(filesystem, projectRoot, {
      title: "First bug",
      description: "First bug desc",
    });
    const second = await WorkItem.createBug(filesystem, projectRoot, {
      title: "Second bug",
      description: "Second bug desc",
    });

    expect(first.id).toBe("BUG-001");
    expect(second.id).toBe("BUG-002");
  });

  it("scans existing directories to find the next ID", async () => {
    await filesystem.createDirectory(join(projectRoot, "features", "FEAT-001"));

    const workItem = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "New feature",
      description: "Desc",
    });

    expect(workItem.id).toBe("FEAT-002");
  });

  it("sets createdAt and updatedAt timestamps", async () => {
    const before = new Date();
    const workItem = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "Test",
      description: "Test",
    });
    const after = new Date();

    const createdAt = new Date(workItem.metadata.createdAt);
    const updatedAt = new Date(workItem.metadata.updatedAt);

    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("creates descriptor that loads back correctly", async () => {
    const workItem = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "Round-trip feature",
      description: "Round-trip description",
      request: "Original request",
      capabilities: ["backend"],
      workflow: { template: "default" },
    });

    const loaded = await WorkItem.load(filesystem, workItem.root);

    expect(loaded.id).toBe(workItem.id);
    expect(loaded.type).toBe("feature");
    expect(loaded.metadata.title).toBe("Round-trip feature");
    expect(loaded.metadata.request).toBe("Original request");
    expect(loaded.metadata.capabilities).toEqual(["backend"]);
    expect(loaded.metadata.workflow).toEqual({ template: "default" });
  });

  it("creates work item directory under features/ for features", async () => {
    const workItem = await WorkItem.createFeature(filesystem, projectRoot, {
      title: "Dir test",
      description: "Desc",
    });

    expect(workItem.root).toBe(join(projectRoot, "features", workItem.id));
    expect(workItem.descriptorPath).toBe(
      join(projectRoot, "features", workItem.id, "feature.md"),
    );
  });

  it("creates work item directory under bugs/ for bugs", async () => {
    const workItem = await WorkItem.createBug(filesystem, projectRoot, {
      title: "Dir test",
      description: "Desc",
    });

    expect(workItem.root).toBe(join(projectRoot, "bugs", workItem.id));
    expect(workItem.descriptorPath).toBe(
      join(projectRoot, "bugs", workItem.id, "bug.md"),
    );
  });
});
