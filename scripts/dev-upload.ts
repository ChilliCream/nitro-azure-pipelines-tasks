#!/usr/bin/env node
/**
 * Dev-only: builds every task and pushes each definition straight into an
 * Azure DevOps org's task catalog. No Marketplace, no .vsix, no extension
 * publish — the fastest loop for trying in-development tasks against a real
 * pipeline.
 *
 * `tfx build tasks upload` refuses to replace a task that already exists with
 * the same task.json version (and --overwrite is unreliable across server
 * versions), so this deletes the existing definition first, then uploads.
 * That means you never have to bump task.json between iterations.
 *
 * Usage:
 *   yarn dev:upload <org> <pat> [--skip-build]
 *
 *   <org>   Either an org name ("contoso") or a full collection URL
 *           ("https://dev.azure.com/contoso"). Bare names are expanded to
 *           https://dev.azure.com/<org>.
 *   <pat>   A Personal Access Token with the "Agent Pools (Read & manage)"
 *           scope. May also be supplied via the AZDO_PAT env var instead of
 *           the command line (keeps it out of shell history):
 *             AZDO_PAT=xxxx yarn dev:upload <org>
 *   --task=<name> Only push task folders whose name contains <name> (case-
 *                 insensitive), e.g. --task=fusionupload. Repeatable. Combine
 *                 with --skip-build for the tightest single-task loop.
 *   --skip-build  Reuse existing tasks/<task>/dist bundles instead of rebuilding.
 *
 * Pipelines reference these by name + major, e.g. `- task: NitroFusionUpload@16`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tasksDir = path.join(root, "tasks");

const TASK_DIR_RE = /^Nitro[A-Z][A-Za-z]*V\d+$/;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function resolveServiceUrl(org: string): string {
  if (/^https?:\/\//i.test(org)) {
    return org.replace(/\/+$/, "");
  }
  if (!/^[\w.-]+$/.test(org)) {
    fail(`Invalid org '${org}'. Pass an org name or a full https:// URL.`);
  }
  return `https://dev.azure.com/${org}`;
}

function bin(name: string): string {
  const p = path.join(root, "node_modules", ".bin", name);
  if (!fs.existsSync(p)) {
    fail(`${name} not found at ${p}. Run 'yarn install' first.`);
  }
  return p;
}

/** Runs a command; aborts the script on failure. */
function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** Runs a command; returns the exit code instead of aborting. */
function tryRun(cmd: string, args: string[]): number {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  return result.status ?? 1;
}

interface TaskJson {
  id: string;
  name: string;
}

function readTaskJson(folder: string): TaskJson {
  const p = path.join(tasksDir, folder, "task.json");
  const json = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<TaskJson>;
  if (!json.id || !json.name) {
    fail(`${path.relative(root, p)} is missing 'id' or 'name'.`);
  }
  return { id: json.id, name: json.name };
}

function main(): void {
  const argv = process.argv.slice(2);

  const taskFilters: string[] = [];
  let skipBuild = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--skip-build") {
      skipBuild = true;
    } else if (arg === "--task") {
      const value = argv[++i];
      if (!value) fail("--task requires a value, e.g. --task fusionupload");
      taskFilters.push(value.toLowerCase());
    } else if (arg.startsWith("--task=")) {
      taskFilters.push(arg.slice("--task=".length).toLowerCase());
    } else if (arg.startsWith("--")) {
      fail(`Unknown option '${arg}'.`);
    } else {
      positional.push(arg);
    }
  }

  const [org, patArg] = positional;
  if (!org) {
    fail("Usage: yarn dev:upload <org> <pat> [--task=<name>] [--skip-build]");
  }

  const pat = patArg ?? process.env.AZDO_PAT;
  if (!pat) {
    fail(
      "Missing PAT. Pass it as the second argument or via AZDO_PAT env var.\n" +
        "It needs the 'Agent Pools (Read & manage)' scope.",
    );
  }

  const serviceUrl = resolveServiceUrl(org);
  const auth = ["--service-url", serviceUrl, "--token", pat, "--no-color"];

  const allFolders = fs
    .readdirSync(tasksDir)
    .filter((name) => fs.statSync(path.join(tasksDir, name)).isDirectory())
    .filter((name) => TASK_DIR_RE.test(name))
    .sort();

  if (allFolders.length === 0) {
    fail(`No task folders matched ${TASK_DIR_RE} in ${tasksDir}.`);
  }

  const folders =
    taskFilters.length === 0
      ? allFolders
      : allFolders.filter((name) =>
          taskFilters.some((f) => name.toLowerCase().includes(f)),
        );

  if (folders.length === 0) {
    fail(
      `No task folder matched ${taskFilters.map((f) => `'${f}'`).join(", ")}.\n` +
        `Available: ${allFolders.join(", ")}`,
    );
  }

  if (!skipBuild) {
    console.log("Building tasks...");
    run(bin("tsx"), [path.join(__dirname, "build.ts")]);
  } else {
    console.log("Skipping build (--skip-build).");
  }

  const tfx = bin("tfx");
  console.log(`\nPushing ${folders.length} task(s) to ${serviceUrl} ...`);

  for (const folder of folders) {
    const taskDir = path.join(tasksDir, folder);
    const distIndex = path.join(taskDir, "dist", "index.js");
    if (!fs.existsSync(distIndex)) {
      fail(`Missing build output ${path.relative(root, distIndex)}. Run without --skip-build.`);
    }

    const { id, name } = readTaskJson(folder);
    console.log(`\n=== ${name} (${folder}) ===`);

    // Delete first so the re-upload isn't rejected for an existing version.
    // A non-zero exit here just means the task wasn't there yet — fine.
    const delCode = tryRun(tfx, ["build", "tasks", "delete", "--task-id", id, ...auth]);
    if (delCode !== 0) {
      console.log(`  (no existing '${name}' to delete — continuing)`);
    }

    run(tfx, ["build", "tasks", "upload", "--task-path", taskDir, "--overwrite", ...auth]);
  }

  console.log(`\nDone. Pushed ${folders.length} task(s) to ${serviceUrl}.`);
}

main();
