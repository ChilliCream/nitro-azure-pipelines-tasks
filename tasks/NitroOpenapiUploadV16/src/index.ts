import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro, splitMultiline } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const tag = tl.getInput("tag", true)!;
    const openapiCollectionId = tl.getInput("openapiCollectionId", true)!;
    const apiKey = tl.getInput("apiKey", true)!;
    const patterns = splitMultiline(tl.getInput("patterns", true));
    const cloudUrl = tl.getInput("cloudUrl", false);

    if (patterns.length === 0) {
      throw new Error("patterns must contain at least one entry.");
    }

    const args: string[] = [
      "openapi",
      "upload",
      "--tag",
      tag,
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
