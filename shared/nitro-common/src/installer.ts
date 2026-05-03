import * as path from "node:path";
import * as fs from "node:fs";
import * as tl from "azure-pipelines-task-lib/task.js";
import * as toolLib from "azure-pipelines-tool-lib";
import { getPlatformInfo } from "./platform.js";

const TOOL_NAME = "nitro";

/**
 * Downloads (and caches) the Nitro CLI for the requested version, then
 * prepends the cached directory to PATH so subsequent `nitro` invocations
 * resolve to it.
 *
 * Idempotent: a cache hit returns immediately without a network call.
 */
export async function installNitro(version: string): Promise<void> {
  const { osType, archType } = getPlatformInfo();
  const binaryName = osType === "win" ? "nitro.exe" : "nitro";

  let toolPath = toolLib.findLocalTool(TOOL_NAME, version);

  if (!toolPath) {
    const extension = osType === "linux" ? "tar.gz" : "zip";
    const downloadUrl =
      `https://github.com/ChilliCream/graphql-platform/releases/download/` +
      `${version}/nitro-${osType}-${archType}.${extension}`;

    tl.debug(`Downloading Nitro CLI from: ${downloadUrl}`);

    const downloadPath = await toolLib.downloadTool(downloadUrl);

    const extractPath =
      osType === "linux"
        ? await toolLib.extractTar(downloadPath)
        : await toolLib.extractZip(downloadPath);

    toolPath = await toolLib.cacheDir(extractPath, TOOL_NAME, version);
  }

  toolLib.prependPath(toolPath);

  if (osType !== "win") {
    const binaryPath = path.join(toolPath, binaryName);
    if (fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
    }
  }
}
