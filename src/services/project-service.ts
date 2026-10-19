import { join } from "node:path";
import type { Filesystem } from "@/storage/filesystem.js";
import { validateProjectName } from "@/services/validation.js";

export interface CreateProjectOptions {
  force?: boolean;
}

export class ProjectService {
  constructor(private readonly filesystem: Filesystem) {}

  /**
   * Create a new AI development project structure on disk.
   */
  public async createProject(
    name: string,
    options: CreateProjectOptions = {},
  ): Promise<void> {
    validateProjectName(name);

    const projectRoot = join("projects", name);

    if (!options.force) {
      let projectExists = false;
      try {
        await this.filesystem.readFile(join(projectRoot, "project.md"));
        projectExists = true;
      } catch {
        // File doesn't exist, continue
      }
      if (projectExists) {
        throw new Error(
          `Project "${name}" already exists. Use --force to overwrite.`,
        );
      }
    }

    await this.filesystem.createDirectory(join(projectRoot, "features"));
    await this.filesystem.createDirectory(join(projectRoot, "bugs"));

    await this.filesystem.writeFile(
      join(projectRoot, "project.md"),
      `# ${name}\n\nProject created via AI Runtime.\n`,
    );

    await this.filesystem.writeFile(
      join(projectRoot, "backlog.md"),
      `# Backlog\n\n## Features\n\n## Bugs\n`,
    );
  }
}
