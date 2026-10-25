import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodeFilesystem } from "@/storage/filesystem.js";
import { WorkflowLoader } from "@/workflows/loader.js";
import { WORKFLOW_SCHEMA_VERSION } from "@/workflows/types.js";

describe("WorkflowLoader (temp directory)", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;
  let templatesDir: string;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), "ai-runtime-workflow-workflows-"));
    templatesDir = join(rootDirectory, "workflows");
    filesystem = new NodeFilesystem();
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  async function writeTemplate(name: string, yaml: string): Promise<void> {
    await filesystem.createFile(join(templatesDir, `${name}.yaml`), yaml);
  }

  describe("load", () => {
    it("loads a valid workflow template with name and steps", async () => {
      await writeTemplate(
        "default",
        "name: default\nsteps:\n  - product-owner\n  - developer\n  - qa\n",
      );
      const loader = new WorkflowLoader(filesystem, templatesDir);

      const template = await loader.load("default");

      expect(template.name).toBe("default");
      expect(template.steps).toEqual(["product-owner", "developer", "qa"]);
    });

    it("defaults version to 1 when not specified in YAML", async () => {
      await writeTemplate("minimal", "name: minimal\nsteps:\n  - developer\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      const template = await loader.load("minimal");

      expect(template.version).toBe(WORKFLOW_SCHEMA_VERSION);
      expect(template.version).toBe(1);
    });

    it("preserves explicit version from YAML", async () => {
      await writeTemplate("v2", "name: v2\nversion: 2\nsteps:\n  - developer\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      const template = await loader.load("v2");

      expect(template.version).toBe(2);
    });

    it("loads optional fields when present", async () => {
      const yaml = [
        "name: full",
        "version: 1",
        "steps:",
        "  - product-owner",
        "  - developer",
        "  - qa",
        "optional:",
        "  - product-owner",
        "retry:",
        "  role: developer",
        "  maxAttempts: 3",
      ].join("\n");
      await writeTemplate("full", yaml);

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const template = await loader.load("full");

      expect(template.optional).toEqual(["product-owner"]);
      expect(template.retry).toEqual({ role: "developer", maxAttempts: 3 });
    });

    it("loads transitions and approval when present", async () => {
      const yaml = [
        "name: advanced",
        "version: 1",
        "steps:",
        "  - product-owner",
        "  - developer",
        "  - qa",
        "transitions:",
        "  - from: qa",
        "    on: failed",
        "    to: developer",
        "approval:",
        "  - step: qa",
        "    when: passed",
      ].join("\n");
      await writeTemplate("advanced", yaml);

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const template = await loader.load("advanced");

      expect(template.transitions).toEqual([{ from: "qa", on: "failed", to: "developer" }]);
      expect(template.approval).toEqual([{ step: "qa", when: "passed" }]);
    });

    it("does not set optional fields when absent in YAML", async () => {
      await writeTemplate("simple", "name: simple\nsteps:\n  - developer\n  - qa\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      const template = await loader.load("simple");

      expect(template.optional).toBeUndefined();
      expect(template.retry).toBeUndefined();
      expect(template.transitions).toBeUndefined();
      expect(template.approval).toBeUndefined();
    });

    it("throws when template file is not found", async () => {
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("nonexistent")).rejects.toThrow(/not found/i);
    });

    it("throws when template has no name", async () => {
      await writeTemplate("bad", "steps:\n  - developer\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("bad")).rejects.toThrow(/Invalid workflow template/);
    });

    it("throws when template has no steps", async () => {
      await writeTemplate("bad", "name: bad\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("bad")).rejects.toThrow(/Invalid workflow template/);
    });

    it("throws when template has unknown field", async () => {
      await writeTemplate("bad", "name: bad\nsteps:\n  - developer\nunknown: value\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("bad")).rejects.toThrow(/Invalid workflow template/);
    });

    it("throws for path traversal attempt in template name", async () => {
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("../something")).rejects.toThrow(/Invalid workflow template name/);
    });

    it("throws for absolute path in template name", async () => {
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("/etc/passwd")).rejects.toThrow(/Invalid workflow template name/);
    });

    it("throws for backslash in template name", async () => {
      const loader = new WorkflowLoader(filesystem, templatesDir);

      await expect(loader.load("..\\something")).rejects.toThrow(/Invalid workflow template name/);
    });

    it("can load a template named with dashes", async () => {
      await writeTemplate("my-template", "name: my-template\nsteps:\n  - developer\n");
      const loader = new WorkflowLoader(filesystem, templatesDir);

      const template = await loader.load("my-template");

      expect(template.name).toBe("my-template");
      expect(template.steps).toEqual(["developer"]);
    });
  });

  describe("list", () => {
    it("lists all .yaml templates in the directory", async () => {
      await writeTemplate("alpha", "name: alpha\nsteps:\n  - developer\n");
      await writeTemplate("beta", "name: beta\nsteps:\n  - developer\n");
      await writeTemplate("gamma", "name: gamma\nsteps:\n  - developer\n");

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const templates = await loader.list();

      expect(templates).toEqual(["alpha", "beta", "gamma"]);
    });

    it("ignores non-yaml files", async () => {
      await writeTemplate("alpha", "name: alpha\nsteps:\n  - developer\n");
      await filesystem.createFile(join(templatesDir, "readme.txt"), "not a template");
      await filesystem.createFile(join(templatesDir, "config.json"), "{}");

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const templates = await loader.list();

      expect(templates).toEqual(["alpha"]);
    });

    it("ignores .yml files (only .yaml)", async () => {
      await writeTemplate("alpha", "name: alpha\nsteps:\n  - developer\n");
      await filesystem.createFile(
        join(templatesDir, "beta.yml"),
        "name: beta\nsteps:\n  - developer\n",
      );

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const templates = await loader.list();

      expect(templates).toEqual(["alpha"]);
    });

    it("returns empty array when directory is empty", async () => {
      await filesystem.createDirectory(templatesDir);
      const loader = new WorkflowLoader(filesystem, templatesDir);

      const templates = await loader.list();

      expect(templates).toEqual([]);
    });

    it("returns empty array when directory does not exist", async () => {
      const loader = new WorkflowLoader(filesystem, join(rootDirectory, "nonexistent"));

      const templates = await loader.list();

      expect(templates).toEqual([]);
    });

    it("sorts templates alphabetically", async () => {
      await writeTemplate("zeta", "name: zeta\nsteps:\n  - developer\n");
      await writeTemplate("alpha", "name: alpha\nsteps:\n  - developer\n");
      await writeTemplate("mid", "name: mid\nsteps:\n  - developer\n");

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const templates = await loader.list();

      expect(templates).toEqual(["alpha", "mid", "zeta"]);
    });

    it("does not parse or validate when listing", async () => {
      await filesystem.createFile(
        join(templatesDir, "broken.yaml"),
        "name: broken\nsteps:\n  - invalid-yaml",
      );
      await writeTemplate("valid", "name: valid\nsteps:\n  - developer\n");

      const loader = new WorkflowLoader(filesystem, templatesDir);
      const templates = await loader.list();

      expect(templates).toEqual(["broken", "valid"]);
    });
  });
});

describe("WorkflowLoader (repo templates)", () => {
  // These tests load from the actual workflows/ directory in the repo.
  // The test file is at src/workflows/__tests__/loader.test.ts,
  // so the repo root is three levels up.
  const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
  const repoWorkflowsDir = join(repoRoot, "workflows");

  let filesystem: NodeFilesystem;

  beforeEach(() => {
    filesystem = new NodeFilesystem();
  });

  it("loads default template from repo", async () => {
    const loader = new WorkflowLoader(filesystem, repoWorkflowsDir);
    const template = await loader.load("default");

    expect(template.name).toBe("default");
    expect(template.version).toBe(1);
    expect(template.steps).toEqual(["product-owner", "developer", "qa"]);
  });

  it("loads ui template from repo", async () => {
    const loader = new WorkflowLoader(filesystem, repoWorkflowsDir);
    const template = await loader.load("ui");

    expect(template.name).toBe("ui");
    expect(template.version).toBe(1);
    expect(template.steps).toEqual(["product-owner", "designer", "developer", "qa"]);
  });

  it("loads full-stack template from repo", async () => {
    const loader = new WorkflowLoader(filesystem, repoWorkflowsDir);
    const template = await loader.load("full-stack");

    expect(template.name).toBe("full-stack");
    expect(template.version).toBe(1);
    expect(template.steps).toEqual([
      "product-owner",
      "designer",
      "backend-developer",
      "developer",
      "qa",
    ]);
  });

  it("lists all repo templates", async () => {
    const loader = new WorkflowLoader(filesystem, repoWorkflowsDir);
    const templates = await loader.list();

    expect(templates).toContain("default");
    expect(templates).toContain("ui");
    expect(templates).toContain("full-stack");
  });

  it("all repo templates pass validation", async () => {
    const loader = new WorkflowLoader(filesystem, repoWorkflowsDir);
    const templates = await loader.list();

    for (const name of templates) {
      const template = await loader.load(name);
      expect(template.name).toBe(name);
      expect(template.steps.length).toBeGreaterThan(0);
    }
  });
});
