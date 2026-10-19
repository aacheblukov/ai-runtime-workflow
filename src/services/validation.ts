/**
 * Validate the project name format and length.
 */
export function validateProjectName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(
      "Project name must start with a letter and contain only lowercase letters, numbers, and hyphens",
    );
  }
  if (name.length > 50) {
    throw new Error("Project name must be 50 characters or less");
  }
}
