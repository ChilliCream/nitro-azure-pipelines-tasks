import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro, splitMultiline, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const stage = tl.getInput("stage", true)!;
    const openapiCollectionId = tl.getInput("openapiCollectionId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const patterns = splitMultiline(tl.getInput("patterns", true));
    if (patterns.length === 0) {
      throw new Error("patterns must contain at least one entry.");
    }

    const args: string[] = [
      "openapi",
      "validate",
      "--stage",
      stage,
      "--openapi-collection-id",
      openapiCollectionId,
    ];

    for (const pattern of patterns) {
      args.push("--pattern", pattern);
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
