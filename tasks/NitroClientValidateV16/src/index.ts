import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const stage = tl.getInput("stage", true)!;
    const clientId = tl.getInput("clientId", true)!;
    const apiKey = tl.getInput("apiKey", true)!;
    const operationsFile = tl.getInput("operationsFile", true)!;
    const cloudUrl = tl.getInput("cloudUrl", false);

    const args: string[] = [
      "client",
      "validate",
      "--stage",
      stage,
      "--client-id",
      clientId,
      "--operations-file",
      operationsFile,
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
