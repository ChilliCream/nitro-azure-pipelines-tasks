import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, getSourceMetadata, installNitro, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const sourceMetadata = JSON.stringify(getSourceMetadata());

    const tag = tl.getInput("tag", true)!;
    const clientId = tl.getInput("clientId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const operationsFile = tl.getInput("operationsFile", true)!;
    const args: string[] = [
      "client",
      "upload",
      "--tag",
      tag,
      "--client-id",
      clientId,
      "--operations-file",
      operationsFile,
      "--source-metadata",
      sourceMetadata,
    ];

    if (cloudUrl) {
      args.push("--cloud-url", cloudUrl);
    }

    await execNitro(args, apiKey);
  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
  }
}

run();
