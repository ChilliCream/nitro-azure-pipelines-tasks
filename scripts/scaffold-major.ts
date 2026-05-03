#!/usr/bin/env node
/**
 * Duplicates every tasks/Nitro*V<oldMajor>/ folder into tasks/Nitro*V<newMajor>/
 * with the major number swapped, ready for the next CLI major release.
 *
 * Usage:
 *   scaffold-major.ts <newMajor>           # source = highest existing major
 *   scaffold-major.ts <newMajor> <oldMajor>
 *
 * What it does per source folder:
 *   1. Copies the directory tree (skipping dist/ and node_modules/).
 *   2. Renames the folder: Nitro*V<old>  ->  Nitro*V<new>.
 *   3. Bumps task.json.version.Major to the new major; resets Minor and Patch
 *      to 0.
 *   4. Renames package.json: @chillicream/nitro-*-v<old> -> -v<new>; sets
 *      package.json.version to <new>.0.0.
 *   5. Updates root vss-extension.json: appends new files[] and contributions[]
 *      entries for each new folder. Existing entries are left untouched, so
 *      both majors coexist after this script runs.
 *   6. Updates root tsconfig.json references[] with the new task folders.
 *
 * Does not touch the workspaces glob in root package.json (already
 * `tasks/*`). Does not bump the extension version (bump-version.ts handles
 * that on the next release).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tasksDir = path.join(root, "tasks");

const TASK_DIR_RE = /^(Nitro[A-Z][A-Za-z]*)V(\d+)$/;

interface TaskJson {
  version: { Major: number; Minor: number; Patch: number };
  [key: string]: unknown;
}

interface VssExtension {
  files?: Array<{ path: string }>;
  contributions?: Array<{
    id: string;
    type: string;
    targets: string[];
    properties: { name: string };
  }>;
}

interface TsConfig {
  references?: Array<{ path: string }>;
  [key: string]: unknown;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function writeJson(p: string, data: unknown): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function copyTree(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(s, d);
    } else if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(s), d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function listMajors(): { folders: { name: string; op: string; major: number }[]; majors: number[] } {
  const folders = fs
    .readdirSync(tasksDir)
    .filter((name) => fs.statSync(path.join(tasksDir, name)).isDirectory())
    .map((name) => {
      const m = TASK_DIR_RE.exec(name);
      if (!m) return null;
      return { name, op: m[1]!, major: Number(m[2]) };
    })
    .filter((entry): entry is { name: string; op: string; major: number } => entry !== null);

  const majors = Array.from(new Set(folders.map((f) => f.major))).sort((a, b) => a - b);
  return { folders, majors };
}

function kebabize(op: string): string {
  // e.g., NitroFusionPublish -> nitro-fusion-publish
  return op.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function main(): void {
  const args = process.argv.slice(2);
  const newMajor = Number(args[0]);
  if (!Number.isInteger(newMajor) || newMajor <= 0) {
    throw new Error("Usage: scaffold-major.ts <newMajor> [<oldMajor>]");
  }

  const { folders, majors } = listMajors();
  const oldMajorArg = args[1] !== undefined ? Number(args[1]) : undefined;
  const oldMajor =
    oldMajorArg ?? (majors.length > 0 ? majors[majors.length - 1]! : undefined);

  if (oldMajor === undefined) {
    throw new Error("No existing task folders to copy from.");
  }
  if (!majors.includes(oldMajor)) {
    throw new Error(`No tasks/Nitro*V${oldMajor}/ folders found.`);
  }
  if (majors.includes(newMajor)) {
    throw new Error(`tasks/Nitro*V${newMajor}/ already exists. Refusing to overwrite.`);
  }

  const sourceFolders = folders.filter((f) => f.major === oldMajor);
  const newFolderPaths: string[] = [];

  for (const { op, name } of sourceFolders) {
    const newName = `${op}V${newMajor}`;
    const srcDir = path.join(tasksDir, name);
    const destDir = path.join(tasksDir, newName);
    console.log(`Scaffolding ${newName} from ${name}...`);
    copyTree(srcDir, destDir);

    const taskJsonPath = path.join(destDir, "task.json");
    const taskJson = readJson<TaskJson>(taskJsonPath);
    taskJson.version = { Major: newMajor, Minor: 0, Patch: 0 };
    writeJson(taskJsonPath, taskJson);

    const pkgPath = path.join(destDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = readJson<{ name?: string; version?: string }>(pkgPath);
      if (pkg.name) {
        pkg.name = pkg.name.replace(new RegExp(`-v${oldMajor}$`), `-v${newMajor}`);
      }
      pkg.version = `${newMajor}.0.0`;
      writeJson(pkgPath, pkg);
    }

    newFolderPaths.push(`tasks/${newName}`);
  }

  const manifestPath = path.join(root, "vss-extension.json");
  const manifest = readJson<VssExtension>(manifestPath);
  manifest.files = [...(manifest.files ?? []), ...newFolderPaths.map((p) => ({ path: p }))];
  manifest.contributions = [
    ...(manifest.contributions ?? []),
    ...sourceFolders.map(({ op }) => ({
      id: `${kebabize(op)}-v${newMajor}`,
      type: "ms.vss-distributed-task.task",
      targets: ["ms.vss-distributed-task.tasks"],
      properties: { name: `tasks/${op}V${newMajor}` },
    })),
  ];
  writeJson(manifestPath, manifest);

  const rootTsconfigPath = path.join(root, "tsconfig.json");
  const rootTsconfig = readJson<TsConfig>(rootTsconfigPath);
  rootTsconfig.references = [
    ...(rootTsconfig.references ?? []),
    ...newFolderPaths.map((p) => ({ path: p })),
  ];
  writeJson(rootTsconfigPath, rootTsconfig);

  console.log(
    `\nScaffolded ${sourceFolders.length} folder(s) for major ${newMajor}. ` +
      `Review the new tasks/Nitro*V${newMajor}/ folders, then commit.`,
  );
}

main();
