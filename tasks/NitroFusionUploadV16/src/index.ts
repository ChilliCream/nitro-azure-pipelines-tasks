import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, getSourceMetadata, installNitro, splitMultiline, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const sourceMetadata = JSON.stringify(getSourceMetadata());

    const tag = tl.getInput("tag", true)!;
    const apiId = tl.getInput("apiId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const sourceSchemaFiles = splitMultiline(tl.getInput("sourceSchemaFiles", true));
    if (sourceSchemaFiles.length === 0) {
      throw new Error("sourceSchemaFiles must contain at least one entry.");
    }

    for (const file of sourceSchemaFiles) {
      const args: string[] = [
        "fusion",
        "upload",
        "--tag",
        tag,
        "--api-id",
        apiId,
        "--source-schema-file",
        file,
        "--source-metadata",
        sourceMetadata,
      ];

      if (cloudUrl) {
        args.push("--cloud-url", cloudUrl);
      }

      await execNitro(args, apiKey);
    }
  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
  }
}

run();
