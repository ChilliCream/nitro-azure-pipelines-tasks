import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro, splitMultiline, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const stage = tl.getInput("stage", true)!;
    const apiId = tl.getInput("apiId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const sourceSchemaFiles = splitMultiline(tl.getInput("sourceSchemaFiles", true));
    const legacyV1Archive = tl.getInput("legacyV1Archive", false);
    if (sourceSchemaFiles.length === 0) {
      throw new Error("sourceSchemaFiles must contain at least one entry.");
    }

    const args: string[] = [
      "fusion",
      "validate",
      "--stage",
      stage,
      "--api-id",
      apiId,
    ];

    for (const file of sourceSchemaFiles) {
      args.push("--source-schema-file", file);
    }

    if (legacyV1Archive) {
      args.push("--legacy-v1-archive", legacyV1Archive);
    }

    if (cloudUrl) {
      args.push("--cloud-url", cloudUrl);
    }

    await execNitro(args, apiKey);
  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
  }
}

run();
