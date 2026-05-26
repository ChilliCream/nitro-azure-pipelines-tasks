#!/usr/bin/env node
/**
 * Packages the extension into artifacts/*.vsix using tfx-cli.
 *
 * tfx-cli has no .tfxignore equivalent — it packages every file under each
 * folder in vss-extension.json's `files[]`. To keep the .vsix lean, we stage
 * only the runtime artifacts (task.json, dist/index.js, dist/lib*.json,
 * dist/exec-child.js, dist/sourcemap-register.cjs) into artifacts/staging/,
 * copy the manifest + README/images alongside, and run tfx against that
 * staging tree. The original tasks/ folders (with src/, tsconfig, etc.) are
 * untouched.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, "artifacts");
const stagingDir = path.join(artifactsDir, "staging");

interface VssExtension {
  files?: Array<{ path: string }>;
}

const TASK_RUNTIME_FILES = [
  "task.json",
];

const TASK_DIST_FILES = [
  "index.js",
  "exec-child.js",
  "lib.json",
  "lib1.json",
  "lib2.json",
  "package.json",
  "sourcemap-register.cjs",
];

function copyFile(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirShallow(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isFile()) {
      fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
    }
  }
}

function stageTaskFolder(taskFolder: string): void {
  const srcDir = path.join(root, taskFolder);
  const destDir = path.join(stagingDir, taskFolder);

  for (const f of TASK_RUNTIME_FILES) {
    const s = path.join(srcDir, f);
    if (fs.existsSync(s)) {
      copyFile(s, path.join(destDir, f));
    } else {
      throw new Error(
        `Missing runtime artifact: ${path.relative(root, s)}. ` +
          `Run 'yarn build' before 'yarn package'.`,
      );
    }
  }

  const srcDist = path.join(srcDir, "dist");
  if (!fs.existsSync(path.join(srcDist, "index.js"))) {
    throw new Error(
      `Missing build artifact: ${path.relative(root, path.join(srcDist, "index.js"))}. ` +
        `Run 'yarn build' before 'yarn package'.`,
    );
  }
  for (const f of TASK_DIST_FILES) {
    const s = path.join(srcDist, f);
    if (fs.existsSync(s)) {
      copyFile(s, path.join(destDir, "dist", f));
    }
  }
}

function stageManifestAssets(): void {
  copyFile(path.join(root, "vss-extension.json"), path.join(stagingDir, "vss-extension.json"));
  copyFile(path.join(root, "README.md"), path.join(stagingDir, "README.md"));
  copyDirShallow(path.join(root, "images"), path.join(stagingDir, "images"));

  const license = path.join(root, "LICENSE");
  if (fs.existsSync(license)) {
    copyFile(license, path.join(stagingDir, "LICENSE"));
  }
}

function main(): void {
  fs.rmSync(artifactsDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "vss-extension.json"), "utf8"),
  ) as VssExtension;
  const taskFolders = (manifest.files ?? [])
    .map((f) => f.path)
    .filter((p) => p.startsWith("tasks/"));

  if (taskFolders.length === 0) {
    throw new Error("vss-extension.json has no `tasks/*` files entries.");
  }

  for (const folder of taskFolders) {
    stageTaskFolder(folder);
  }
  stageManifestAssets();

  const tfxBin = path.join(root, "node_modules", ".bin", "tfx");
  if (!fs.existsSync(tfxBin)) {
    throw new Error(`tfx-cli not installed at ${tfxBin}. Run 'yarn install' first.`);
  }

  const result = spawnSync(
    tfxBin,
    [
      "extension",
      "create",
      "--manifest-globs",
      "vss-extension.json",
      "--output-path",
      artifactsDir,
      "--no-color",
    ],
    {
      cwd: stagingDir,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  fs.rmSync(stagingDir, { recursive: true, force: true });

  const vsixFiles = fs
    .readdirSync(artifactsDir)
    .filter((name) => name.endsWith(".vsix"));
  if (vsixFiles.length === 0) {
    throw new Error("tfx exited cleanly but no .vsix was produced.");
  }
  console.log(`Packaged: ${vsixFiles.map((n) => `artifacts/${n}`).join(", ")}`);
}

main();
