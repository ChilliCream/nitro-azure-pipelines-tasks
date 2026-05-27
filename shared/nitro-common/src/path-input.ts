import * as path from "node:path";
import * as tl from "azure-pipelines-task-lib/task.js";

/**
 * Returns the value of an optional `filePath` input, or `undefined` if the user
 * did not supply one. The Azure Pipelines agent defaults blank `filePath`
 * inputs to the source root, so a plain `getInput` cannot distinguish "unset"
 * from "set to the working directory". The task-lib's own `filePathSupplied`
 * helper relies on `this`-binding that breaks under ncc bundling, so we
 * replicate the comparison here.
 */
export function getOptionalFilePathInput(name: string): string | undefined {
  const value = tl.getPathInput(name, false);
  if (!value) {
    return undefined;
  }
  const repoRoot =
    tl.getVariable("build.sourcesDirectory") ??
    tl.getVariable("system.defaultWorkingDirectory") ??
    "";
  if (path.resolve(value) === path.resolve(repoRoot)) {
    return undefined;
  }
  return value;
}
