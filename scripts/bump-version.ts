#!/usr/bin/env node
/**
 * Stamps version metadata into the extension manifest and per-task task.json
 * files for a release run.
 *
 * Two modes:
 *
 * CLI-version-driven (default):
 *   bump-version.ts <cliVersion> [--is-active-major=<bool>]
 *
 *   <cliVersion>          Stable Nitro CLI semver, e.g. "17.0.0", "16.1.1".
 *                         Pre-release suffixes are rejected — the release
 *                         worker filters !is_stable upstream.
 *   --is-active-major     Whether <cliVersion>.major >= highest released
 *                         stable major. Echoed to outputs for traceability;
 *                         does not affect any write (cli.major already selects
 *                         the task folders to stamp).
 *
 *   What it does:
 *     1. Stamps task.json.version for every tasks/Nitro*V<cli.major>/ folder
 *        with the triple {cli.major, cli.minor, cli.patch}. Other-major
 *        folders are intentionally untouched.
 *     2. Mirrors the same CLI semver into each touched task's
 *        package.json.version, so the embedded install step (each task calls
 *        installNitro(pkg.version)) picks up the right CLI version when the
 *        bundle is built.
 *     3. Reads vss-extension.json.version, computes patch++, writes back.
 *     4. Mirrors the new extension version into root package.json.version.
 *     5. Emits GitHub Actions outputs (extension_version, cli_version,
 *        task_major, is_active_major).
 *
 * Extension-only:
 *   bump-version.ts --extension-only
 *
 *   What it does:
 *     1. Reads vss-extension.json.version, computes patch++, writes back.
 *     2. Mirrors into root package.json.version.
 *     3. Emits extension_version. No task files touched.
 *
 *   Use only for changes that don't affect any task's runtime behavior
 *   (manifest metadata, README links). Anything that changes a task's
 *   runtime needs the CLI-version-driven mode so task.json.version increases
 *   too — AzDO marketplace silently rejects updates where task.json.version
 *   did not increase.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CliArgs {
  mode: "cli";
  cliVersion: string;
  isActiveMajor: boolean;
}

interface ExtensionOnlyArgs {
  mode: "extension-only";
}

type Args = CliArgs | ExtensionOnlyArgs;

interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

interface TaskJson {
  version: { Major: number; Minor: number; Patch: number };
}

function parseSemver(input: string): Semver {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(input);
  if (!match) {
    throw new Error(`Not a semver: '${input}'`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function formatSemver(v: Semver): string {
  const base = `${v.major}.${v.minor}.${v.patch}`;
  return v.prerelease ? `${base}-${v.prerelease}` : base;
}

/**
 * AzDO marketplace requires extension version to increase monotonically across
 * all publishes. We deliberately do NOT couple extension version to CLI version
 * (a v16.1.1 backport published after v17.0.0 must still produce a higher
 * extension version). Release notes per extension version document which CLI
 * version the bundle ships.
 *
 * Always: drop any -prerelease suffix (used only as a starting-state seed),
 * patch++.
 */
function nextExtensionVersion(current: Semver): Semver {
  return {
    major: current.major,
    minor: current.minor,
    patch: current.patch + 1,
    prerelease: null,
  };
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function writeJson(p: string, data: unknown): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function parseArgs(argv: string[]): Args {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const flags = Object.fromEntries(
    argv
      .filter((a) => a.startsWith("--"))
      .map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? "true"];
      }),
  );

  if (flags["extension-only"] === "true") {
    if (positional.length > 0) {
      throw new Error("Positional <cliVersion> not allowed with --extension-only.");
    }
    return { mode: "extension-only" };
  }

  const cliVersion = positional[0];
  if (!cliVersion) {
    throw new Error(
      "Usage: bump-version.ts <cliVersion> [--is-active-major=<bool>]\n" +
        "       bump-version.ts --extension-only",
    );
  }

  const cli = parseSemver(cliVersion);
  if (cli.prerelease !== null) {
    throw new Error(
      `Pre-release CLI versions are not published. Got '${cliVersion}'. ` +
        `The release worker should have skipped before invoking this script.`,
    );
  }

  return {
    mode: "cli",
    cliVersion,
    isActiveMajor: flags["is-active-major"] === "true",
  };
}

function bumpTaskFolders(
  tasksDir: string,
  cliMajor: number,
  triple: TaskJson["version"],
  cliSemver: string,
): string[] {
  const folderRe = new RegExp(`^Nitro[A-Z][A-Za-z]*V${cliMajor}$`);
  const folders = fs
    .readdirSync(tasksDir)
    .filter((name) => fs.statSync(path.join(tasksDir, name)).isDirectory())
    .filter((name) => folderRe.test(name));

  if (folders.length === 0) {
    throw new Error(
      `No task folders found matching *V${cliMajor}. ` +
        `Add tasks/Nitro*V${cliMajor}/ before publishing this CLI major, ` +
        `or scaffold them via 'yarn scaffold:major ${cliMajor}'.`,
    );
  }

  for (const folder of folders) {
    const taskDir = path.join(tasksDir, folder);

    const taskJsonPath = path.join(taskDir, "task.json");
    const taskJson = readJson<TaskJson>(taskJsonPath);
    taskJson.version = { ...triple };
    writeJson(taskJsonPath, taskJson);

    // Embedded install step reads pkg.version at build time. Keep it in sync
    // with task.json.version so the bundled task installs the matching CLI.
    const pkgPath = path.join(taskDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = readJson<{ version: string }>(pkgPath);
      pkg.version = cliSemver;
      writeJson(pkgPath, pkg);
    }
  }

  return folders;
}

function bumpExtensionVersion(root: string): string {
  const manifestPath = path.join(root, "vss-extension.json");
  const manifest = readJson<{ version: string }>(manifestPath);
  const nextExt = nextExtensionVersion(parseSemver(manifest.version));
  const nextStr = formatSemver(nextExt);
  manifest.version = nextStr;
  writeJson(manifestPath, manifest);

  const pkgPath = path.join(root, "package.json");
  const pkg = readJson<{ version: string }>(pkgPath);
  pkg.version = nextStr;
  writeJson(pkgPath, pkg);

  return nextStr;
}

function emitGithubOutputs(outputs: Record<string, string>): void {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  const lines = Object.entries(outputs).map(([k, v]) => `${k}=${v}`);
  fs.appendFileSync(target, lines.join("\n") + "\n");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, "..");

  if (args.mode === "extension-only") {
    const extVersion = bumpExtensionVersion(root);
    emitGithubOutputs({ extension_version: extVersion });
    console.log(`Stamped extension ${extVersion} (extension-only).`);
    return;
  }

  const cli = parseSemver(args.cliVersion);
  const cliTriple = { Major: cli.major, Minor: cli.minor, Patch: cli.patch };
  const cliSemver = formatSemver(cli);

  const tasksDir = path.join(root, "tasks");
  const stamped = bumpTaskFolders(tasksDir, cli.major, cliTriple, cliSemver);
  const extVersion = bumpExtensionVersion(root);

  emitGithubOutputs({
    extension_version: extVersion,
    cli_version: cliSemver,
    task_major: String(cli.major),
    is_active_major: String(args.isActiveMajor),
  });

  console.log(
    `Stamped extension ${extVersion}; CLI ${cliSemver} -> ${stamped.length} task folder(s).`,
  );
}

main();
