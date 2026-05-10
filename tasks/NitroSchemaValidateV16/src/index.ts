import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, getSourceMetadata, installNitro } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const sourceMetadata = JSON.stringify(getSourceMetadata());

    const stage = tl.getInput("stage", true)!;
    const apiId = tl.getInput("apiId", true)!;
    const schemaFile = tl.getInput("schemaFile", true)!;
    const apiKey = tl.getInput("apiKey", true)!;
    const cloudUrl = tl.getInput("cloudUrl", false);

    const args: string[] = [
      "schema",
      "validate",
      "--stage",
      stage,
      "--api-id",
      apiId,
      "--schema-file",
      schemaFile,
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
