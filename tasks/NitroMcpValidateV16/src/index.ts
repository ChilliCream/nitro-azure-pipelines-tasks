import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, getSourceMetadata, installNitro, splitMultiline } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const sourceMetadata = getSourceMetadata();
    console.log(JSON.stringify(sourceMetadata));

    const stage = tl.getInput("stage", true)!;
    const mcpFeatureCollectionId = tl.getInput("mcpFeatureCollectionId", true)!;
    const apiKey = tl.getInput("apiKey", true)!;
    const promptPatterns = splitMultiline(tl.getInput("promptPatterns", false));
    const toolPatterns = splitMultiline(tl.getInput("toolPatterns", false));
    const cloudUrl = tl.getInput("cloudUrl", false);

    if (promptPatterns.length === 0 && toolPatterns.length === 0) {
      throw new Error("At least one of promptPatterns or toolPatterns must contain an entry.");
    }

    const args: string[] = [
      "mcp",
      "validate",
      "--stage",
      stage,
      "--mcp-feature-collection-id",
      mcpFeatureCollectionId,
    ];

    for (const pattern of promptPatterns) {
      args.push("--prompt-pattern", pattern);
    }

    for (const pattern of toolPatterns) {
      args.push("--tool-pattern", pattern);
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
