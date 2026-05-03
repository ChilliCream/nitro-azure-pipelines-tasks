import * as tl from "azure-pipelines-task-lib/task.js";

/**
 * Runs the Nitro CLI with the given args and the supplied API key set in the
 * NITRO_API_KEY environment variable. Throws on non-zero exit so callers in a
 * per-item loop stop at the first failure.
 */
export async function execNitro(args: string[], apiKey: string): Promise<void> {
  const env: { [key: string]: string } = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) {
      env[k] = v;
    }
  }
  env.NITRO_API_KEY = apiKey;

  const nitroPath = tl.which("nitro", true);
  const exitCode = await tl.tool(nitroPath).arg(args).exec({ env });

  if (exitCode !== 0) {
    throw new Error(`Nitro CLI exited with code ${exitCode}`);
  }
}

/**
 * Splits a multiLine input value into trimmed, non-empty lines.
 */
export function splitMultiline(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
