import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const apiId = tl.getInput("apiId", true)!;
    const stage = tl.getInput("stage", true)!;
    const file = tl.getInput("file", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const args: string[] = [
      "schema",
      "download",
      "--api-id",
      apiId,
      "--stage",
      stage,
      "--file",
      file,
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
