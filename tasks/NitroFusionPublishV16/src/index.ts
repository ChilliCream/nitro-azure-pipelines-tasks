import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, getSourceMetadata, installNitro, splitMultiline, resolveAuth, getOptionalFilePathInput } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const sourceMetadata = JSON.stringify(getSourceMetadata());

    const tag = tl.getInput("tag", true)!;
    const stage = tl.getInput("stage", true)!;
    const apiId = tl.getInput("apiId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const sourceSchemas = splitMultiline(tl.getInput("sourceSchemas", true));
    const legacyV1Archive = getOptionalFilePathInput("legacyV1Archive");
    const force = tl.getBoolInput("force", false);
    const waitForApproval = tl.getBoolInput("waitForApproval", false);
    if (sourceSchemas.length === 0) {
      throw new Error("sourceSchemas must contain at least one entry.");
    }

    const args: string[] = [
      "fusion",
      "publish",
      "--tag",
      tag,
      "--stage",
      stage,
      "--api-id",
      apiId,
      "--source-metadata",
      sourceMetadata,
    ];

    for (const schema of sourceSchemas) {
      args.push("--source-schema", schema);
    }

    if (legacyV1Archive) {
      args.push("--legacy-v1-archive", legacyV1Archive);
    }

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
