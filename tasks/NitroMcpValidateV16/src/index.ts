import * as tl from "azure-pipelines-task-lib/task.js";
import { execNitro, installNitro, splitMultiline, resolveAuth } from "@chillicream/nitro-common";
import pkg from "../package.json" with { type: "json" };

async function run(): Promise<void> {
  try {
    await installNitro(pkg.version);

    const stage = tl.getInput("stage", true)!;
    const mcpFeatureCollectionId = tl.getInput("mcpFeatureCollectionId", true)!;
    const { apiKey, cloudUrl } = resolveAuth();
    const promptPatterns = splitMultiline(tl.getInput("promptPatterns", false));
    const toolPatterns = splitMultiline(tl.getInput("toolPatterns", false));
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
