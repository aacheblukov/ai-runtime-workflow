import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodeFilesystem } from "@/storage/filesystem.js";

describe("NodeFilesystem", () => {
  let rootDirectory: string;
  let filesystem: NodeFilesystem;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(tmpdir(), "ai-runtime-workflow-filesystem-"),
    );
    filesystem = new NodeFilesystem();
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("creates nested directories", async () => {
    const targetDirectory = join(
      rootDirectory,
      "projects",
      "demo-app",
      "features",
      "FEAT-001",
      "runtime",
    );

    await filesystem.createDirectory(targetDirectory);

    expect((await stat(targetDirectory)).isDirectory()).toBe(true);
  });

  it("allows an existing directory to be created again", async () => {
    const targetDirectory = join(rootDirectory, "projects", "demo-app");

    await filesystem.createDirectory(targetDirectory);
    await expect(
      filesystem.createDirectory(targetDirectory),
    ).resolves.toBeUndefined();
    expect((await stat(targetDirectory)).isDirectory()).toBe(true);
  });

  it("creates a file and its parent directories", async () => {
    const targetFile = join(
      rootDirectory,
      "projects",
      "demo-app",
      "project.md",
    );
    const contents = "# Demo project";

    await filesystem.createFile(targetFile, contents);

    expect(await readFile(targetFile, "utf8")).toBe(contents);
  });

  describe("readFile", () => {
    it("reads a file", async () => {
      const targetFile = join(rootDirectory, "test.txt");
      const contents = "Hello, world!";
      await filesystem.createFile(targetFile, contents);

      const result = await filesystem.readFile(targetFile);

      expect(result).toBe(contents);
    });

    it("throws when file does not exist", async () => {
      const targetFile = join(rootDirectory, "nonexistent.txt");

      await expect(filesystem.readFile(targetFile)).rejects.toThrow();
    });
  });

  describe("writeFile", () => {
    it("writes a file and creates parent directories", async () => {
      const targetFile = join(
        rootDirectory,
        "projects",
        "demo-app",
        "output.md",
      );
      const contents = "# Output";

      await filesystem.writeFile(targetFile, contents);

      expect(await readFile(targetFile, "utf8")).toBe(contents);
    });

    it("overwrites existing file", async () => {
      const targetFile = join(rootDirectory, "test.txt");
      await filesystem.createFile(targetFile, "original");
      await filesystem.writeFile(targetFile, "updated");

      expect(await filesystem.readFile(targetFile)).toBe("updated");
    });
  });

  describe("readJson", () => {
    it("reads and parses JSON", async () => {
      const targetFile = join(rootDirectory, "data.json");
      const data = { name: "test", value: 42, nested: { key: "value" } };
      await filesystem.writeJson(targetFile, data);

      const result = await filesystem.readJson<typeof data>(targetFile);

      expect(result).toEqual(data);
    });

    it("throws when file does not exist", async () => {
      const targetFile = join(rootDirectory, "nonexistent.json");

      await expect(filesystem.readJson(targetFile)).rejects.toThrow();
    });

    it("throws when file contains invalid JSON", async () => {
      const targetFile = join(rootDirectory, "invalid.json");
      await filesystem.createFile(targetFile, "not valid json");

      await expect(filesystem.readJson(targetFile)).rejects.toThrow();
    });
  });

  describe("writeJson", () => {
    it("writes JSON with pretty formatting", async () => {
      const targetFile = join(rootDirectory, "output.json");
      const data = { name: "test", value: 42 };

      await filesystem.writeJson(targetFile, data);

      const raw = await readFile(targetFile, "utf8");
      expect(raw).toBe(JSON.stringify(data, null, 2));
    });

    it("creates parent directories", async () => {
      const targetFile = join(
        rootDirectory,
        "projects",
        "demo-app",
        "config.json",
      );
      const data = { key: "value" };

      await filesystem.writeJson(targetFile, data);

      const result = await filesystem.readJson<typeof data>(targetFile);
      expect(result).toEqual(data);
    });
  });

  describe("appendJsonl", () => {
    it("appends JSON lines to a file", async () => {
      const targetFile = join(rootDirectory, "events.jsonl");
      const event1 = { type: "start", timestamp: 1 };
      const event2 = { type: "end", timestamp: 2 };

      await filesystem.appendJsonl(targetFile, event1);
      await filesystem.appendJsonl(targetFile, event2);

      const raw = await readFile(targetFile, "utf8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!)).toEqual(event1);
      expect(JSON.parse(lines[1]!)).toEqual(event2);
    });

    it("creates parent directories", async () => {
      const targetFile = join(
        rootDirectory,
        "projects",
        "demo-app",
        "events.jsonl",
      );
      const event = { type: "test" };

      await filesystem.appendJsonl(targetFile, event);

      const raw = await readFile(targetFile, "utf8");
      expect(JSON.parse(raw.trim())).toEqual(event);
    });

    it("appends to existing file", async () => {
      const targetFile = join(rootDirectory, "events.jsonl");
      await filesystem.appendJsonl(targetFile, { first: true });
      await filesystem.appendJsonl(targetFile, { second: true });

      const raw = await readFile(targetFile, "utf8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(2);
    });
  });
});
