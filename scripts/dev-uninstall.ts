#!/usr/bin/env node
/**
 * Dev-only: deletes task definitions from an Azure DevOps org's task catalog
 * by ID, using the IDs from each tasks/*\/task.json. Inverse of dev-upload.ts.
 *
 * Usage:
 *   yarn dev:uninstall <org> <pat> [--task=<name>]
 *
 *   <org>   Either an org name ("contoso") or a full collection URL
 *           ("https://dev.azure.com/contoso"). Bare names are expanded to
 *           https://dev.azure.com/<org>.
 *   <pat>   PAT with "Agent Pools (Read & manage)" scope. May also be passed
 *           via AZDO_PAT env var:
 *             AZDO_PAT=xxxx yarn dev:uninstall <org>
 *   --task=<name> Only delete task folders whose name contains <name> (case-
 *                 insensitive). Repeatable.
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
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--task") {
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
    fail("Usage: yarn dev:uninstall <org> <pat> [--task=<name>]");
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

  const tfx = bin("tfx");
  console.log(`Deleting ${folders.length} task(s) from ${serviceUrl} ...`);

  let removed = 0;
  let absent = 0;
  for (const folder of folders) {
    const { id, name } = readTaskJson(folder);
    console.log(`\n=== ${name} (${folder}) ===`);
    const code = tryRun(tfx, ["build", "tasks", "delete", "--task-id", id, ...auth]);
    if (code === 0) {
      removed++;
    } else {
      console.log(`  (no existing '${name}' to delete — skipped)`);
      absent++;
    }
  }

  console.log(`\nDone. Removed ${removed}, absent ${absent}.`);
}

main();
