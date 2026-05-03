#!/usr/bin/env node
/**
 * Builds every task in tasks/Nitro*V<N>/ by running ncc against the task's
 * src/index.ts and writing the bundled output to tasks/<task>/dist/index.js.
 * Also copies the task.json from the task root into dist alongside the bundle
 * is NOT done — task.json stays at the task folder root, which is what
 * vss-extension.json's `files` entries point at.
 *
 * The bundled dist/index.js reads pkg.version statically (ncc inlines the
 * package.json import at build time), so the resulting bundle pins the CLI
 * version that bump-version.ts wrote into package.json before this script ran.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- @vercel/ncc has no published type declarations.
import ncc from "@vercel/ncc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tasksDir = path.join(root, "tasks");

const TASK_DIR_RE = /^Nitro[A-Z][A-Za-z]*V\d+$/;

interface NccResult {
  code: string;
  map?: string;
  assets?: Record<string, { source: string | Buffer }>;
}

async function buildTask(folder: string): Promise<void> {
  const taskDir = path.join(tasksDir, folder);
  const entry = path.join(taskDir, "src", "index.ts");
  const distDir = path.join(taskDir, "dist");

  if (!fs.existsSync(entry)) {
    throw new Error(`Missing entry point ${entry}`);
  }

  process.stdout.write(`  ${folder} ... `);
  const start = Date.now();

  const result = (await ncc(entry, {
    minify: true,
    sourceMap: true,
    quiet: true,
    target: "es2022",
    cache: false,
    license: "",
  })) as NccResult;

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, "index.js"), result.code);
  if (result.map) {
    fs.writeFileSync(path.join(distDir, "index.js.map"), result.map);
  }

  if (result.assets) {
    for (const [assetPath, { source }] of Object.entries(result.assets)) {
      const target = path.join(distDir, assetPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    }
  }

  process.stdout.write(`done (${Date.now() - start}ms)\n`);
}

async function main(): Promise<void> {
  const folders = fs
    .readdirSync(tasksDir)
    .filter((name) => fs.statSync(path.join(tasksDir, name)).isDirectory())
    .filter((name) => TASK_DIR_RE.test(name))
    .sort();

  if (folders.length === 0) {
    throw new Error(`No task folders matched ${TASK_DIR_RE} in ${tasksDir}.`);
  }

  const iconScript = path.join(__dirname, "generate-icons.ts");
  if (fs.existsSync(iconScript)) {
    const tsxBin = path.join(root, "node_modules", ".bin", "tsx");
    const r = spawnSync(tsxBin, [iconScript], { cwd: root, stdio: "inherit" });
    if (r.status !== 0) {
      throw new Error("Icon generation failed.");
    }
  }

  console.log(`Building ${folders.length} task(s):`);
  for (const folder of folders) {
    await buildTask(folder);
  }
  console.log("Build complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
