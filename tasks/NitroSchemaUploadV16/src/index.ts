import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, getSourceMetadata, installNitro, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const sourceMetadata = JSON.stringify(getSourceMetadata());

    const tag = tl.getInput("tag", true)!;
    const schemaFile = tl.getInput("schemaFile", true)!;
    const apiId = tl.getInput("apiId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const args: string[] = [
      "schema",
      "upload",
      "--tag",
      tag,
      "--schema-file",
      schemaFile,
      "--api-id",
      apiId,
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
