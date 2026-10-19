// Filesystem abstraction layer for the AI Dev Team runtime.
// Provides a minimal, typed interface for common file operations
// so the rest of the runtime does not depend on Node's fs directly.

import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface Filesystem {
  createDirectory(path: string): Promise<void>;
  createFile(path: string, contents: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  readJson<T>(path: string): Promise<T>;
  writeJson<T>(path: string, data: T): Promise<void>;
  appendJsonl<T>(path: string, data: T): Promise<void>;
  listDirectory(path: string): Promise<string[]>;
}

export class NodeFilesystem implements Filesystem {
  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async createFile(path: string, contents: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, { encoding: "utf8" });
  }

  async readFile(path: string): Promise<string> {
    return readFile(path, { encoding: "utf8" });
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, { encoding: "utf8" });
  }

  async readJson<T>(path: string): Promise<T> {
    const contents = await this.readFile(path);
    return JSON.parse(contents) as T;
  }

  async writeJson<T>(path: string, data: T): Promise<void> {
    const contents = JSON.stringify(data, null, 2);
    await this.writeFile(path, contents);
  }

  async appendJsonl<T>(path: string, data: T): Promise<void> {
    const line = JSON.stringify(data);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${line}\n`, { encoding: "utf8" });
  }

  async listDirectory(path: string): Promise<string[]> {
    return readdir(path);
  }
}
