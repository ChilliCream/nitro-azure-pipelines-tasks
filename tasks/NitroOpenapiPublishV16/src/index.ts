import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const tag = tl.getInput("tag", true)!;
    const stage = tl.getInput("stage", true)!;
    const openapiCollectionId = tl.getInput("openapiCollectionId", true)!;
    const apiKey = tl.getInput("apiKey", true)!;
    const force = tl.getBoolInput("force", false);
    const waitForApproval = tl.getBoolInput("waitForApproval", false);
    const cloudUrl = tl.getInput("cloudUrl", false);

    const args: string[] = [
      "openapi",
      "publish",
      "--tag",
      tag,
      "--stage",
      stage,
      "--openapi-collection-id",
      openapiCollectionId,
    ];

    if (force) {
      args.push("--force");
    }

    if (waitForApproval) {
      args.push("--wait-for-approval");
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
